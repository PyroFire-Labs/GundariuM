import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sendAlert } from "./alert.js";
import { getModelStatus, setModelStatus } from "./modelStore.js";
import { dequeueModelJob } from "./queue.js";
import type { ModelJob } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSEMBLE_SCRIPT = path.join(__dirname, "..", "blender", "assemble.py");
const BLENDER_BIN = process.env.BLENDER_BIN ?? "blender";
const POLL_MS = Number(process.env.MODEL_WORKER_POLL_MS ?? 5000);

function runBlender(traitsPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      BLENDER_BIN,
      ["--background", "--python", ASSEMBLE_SCRIPT, "--", traitsPath, outPath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdout.on("data", () => {
      // Blender's own render/import chatter — not useful on the happy path,
      // swallowed to keep worker logs to job-level events.
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn blender (${BLENDER_BIN}): ${err.message}`));
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`blender exited ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

async function processJob(job: ModelJob): Promise<void> {
  console.log(`[worker] processing chainId=${job.chainId} tokenId=${job.tokenId}`);
  await setModelStatus(job.chainId, job.tokenId, "processing");

  const workDir = await mkdtemp(path.join(tmpdir(), "gundarium-model-"));
  const traitsPath = path.join(workDir, "traits.json");
  const outPath = path.join(workDir, `chain-${job.chainId}-token-${job.tokenId}.glb`);

  try {
    await writeFile(
      traitsPath,
      JSON.stringify({ tokenId: job.tokenId, ...job.traits })
    );

    await runBlender(traitsPath, outPath);

    const { uploadGlb } = await import("./pinataUpload.js");
    const uri = await uploadGlb(outPath, `gundarframe-${job.chainId}-${job.tokenId}.glb`);

    await setModelStatus(job.chainId, job.tokenId, "ready", { uri });
    console.log(`[worker] tokenId=${job.tokenId} ready -> ${uri}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] tokenId=${job.tokenId} failed:`, message);
    await setModelStatus(job.chainId, job.tokenId, "failed", { error: message.slice(0, 500) });
    await sendAlert(`3D model generation failed for token ${job.tokenId}:\n${message.slice(0, 500)}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log(`[worker] starting — blender=${BLENDER_BIN} pollMs=${POLL_MS}`);
  console.log(`[worker] assemble script: ${ASSEMBLE_SCRIPT}`);

  let running = true;
  const stop = () => {
    console.log("[worker] shutting down...");
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (running) {
    const job = await dequeueModelJob().catch((err) => {
      console.error("[worker] dequeue failed:", err);
      return null;
    });

    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }

    // A retry (or a duplicate enqueue) landing on a tokenId that's already
    // ready is a no-op cost-saver, not a correctness issue — skip it.
    const existing = await getModelStatus(job.chainId, job.tokenId).catch(() => null);
    if (existing?.status === "ready") {
      console.log(`[worker] tokenId=${job.tokenId} already ready, skipping`);
      continue;
    }

    await processJob(job);
  }
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
