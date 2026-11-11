import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DreamLoopRunner, FileStateStore, MemoryStateStore, composeCapsules, validateCapsule, validateDreamLoop } from "../src/index.js";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const kitRoot = path.join(repositoryRoot, "starter-kits", "persistent-agent");

async function manifests(folder, name) {
  const results = [];
  for (const entry of await fs.readdir(path.join(kitRoot, folder), { withFileTypes: true })) {
    if (entry.isDirectory()) results.push(JSON.parse(await fs.readFile(path.join(kitRoot, folder, entry.name, name), "utf8")));
  }
  return results;
}

test("all starter Capsules compose and all DreamLoops execute in dry-run mode", async () => {
  const capsules = await manifests("capsules", "capsule.manifest.json");
  const loops = await manifests("dreamloops", "dreamloop.manifest.json");
  capsules.forEach((item) => validateCapsule(item));
  loops.forEach((item) => validateDreamLoop(item));
  const base = capsules.find((item) => item.capsule_id === "persistent-agent-base-v1");
  const composed = composeCapsules(base, capsules.filter((item) => item !== base), { capsuleId: "test-composed-v1" });

  for (const loop of loops) {
    const handlers = Object.fromEntries(loop.steps.map((item) => [item.handler, async () => ({ [item.id]: "simulated" })]));
    const store = new MemoryStateStore();
    const runner = new DreamLoopRunner({ handlers, grantedPermissions: loop.allowed_actions, stateStore: store });
    const receipt = await runner.run({ capsule: composed, loop, stateKey: loop.loop_id, executionMode: "dry_run" });
    assert.equal(receipt.execution, "EXECUTED", loop.loop_id);
    assert.equal((await store.get(loop.loop_id))[loop.steps.at(-1).id], "simulated");
    assert.equal(store.receipts.length, 1);
  }
});

test("FileStateStore persists atomically and excludes working state from durable receipts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dreamloops-state-"));
  const store = new FileStateStore({ directory });
  await store.put("agent:one", { currentTask: "research" });
  assert.deepEqual(await store.get("agent:one"), { currentTask: "research" });
  assert.deepEqual(await store.list(), ["agent:one"]);
  await store.appendReceipt({ receiptId: "r1", state: { privateWorkingContext: true } });
  const receiptFile = path.join(directory, "receipts", `${new Date().toISOString().slice(0, 10)}.jsonl`);
  const saved = JSON.parse((await fs.readFile(receiptFile, "utf8")).trim());
  assert.equal(saved.receiptId, "r1");
  assert.equal("state" in saved, false);
});
