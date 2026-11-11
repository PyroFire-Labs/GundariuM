import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { validateCapsule, validateDreamLoop } from "@dreamloops/runtime";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roscoDir = path.join(root, ".rosco");
const capsulePath = path.join(roscoDir, "rosco-session.capsule.json");
const loopPath = path.join(roscoDir, "rosco-session-start.dreamloop.json");
const runnerPath = path.join(root, "scripts/run-rosco-session.mjs");
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const pass = (message) => console.log(`PASS ${message}`);
const execFile = promisify(execFileCallback);

function validateSchema(value, schema, at = "$", errors = []) {
  if (schema.const !== undefined && value !== schema.const) errors.push(`${at}: expected ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: value is outside enum`);
  if (schema.type === "string") {
    if (typeof value !== "string") errors.push(`${at}: expected string`);
    else if (value.length < (schema.minLength ?? 0)) errors.push(`${at}: string is too short`);
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) errors.push(`${at}: expected array`);
    else value.forEach((item, index) => validateSchema(item, schema.items ?? {}, `${at}[${index}]`, errors));
  } else if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push(`${at}: expected object`);
    else {
      for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${at}: missing ${key}`);
      const properties = schema.properties ?? {};
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) if (!(key in properties)) errors.push(`${at}: unexpected ${key}`);
      }
      for (const [key, child] of Object.entries(properties)) {
        if (key in value) validateSchema(value[key], child, `${at}.${key}`, errors);
      }
    }
  }
  return errors;
}

function runLocalRunner() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerPath], {
      cwd: root,
      // The runner needs PATH to invoke local Git. Do not pass wallet/provider credentials.
      env: { PATH: process.env.PATH ?? "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) return reject(new Error(`session-start exited ${code}: ${stderr || stdout}`));
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`session-start did not return JSON: ${stderr || stdout}`)); }
    });
  });
}

async function verifyOfflineCleanCheckoutInstall() {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "rosco-runtime-clean-checkout-"));
  try {
    await fs.mkdir(path.join(fixture, "vendor"), { recursive: true });
    await fs.cp(path.join(root, "vendor/dreamloops-runtime"), path.join(fixture, "vendor/dreamloops-runtime"), { recursive: true });
    await fs.writeFile(path.join(fixture, "package.json"), JSON.stringify({
      private: true,
      type: "module",
      devDependencies: { "@dreamloops/runtime": "file:vendor/dreamloops-runtime" },
    }, null, 2));
    await execFile("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: fixture,
      env: { PATH: process.env.PATH ?? "", npm_config_offline: "true" },
      timeout: 30000,
    });
    const installed = await readJson(path.join(fixture, "node_modules/@dreamloops/runtime/package.json"));
    if (installed.name !== "@dreamloops/runtime" || installed.version !== "0.1.0") {
      throw new Error("Clean-checkout fixture resolved an unexpected DreamLoops runtime package");
    }
    await execFile(process.execPath, ["--input-type=module", "-e", "import { validateCapsule, validateDreamLoop } from '@dreamloops/runtime'; if (typeof validateCapsule !== 'function' || typeof validateDreamLoop !== 'function') process.exit(1)"], {
      cwd: fixture,
      env: { PATH: process.env.PATH ?? "" },
      timeout: 10000,
    });
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
}

const capsule = await readJson(capsulePath);
validateCapsule(capsule);
pass("1 Capsule validation");

const loop = await readJson(loopPath);
validateDreamLoop(loop);
if (loop.status !== "draft") throw new Error(`Expected draft loop, found ${loop.status}`);
pass("2 DreamLoop validation (status remains draft)");

const packageJson = await readJson(path.join(root, "package.json"));
const lock = await readJson(path.join(root, "package-lock.json"));
const runtimeSpec = packageJson.devDependencies?.["@dreamloops/runtime"];
const lockRuntime = lock.packages?.["vendor/dreamloops-runtime"];
if (runtimeSpec !== "file:vendor/dreamloops-runtime" || !lockRuntime) {
  throw new Error("DreamLoops runtime is not resolved from the tracked repository vendor directory");
}
if (Object.keys(lock.packages ?? {}).some((key) => key.includes("everythingDreamNet") || key.startsWith("../"))) {
  throw new Error("package-lock.json contains a sibling or parent filesystem dependency");
}
await fs.access(path.join(root, "vendor/dreamloops-runtime/package.json"));
await verifyOfflineCleanCheckoutInstall();
console.log("PORTABILITY isolated clean-checkout fixture installed and imported the vendored runtime with npm offline mode");

const runtimeBefore = await fs.readdir(path.join(roscoDir, "receipts"));
const runtimeResult = await runLocalRunner();
if (runtimeResult.execution !== "EXECUTED" || runtimeResult.executionMode !== "local") {
  throw new Error(`Expected successful local execution, got ${runtimeResult.execution}/${runtimeResult.executionMode}`);
}
if ((runtimeResult.steps ?? []).some((step) => step.status !== "executed") || runtimeResult.steps?.length !== loop.steps.length) {
  throw new Error("One or more session-start steps did not execute");
}
pass("3 Successful local session-start execution");

const schema = await readJson(path.join(roscoDir, "receipts/receipt.schema.json"));
const runtimeAfter = await fs.readdir(path.join(roscoDir, "receipts"));
const newReceipts = runtimeAfter.filter((name) => name.endsWith("-session-start.json") && !runtimeBefore.includes(name));
if (newReceipts.length !== 1) throw new Error(`Expected one fresh Rosco receipt, found ${newReceipts.length}`);
const receiptName = newReceipts[0];
const receipt = await readJson(path.join(roscoDir, "receipts", receiptName));
const schemaErrors = validateSchema(receipt, schema, receiptName);
if (schemaErrors.length) throw new Error(schemaErrors.join("\n"));
if (receipt.effect?.status !== "NONE" || receipt.authority?.status !== "NOT_REQUIRED") {
  throw new Error("Session receipt does not record the expected local-only, no-effect boundary");
}
pass(`4 Rosco receipt-schema validation (${receiptName})`);

const markdownFiles = [];
async function collectMarkdown(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectMarkdown(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".md")) markdownFiles.push(fullPath);
  }
}
await collectMarkdown(roscoDir);
const brokenLinks = [];
for (const file of markdownFiles) {
  const source = await fs.readFile(file, "utf8");
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().split(/\s+/, 1)[0].replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|tel:|#)/i.test(target)) continue;
    const localTarget = decodeURIComponent(target.split(/[?#]/, 1)[0]);
    if (!localTarget) continue;
    try { await fs.access(path.resolve(path.dirname(file), localTarget)); }
    catch { brokenLinks.push(`${path.relative(root, file)}: ${target}`); }
  }
}
if (brokenLinks.length) throw new Error(`Broken local Markdown links:\n${brokenLinks.join("\n")}`);
pass(`5 Markdown-link validation (${markdownFiles.length} Rosco Markdown files)`);

const runnerSource = await fs.readFile(runnerPath, "utf8");
const blocked = ["cloud.mutate", "contract.write", "deployment.production.write", "package.install", "public.publish", "secret.value.read", "self.modify.live", "signer.change", "wallet.sign"];
const localPermissions = ["context.local.read", "task.local.read", "repository.status.read", "repository.head.read", "receipt.local.write"];
for (const action of localPermissions) {
  if (!loop.allowed_actions.includes(action) || !capsule.permissions.allowed.includes(action)) throw new Error(`Missing local-only permission ${action}`);
}
for (const action of blocked) {
  if (!loop.blocked_actions.includes(action) || !capsule.permissions.blocked.includes(action)) throw new Error(`Missing blocked action ${action}`);
}
if (loop.status !== "draft" || loop.trigger !== "manual start of a Rosco GundariuM session") throw new Error("Loop is not manual and draft-only");
if (/\b(?:fetch\s*\(|https?\.request\s*\(|process\.env\b|node:(?:http|https|net|tls|dgram))/m.test(runnerSource)) {
  throw new Error("Runner source contains a network or credential-environment access path");
}
if (!runnerSource.includes('execFile(\n        "git"')) throw new Error("Runner local Git invocation is not the expected read-only command path");
if (!runnerSource.includes('executionMode: "local"')) throw new Error("Runner is not configured for local execution");
pass("6 No external network, deployment, wallet, contract, or credentialed action (static boundary + sanitized environment)");

console.log(`Receipt: .rosco/receipts/${receiptName}`);
console.log("Runtime dependency: file:vendor/dreamloops-runtime (tracked, repository-relative)");
