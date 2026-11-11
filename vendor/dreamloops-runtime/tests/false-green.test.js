// False-Green corpus for the hardened runner. Each test targets one way a
// mission could report a stronger truth state than it actually earned.
// These are not happy-path tests — a passing suite here means the runner
// FAILS CLOSED (or reconciles honestly) in each adversarial case, not that
// it "worked."
import assert from "node:assert/strict";
import test from "node:test";
import {
  DreamLoopRunner,
  MemoryStateStore,
  capsuleContentHash,
  IdempotencyConflictError,
} from "../src/index.js";

function capsule(allowed) {
  const manifest = {
    schema: "dreamnet.synergy_capsule.v1",
    capsule_id: "false-green-capsule-v1",
    name: "False-Green Test Capsule",
    version: "1.0.0",
    capsule_type: "test",
    status: "active",
    purpose: "Exercise adversarial DreamLoop paths.",
    payload: {},
    permissions: { allowed, blocked: [] },
    resource_limits: { max_wall_time_ms: 5000, max_steps: 10, max_retries_per_step: 5 },
    activation: { mode: "manual", rollback_version: "0.0.0" },
    provenance: {},
  };
  manifest.provenance = { content_hash: capsuleContentHash(manifest) };
  return manifest;
}

function loop({ steps, checks = [] }) {
  return {
    schema: "dreamnet.dreamloop.v1",
    loop_id: "false-green-loop-v1",
    title: "False-Green Test Loop",
    version: "1.0.0",
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

// A stand-in for Warper Keeper (or any external effect system): keyed
// strictly by idempotency key, so calling it twice with the same key never
// produces a second real effect — this is what "idempotent effect" means
// operationally, not just as a word in a receipt.
function mockExternalSystem() {
  const byKey = new Map();
  return {
    byKey,
    async submit(idempotencyKey, payload) {
      const existing = byKey.get(idempotencyKey);
      if (existing) return { ...existing.result, replay: true };
      const result = { receiptId: `rcpt_${idempotencyKey}`, echoedPayload: payload };
      byKey.set(idempotencyKey, { result, payload });
      return result;
    },
  };
}

test("duplicate top-level invocation does not re-invoke an already-executed step", async () => {
  let calls = 0;
  const store = new MemoryStateStore();
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => { calls += 1; return { submitted: true }; } },
    stateStore: store,
  });
  const theLoop = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }] });
  const theCapsule = capsule(["artifact.submit"]);

  const first = await runner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:dup-1", input: { x: 1 } });
  assert.equal(first.execution, "EXECUTED");
  assert.equal(calls, 1);

  const second = await runner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:dup-1", input: { x: 1 } });
  assert.equal(second.execution, "EXECUTED");
  assert.equal(calls, 1, "handler must not be invoked again for a step already durably EXECUTED");
  assert.equal(second.steps[0].status, "skipped_already_executed");
});

test("crash after remote effect but before local checkpoint reconciles without duplicating the effect", async () => {
  const external = mockExternalSystem();
  const store = new MemoryStateStore();
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit", with: { battleId: "b1" }, retry: { max_attempts: 1 } }],
  });

  // First "process": the handler performs the real external effect, then
  // the process dies before it can return (simulated by throwing right
  // after the effect landed). The runner sees this as a step FAILURE — it
  // has no way to know the effect actually landed, which is realistic: a
  // crash mid-flight looks identical to a failed call from the caller's side.
  let crashedAfterRealEffect = false;
  const crashingRunner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: {
      submit: async ({ input, idempotencyKey }) => {
        await external.submit(idempotencyKey, input);
        crashedAfterRealEffect = true;
        throw new Error("simulated process death after remote write, before checkpoint");
      },
    },
    // The store is what makes this a real crash-recovery test rather than
    // an ephemeral one: the intent persisted before the handler ran survives
    // the "crash" because it was checkpointed to durable state, not memory
    // local to this runner instance.
    stateStore: store,
  });
  await assert.rejects(() => crashingRunner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:crash-1" }));
  assert.equal(crashedAfterRealEffect, true);
  assert.equal(external.byKey.size, 1, "the real effect did land exactly once before the crash");

  // "Restart": a fresh runner instance, same durable store, same stateKey,
  // handler now behaves (models the underlying transient problem being
  // gone). It must reuse the SAME idempotency key the first attempt used —
  // not mint a new one — so the external system recognizes the replay and
  // does not create a second real effect.
  const restartedRunner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: {
      submit: async ({ input, idempotencyKey }) => external.submit(idempotencyKey, input),
    },
    stateStore: store,
  });

  const resumed = await restartedRunner.run({ capsule: theCapsule, loop: theLoop, stateKey: "mission:crash-1" });
  assert.equal(resumed.execution, "EXECUTED");
  assert.equal(external.byKey.size, 1, "reconciliation must not create a second real effect for the same idempotency key");
  const [[, record]] = external.byKey;
  assert.equal(record.result.replay, undefined, "first real write");
});

test("same idempotency key with a different payload is refused, not silently resubmitted", async () => {
  const store = new MemoryStateStore();
  const theCapsule = capsule(["artifact.submit"]);
  let handlerCalls = 0;

  const failingRunner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: {
      submit: async () => {
        handlerCalls += 1;
        // VALIDATION-classified (not TRANSIENT) so it fails without retrying,
        // leaving behind an intent with no successful outcome.
        throw new Error("must be a valid battle id");
      },
    },
    stateStore: store,
  });
  const loopA = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit", with: { battleId: "battle-A" } }] });
  await assert.rejects(() => failingRunner.run({ capsule: theCapsule, loop: loopA, stateKey: "mission:conflict-1" }));
  assert.equal(handlerCalls, 1);

  const loopB = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit", with: { battleId: "battle-B" } }] });
  await assert.rejects(
    () => failingRunner.run({ capsule: theCapsule, loop: loopB, stateKey: "mission:conflict-1" }),
    (error) => {
      assert.ok(error instanceof IdempotencyConflictError);
      assert.equal(error.classification, "CONFLICT");
      return true;
    }
  );
  assert.equal(handlerCalls, 1, "the handler must never be invoked for a payload conflicting with an existing intent");
});

test("401/expired authority fails closed on the first attempt, never retried", async () => {
  let attempts = 0;
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: {
      submit: async () => {
        attempts += 1;
        // The exact shape the real Warper Keeper gateway returns for an
        // unauthenticated/unauthorized call (verified live, 2026-08-22).
        throw new Error('{"ok":false,"error":"assignment_key_required","status":401}');
      },
    },
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit", retry: { max_attempts: 5 } }] });

  await assert.rejects(() => runner.run({ capsule: theCapsule, loop: theLoop }), (error) => {
    assert.equal(error.receipt.errorClassification, "AUTHORIZATION");
    return true;
  });
  assert.equal(attempts, 1, "an authorization failure must not be retried even though max_attempts allowed 5");
});

test("a transient failure is retried with backoff and can still succeed", async () => {
  let attempts = 0;
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: {
      submit: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("ETIMEDOUT: connection reset");
        return { submitted: true };
      },
    },
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit", retry: { max_attempts: 2 } }] });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.execution, "EXECUTED");
  assert.equal(attempts, 2);
  assert.equal(receipt.steps[0].classification, "TRANSIENT");
});

test("bad hash / verifier rejection: EXECUTED does not imply verified", async () => {
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ receiptHash: "sha256:aaaa" }) },
    verifiers: { hash_matches: async ({ stepResult }) => ({ verified: stepResult.receiptHash === "sha256:bbbb", reason: "canonical hash mismatch" }) },
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }],
    checks: [{ id: "verify_hash", step_id: "submit_artifact", verifier: "hash_matches" }],
  });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.execution, "EXECUTED", "the step itself really did run without throwing");
  assert.equal(receipt.verification, "REJECTED", "a hash mismatch must reject verification, not silently pass");
  assert.notEqual(receipt.verification, "LOCALLY_VERIFIED");
});

test("verification unavailable (verifier throws) is distinct from verifier rejection", async () => {
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ ok: true }) },
    verifiers: { flaky: async () => { throw new Error("verifier network unreachable"); } },
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }],
    checks: [{ id: "verify_it", step_id: "submit_artifact", verifier: "flaky" }],
  });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.verification, "UNVERIFIED", "an unreachable verifier is 'we don't know', not 'no'");
  assert.notEqual(receipt.verification, "REJECTED");
  assert.equal(receipt.checks[0].unavailable, true);
});

test("a declared check with no registered verifier stays UNVERIFIED, not silently promoted", async () => {
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ ok: true }) },
    // no verifiers registered at all
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }],
    checks: [{ id: "verify_it", step_id: "submit_artifact", verifier: "nonexistent_verifier" }],
  });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.verification, "UNVERIFIED");
  assert.equal(receipt.checks[0].outcome, "unavailable");
});

test("a same-process verifier claiming independence is capped at LOCALLY_VERIFIED without explicit attestation", async () => {
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ ok: true }) },
    verifiers: { self_reporting: async () => ({ verified: true, independent: true }) },
    // attestIndependentVerifiers defaults to false
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }],
    checks: [{ id: "verify_it", step_id: "submit_artifact", verifier: "self_reporting" }],
  });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.verification, "LOCALLY_VERIFIED", "a verifier's own claim of independence is not evidence of independence");
  assert.notEqual(receipt.verification, "INDEPENDENTLY_VERIFIED");
});

test("an attested independent verifier can actually reach INDEPENDENTLY_VERIFIED", async () => {
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ ok: true }) },
    verifiers: { real_independent: async () => ({ verified: true, independent: true }) },
    attestIndependentVerifiers: true,
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }],
    checks: [{ id: "verify_it", step_id: "submit_artifact", verifier: "real_independent" }],
  });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.verification, "INDEPENDENTLY_VERIFIED");
});

test("application success with no declared check reports EXECUTED / UNVERIFIED / effect UNKNOWN — never COMPLETE", async () => {
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ ok: true }) }, // no __effect reported
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }] });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.execution, "EXECUTED");
  assert.equal(receipt.verification, "UNVERIFIED");
  assert.equal(receipt.effect, "UNKNOWN", "a returned promise is an application ACK, not proof the effect happened");
  assert.equal("status" in receipt, false, "there is no blanket 'completed'/'status' field to misread as done");
});

test("a handler that explicitly reports an observed effect can move effect past UNKNOWN", async () => {
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: { submit: async () => ({ ok: true, __effect: "OBSERVED" }) },
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({ steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit" }] });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.effect, "OBSERVED");
});

test("a timeout is classified TRANSIENT and retried (using the runner's own real timeout wording)", async () => {
  // Exercises classifyError against the exact message the runner's own
  // internal AbortController timeout produces (`${step.id} timed out`,
  // runner.js's per-attempt timer) rather than racing a real clock here,
  // which would make this test's timing fragile without adding coverage —
  // the real-clock abort path itself is exercised structurally by every
  // other test that runs a step at all.
  let attempts = 0;
  const runner = new DreamLoopRunner({
    grantedPermissions: ["artifact.submit"],
    handlers: {
      submit: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("submit_artifact timed out");
        return { ok: true };
      },
    },
  });
  const theCapsule = capsule(["artifact.submit"]);
  const theLoop = loop({
    steps: [{ id: "submit_artifact", handler: "submit", permission: "artifact.submit", retry: { max_attempts: 2 } }],
  });

  const receipt = await runner.run({ capsule: theCapsule, loop: theLoop });
  assert.equal(receipt.execution, "EXECUTED");
  assert.equal(receipt.steps[0].classification, "TRANSIENT");
  assert.equal(attempts, 2);
});
