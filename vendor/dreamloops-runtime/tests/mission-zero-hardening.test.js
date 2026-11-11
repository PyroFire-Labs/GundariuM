// Adversarial corpus for the append-only evidence ledger and the guards
// built on top of it (concurrency, tamper-evidence, definition drift,
// authority revocation). Companion to false-green.test.js: that file targets
// ways a mission could CLAIM a stronger truth state than it earned; this
// file targets ways the ledger itself could be raced, corrupted, or resumed
// against a moving target.
import assert from "node:assert/strict";
import test from "node:test";
import {
  DreamLoopRunner,
  MemoryStateStore,
  capsuleContentHash,
  LedgerConflictError,
  DriftDetectedError,
  missionLedgerKey,
  verifyEvidenceChain,
} from "../src/index.js";

function capsule(allowed, overrides = {}) {
  const manifest = {
    schema: "dreamnet.synergy_capsule.v1",
    capsule_id: "hardening-capsule-v1",
    name: "Hardening Test Capsule",
    version: "1.0.0",
    capsule_type: "test",
    status: "active",
    purpose: "Exercise adversarial ledger paths.",
    payload: {},
    permissions: { allowed, blocked: [] },
    resource_limits: { max_wall_time_ms: 5000, max_steps: 10, max_retries_per_step: 5 },
    activation: { mode: "manual", rollback_version: "0.0.0" },
    provenance: {},
    ...overrides,
  };
  manifest.provenance = { content_hash: capsuleContentHash(manifest) };
  return manifest;
}

function loop({ steps, checks = [], version = "1.0.0" }) {
  return {
    schema: "dreamnet.dreamloop.v1",
    loop_id: "hardening-loop-v1",
    title: "Hardening Test Loop",
    version,
    status: "active_local",
    owner: "test-harness",
    stewards: [],
    permission_tier: "live_guarded_action",
    trigger: "manual",
    inputs: [],
    context_sources: [],
    allowed_actions: [...new Set(steps.map((step) => step.permission))],
    blocked_actions: [],
    checks,
    evidence_outputs: [],
    receipt_outputs: [],
    knowledge_state_outputs: [],
    execution_trace_outputs: [],
    memory_routes: [],
    cooldown: "PT0S",
    failure_modes: [],
    promotion_path: "n/a",
    last_reviewed: "2026-08-22",
    limits: { max_wall_time_ms: 5000, max_steps: 10, max_retries_per_step: 5 },
    steps,
  };
}

test("concurrent runners racing the same mission: the loser gets a CONFLICT-classified LedgerConflictError, not silent corruption", async () => {
  const store = new MemoryStateStore();
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }] });
  const makeRunner = () =>
    new DreamLoopRunner({
      grantedPermissions: ["artifact.submit"],
      handlers: { submit: async () => ({ ok: true }) },
      stateStore: store,
    });

  const runnerA = makeRunner();
  const runnerB = makeRunner();

  // Both start against the SAME fresh mission at (nearly) the same instant —
  // no coordination beyond both racing the same store/stateKey. Node's
  // single-threaded microtask ordering makes this deterministic here (both
  // walk a structurally identical await sequence with no timers before the
  // first checkpoint), but the property under test — one wins, one gets a
  // clean CONFLICT, never a silent merge — is the real point, not the timing.
  const results = await Promise.allSettled([
    runnerA.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:race-1" }),
    runnerB.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:race-1" }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1, "exactly one racing runner must win and complete the mission");
  assert.equal(rejected.length, 1, "exactly one racing runner must lose and fail cleanly");
  assert.equal(fulfilled[0].value.execution, "EXECUTED");

  const loserError = rejected[0].reason;
  assert.ok(loserError instanceof LedgerConflictError, `loser must fail with LedgerConflictError, got ${loserError?.constructor?.name}: ${loserError?.message}`);
  assert.equal(loserError.classification, "CONFLICT");

  // The ledger itself must reflect exactly one coherent mission, not a
  // merge of both runners' partial progress.
  const ledger = await store.get(missionLedgerKey("mission:race-1"));
  assert.equal(ledger.execution, "EXECUTED");
  assert.equal(Object.keys(ledger.steps).length, 1);
});

test("checkpoint tampering: editing a persisted evidence entry breaks the hash chain at exactly that entry", async () => {
  const store = new MemoryStateStore();
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }],
    checks: [{ id: "verify_it", step_id: "submit_artifact", verifier: "always_ok" }],
  });
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ ok: true }) },
    verifiers: { always_ok: async () => ({ verified: true }) },
    stateStore: store,
  });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:tamper-1" });
  assert.equal(receipt.execution, "EXECUTED");

  const ledger = await store.get(missionLedgerKey("mission:tamper-1"));
  const entry = ledger.steps.submit_artifact;
  assert.ok(entry.evidence.length >= 3, "expect intent + attempt + at least one verification evidence entry");

  const untampered = verifyEvidenceChain(entry.evidence);
  assert.equal(untampered.valid, true, "an honestly-persisted evidence log must verify clean");

  // Simulate corruption: an attacker (or a bug) edits an already-persisted
  // evidence entry's `reason` field in place — exactly the kind of rewrite
  // the append-only design exists to make detectable.
  const tamperedSeq = 1;
  const tampered = structuredClone(ledger);
  tampered.steps.submit_artifact.evidence[tamperedSeq] = {
    ...tampered.steps.submit_artifact.evidence[tamperedSeq],
    reason: "not what actually happened",
  };
  await store.put(missionLedgerKey("mission:tamper-1"), tampered);

  const reloaded = await store.get(missionLedgerKey("mission:tamper-1"));
  const verdict = verifyEvidenceChain(reloaded.steps.submit_artifact.evidence);
  assert.equal(verdict.valid, false, "a tampered entry must be detected, not silently trusted");
  assert.equal(verdict.brokenAtSeq, tamperedSeq, "the chain must break AT the tampered entry, pinpointing it");

  // Tampering with one entry must not retroactively invalidate entries
  // BEFORE it — the chain is only broken from the tampered point forward.
  const untouchedPrefix = verifyEvidenceChain(reloaded.steps.submit_artifact.evidence.slice(0, tamperedSeq));
  assert.equal(untouchedPrefix.valid, true, "entries before the tampered one must still verify clean on their own");
});

test("verifier death on re-verification: a prior LOCALLY_VERIFIED result is preserved in evidence even though re-check goes UNVERIFIED", async () => {
  const store = new MemoryStateStore();
  const theCapsule = capsule(["artifact.submit"]);
  let verifierAlive = true;
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }],
    checks: [{ id: "verify_it", step_id: "submit_artifact", verifier: "flaky" }],
  });
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ ok: true }) },
    verifiers: {
      flaky: async () => {
        if (!verifierAlive) throw new Error("verifier process died mid-check");
        return { verified: true };
      },
    },
    stateStore: store,
  });

  const first = await runner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:verifier-death-1" });
  assert.equal(first.verification, "LOCALLY_VERIFIED");

  // The verifier "dies" before the mission is re-checked (e.g. a resume
  // after a crash, or a scheduled re-validation pass).
  verifierAlive = false;
  const second = await runner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:verifier-death-1" });
  assert.equal(second.verification, "UNVERIFIED", "current claim must honestly downgrade — we no longer know");
  assert.notEqual(second.verification, "REJECTED", "a dead verifier is 'unknown', not 'it said no'");

  // The append-only requirement: the EARLIER LOCALLY_VERIFIED evidence must
  // still be there, untouched — re-verification adds a new entry, it does
  // not rewrite or delete the old one.
  const ledger = await store.get(missionLedgerKey("mission:verifier-death-1"));
  const entry = ledger.steps.submit_artifact;
  const chain = verifyEvidenceChain(entry.evidence);
  assert.equal(chain.valid, true);
  const verificationKinds = entry.evidence.filter((e) => e.kind === "verification").map((e) => e.to);
  assert.ok(verificationKinds.includes("LOCALLY_VERIFIED"), "history must retain the earlier successful verification");
  assert.ok(verificationKinds.includes("UNVERIFIED"), "history must also retain the later failed re-verification");
  assert.equal(verificationKinds.at(-1), "UNVERIFIED", "the CURRENT (most recent) state must be the honest one");
});

test("handler/version drift across resume: a changed loop version underneath an open intent is refused, not silently continued", async () => {
  const store = new MemoryStateStore();
  let calls = 0;
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: {
      submit: async () => {
        calls += 1;
        throw new Error("must be a valid battle id"); // VALIDATION, not retried — leaves intent behind with outcome FAILED
      },
    },
    stateStore: store,
  });
  const theCapsule = capsule(["artifact.submit"]);
  const loopV1 = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }], version: "1.0.0" });

  await assert.rejects(() => runner.run({ capsule: theCapsule, loop: loopV1, stateKey: "mission:drift-1" }));
  assert.equal(calls, 1);

  // Resume against a DIFFERENT loop version for the same in-flight step.
  const loopV2 = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }], version: "1.1.0" });
  await assert.rejects(
    () => runner.run({ capsule: theCapsule, loop: loopV2, stateKey: "mission:drift-1" }),
    (error) => {
      assert.ok(error instanceof DriftDetectedError, `expected DriftDetectedError, got ${error?.constructor?.name}: ${error?.message}`);
      assert.equal(error.classification, "VALIDATION");
      assert.match(error.message, /loop version changed from 1\.0\.0 to 1\.1\.0/);
      return true;
    }
  );
  assert.equal(calls, 1, "the handler must never be invoked against a drifted definition");
});

test("authority revoked between intent and effect: a not-yet-executed step refuses to run under revoked authority, and never re-invokes the handler", async () => {
  const store = new MemoryStateStore();
  let calls = 0;
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: {
      submit: async () => {
        calls += 1;
        throw new Error("must be a valid battle id"); // VALIDATION — fails immediately, intent persists with outcome FAILED
      },
    },
    stateStore: store,
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }] });

  await assert.rejects(() => runner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:revoke-1", authority: { status: "AUTHORIZED" } }));
  assert.equal(calls, 1);

  // The authority backing this mission is revoked before the step ever
  // reaches a successful outcome. A resumed run() must refuse outright.
  await assert.rejects(
    () => runner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:revoke-1", authority: { status: "REVOKED" } }),
    (error) => {
      assert.equal(error.classification, "AUTHORIZATION");
      assert.match(error.message, /REVOKED/);
      return true;
    }
  );
  assert.equal(calls, 1, "the handler must never be invoked once authority is revoked, even for an already-open intent");

  const ledger = await store.get(missionLedgerKey("mission:revoke-1"));
  assert.equal(ledger.authority, "REVOKED");
  const authorityEvents = ledger.evidence.filter((e) => e.kind === "authority").map((e) => e.to);
  assert.deepEqual(authorityEvents, ["AUTHORIZED", "REVOKED"], "the full authority history must be recorded, not just the latest status");
  const chain = verifyEvidenceChain(ledger.evidence);
  assert.equal(chain.valid, true);
});
