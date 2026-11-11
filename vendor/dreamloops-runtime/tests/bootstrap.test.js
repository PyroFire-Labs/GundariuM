import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DreamLoopRunner, capsuleContentHash, validateCapsule, validateDreamLoop } from "../src/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = (path) => JSON.parse(fs.readFileSync(`${root}/${path}`, "utf8"));

function sealedCapsule() {
  const capsule = readJson("examples/persistent-agent-stack/capsule.manifest.json");
  assert.equal(capsule.provenance.content_hash, capsuleContentHash(capsule));
  return capsule;
}

test("the example Capsule and DreamLoop validate as executable contracts", () => {
  const capsule = sealedCapsule();
  const loop = readJson("examples/persistent-agent-heartbeat/dreamloop.manifest.json");
  assert.equal(validateCapsule(capsule), capsule);
  assert.equal(validateDreamLoop(loop), loop);
});

test("the runner executes only registered, granted handlers and emits receipts", async () => {
  const runner = new DreamLoopRunner({
    grantedPermissions: ["runtime.health.read", "artifact.local.write"],
    handlers: {
      "runtime.health.read": async () => ({ health: "ok" }),
      "artifact.local.write": async ({ state }) => ({ evidence: `health:${state.health}` }),
    },
  });
  const receipt = await runner.run({
    capsule: sealedCapsule(),
    loop: readJson("examples/persistent-agent-heartbeat/dreamloop.manifest.json"),
  });
  // "completed" is deliberately not a state anymore — see truth-state.js.
  // EXECUTED means every step ran without a fatal error; it says nothing
  // about verification or effect, which stay at their honest defaults here
  // since this loop declares no checks.
  assert.equal(receipt.execution, "EXECUTED");
  assert.equal(receipt.verification, "UNVERIFIED");
  assert.equal(receipt.effect, "UNKNOWN");
  assert.equal(receipt.steps.length, 2);
  assert.equal(receipt.state.evidence, "health:ok");
});

test("an unknown handler fails closed", async () => {
  const loop = readJson("examples/persistent-agent-heartbeat/dreamloop.manifest.json");
  loop.steps[0].handler = "arbitrary.shell.execute";
  const runner = new DreamLoopRunner({ grantedPermissions: loop.allowed_actions });
  await assert.rejects(() => runner.run({ capsule: sealedCapsule(), loop }), /unregistered handler/);
});

test("missing runner permission fails closed", async () => {
  const loop = readJson("examples/persistent-agent-heartbeat/dreamloop.manifest.json");
  const runner = new DreamLoopRunner({
    grantedPermissions: ["runtime.health.read"],
    handlers: {
      "runtime.health.read": async () => ({ health: "ok" }),
      "artifact.local.write": async () => ({ evidence: "written" }),
    },
  });
  await assert.rejects(() => runner.run({ capsule: sealedCapsule(), loop }), /runner was not granted permission/);
});

test("blocked Capsule permissions override the loop", async () => {
  const capsule = sealedCapsule();
  capsule.permissions.blocked.push("runtime.health.read");
  capsule.permissions.allowed = capsule.permissions.allowed.filter((permission) => permission !== "runtime.health.read");
  capsule.provenance.content_hash = capsuleContentHash(capsule);
  const loop = readJson("examples/persistent-agent-heartbeat/dreamloop.manifest.json");
  const runner = new DreamLoopRunner({
    grantedPermissions: loop.allowed_actions,
    handlers: { "runtime.health.read": async () => ({ health: "ok" }) },
  });
  await assert.rejects(() => runner.run({ capsule, loop }), /capsule blocks permission/);
});
