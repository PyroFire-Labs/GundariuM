import crypto from "node:crypto";
import { validateCapsule, validateDreamLoop } from "./validate.js";
import {
  transitionExecution,
  transitionVerification,
  transitionEffect,
  transitionAuthority,
  classifyError,
  isRetryable,
  backoffDelayMs,
  IdempotencyConflictError,
  LedgerConflictError,
  DriftDetectedError,
  DreamLoopStepError,
} from "./truth-state.js";
import {
  missionLedgerKey,
  operationId,
  payloadHash,
  freshLedger,
  freshStepEntry,
  migrateLedger,
  appendEvidence,
  touch,
} from "./mission-ledger.js";
import { StateVersionConflictError } from "./state-store.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class DreamLoopRunner {
  constructor({ handlers = {}, verifiers = {}, grantedPermissions = [], stateStore, attestIndependentVerifiers = false } = {}) {
    this.handlers = new Map(Object.entries(handlers));
    // Verifiers are registered separately from handlers on purpose: a check
    // that runs through the same registration path as the thing it checks
    // is a same-process mock, not independent verification. Keeping the
    // registries apart is a small honesty device — it doesn't make a
    // verifier independent, but it stops them from being accidentally
    // conflated with execution handlers.
    this.verifiers = new Map(Object.entries(verifiers));
    this.grantedPermissions = new Set(grantedPermissions);
    this.stateStore = stateStore;
    // Even when a verifier self-reports { independent: true }, the runner
    // will not promote to INDEPENDENTLY_VERIFIED unless the caller also
    // attests, at construction time, that its verifiers really do run out
    // of process / under separate credentials. Default false: a same-process
    // mock is capped at LOCALLY_VERIFIED no matter what it claims about itself.
    this.attestIndependentVerifiers = attestIndependentVerifiers;
  }

  // Returns { ledger, version } — version is the store's current version for
  // this mission's ledger key (0 if it doesn't exist yet), captured at load
  // time so the first checkpoint can CAS against it.
  async #loadLedger({ stateKey, runId, loopId }) {
    if (!stateKey || !this.stateStore) return { ledger: freshLedger({ runId, loopId, stateKey }), version: 0 };
    const key = missionLedgerKey(stateKey);
    const existing = await this.stateStore.get(key);
    const version = this.stateStore.getVersion ? await this.stateStore.getVersion(key) : 0;
    if (!existing) return { ledger: freshLedger({ runId, loopId, stateKey }), version };
    migrateLedger(existing);
    // Loading a ledger whose execution was left "RUNNING" means the process
    // that owned it never reached a terminal state — that's exactly what
    // INTERRUPTED means. Detected here, not assumed anywhere else.
    if (existing.execution === "RUNNING") {
      const from = "RUNNING";
      existing.execution = transitionExecution(from, "INTERRUPTED", { evidence: "loaded a ledger with no terminal execution state from a prior run" });
      appendEvidence(existing.evidence, { kind: "execution", from, to: "INTERRUPTED", reason: "loaded a ledger with no terminal execution state from a prior run", runId });
    }
    existing.runId = runId; // this attempt's own runId; stepId identity below uses stateKey, not runId
    return { ledger: existing, version };
  }

  // Checkpoints the ledger with an optimistic-concurrency guard: if another
  // runner already advanced this mission's ledger past `expectedVersion`,
  // the store throws StateVersionConflictError, which is re-raised here as
  // a LedgerConflictError — a CONFLICT-classified, non-retryable failure.
  // Returns the new version on success (or `expectedVersion` unchanged for
  // an ephemeral run with no durable store to race against).
  async #checkpoint(ledger, businessState, { stateKey, expectedVersion }) {
    if (!stateKey || !this.stateStore) return expectedVersion; // ephemeral run — no durable checkpoint is possible, and none is claimed
    touch(ledger);
    let newVersion;
    try {
      newVersion = await this.stateStore.put(missionLedgerKey(stateKey), ledger, { expectedVersion });
    } catch (error) {
      if (error instanceof StateVersionConflictError) {
        throw new LedgerConflictError(
          `mission "${stateKey}": ledger was advanced by another runner (expected version ${error.expectedVersion}, found ${error.actualVersion}) — refusing to overwrite`,
          { cause: error }
        );
      }
      throw error;
    }
    await this.stateStore.put(stateKey, businessState);
    return newVersion;
  }

  async run({ capsule, loop, input = {}, executionMode = "mock", stateKey, authority = { status: "UNAUTHORIZED" } } = {}) {
    validateCapsule(capsule);
    validateDreamLoop(loop);
    const capsuleAllowed = new Set(capsule.permissions.allowed);
    const capsuleBlocked = new Set(capsule.permissions.blocked);
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const runId = `dlrun_${crypto.randomUUID()}`;
    const stepReceipts = [];
    const checkReceipts = [];

    const storedState = stateKey && this.stateStore ? await this.stateStore.get(stateKey) : undefined;
    let state = { ...(storedState && typeof storedState === "object" ? storedState : {}), ...structuredClone(input) };

    const { ledger, version: loadedVersion } = await this.#loadLedger({ stateKey, runId, loopId: loop.loop_id });
    let ledgerVersion = loadedVersion;
    ledger.execution = transitionExecution(ledger.execution, "RUNNING", { evidence: "run() invoked" });
    appendEvidence(ledger.evidence, { kind: "execution", from: "PENDING/INTERRUPTED/EXECUTED/FAILED", to: "RUNNING", reason: "run() invoked", runId });

    // Authority is tracked as ledger state, not just a per-call parameter —
    // this is what makes "authority revoked between intent and effect" a
    // detectable, auditable transition rather than something that only
    // exists in one call's stack frame. A caller passing the same status
    // repeatedly is a legal no-op (transitionAuthority allows current===next).
    const incomingAuthorityStatus = authority?.status || "UNAUTHORIZED";
    const priorAuthority = ledger.authority;
    if (incomingAuthorityStatus !== priorAuthority) {
      ledger.authority = transitionAuthority(priorAuthority, incomingAuthorityStatus, {
        evidence: `run() invoked with authority.status = ${incomingAuthorityStatus}`,
      });
      appendEvidence(ledger.evidence, { kind: "authority", from: priorAuthority, to: ledger.authority, reason: `run() invoked with authority.status = ${incomingAuthorityStatus}`, runId });
    }
    ledgerVersion = await this.#checkpoint(ledger, state, { stateKey, expectedVersion: ledgerVersion });

    const checksByStep = new Map();
    for (const check of loop.checks || []) {
      if (!check || !check.step_id) continue;
      if (!checksByStep.has(check.step_id)) checksByStep.set(check.step_id, []);
      checksByStep.get(check.step_id).push(check);
    }

    const finishReceipt = async (execution, error) => {
      const from = ledger.execution;
      ledger.execution = transitionExecution(ledger.execution, execution, { evidence: error ? error.message : "all steps resolved" });
      appendEvidence(ledger.evidence, { kind: "execution", from, to: execution, reason: error ? error.message : "all steps resolved", runId });
      ledgerVersion = await this.#checkpoint(ledger, state, { stateKey, expectedVersion: ledgerVersion });

      const receipt = {
        receiptId: `dlrcpt_${crypto.randomUUID()}`,
        runId,
        loopId: loop.loop_id,
        loopVersion: loop.version,
        capsuleId: capsule.capsule_id,
        capsuleVersion: capsule.version,
        executionMode,
        authority,
        execution: ledger.execution,
        verification: ledger.verification,
        effect: ledger.effect,
        startedAt,
        finishedAt: new Date().toISOString(),
        steps: stepReceipts,
        checks: checkReceipts,
        blockedActions: loop.blocked_actions,
        ...(error ? { error: error.message, errorClassification: classifyError(error) } : {}),
        state,
      };
      if (this.stateStore?.appendReceipt) await this.stateStore.appendReceipt(receipt);
      return receipt;
    };

    try {
      for (const step of loop.steps) {
        if (Date.now() - startedMs >= loop.limits.max_wall_time_ms) throw new Error("dreamloop wall-time ceiling reached");
        if (capsuleBlocked.has(step.permission)) throw new Error(`capsule blocks permission: ${step.permission}`);
        if (!capsuleAllowed.has(step.permission)) throw new Error(`capsule does not allow permission: ${step.permission}`);
        if (!this.grantedPermissions.has(step.permission)) throw new Error(`runner was not granted permission: ${step.permission}`);

        const handler = this.handlers.get(step.handler);
        if (!handler) throw new Error(`unregistered handler: ${step.handler}`);

        const opId = operationId({ stateKey, runId: ledger.runId, stepId: step.id });
        const intentInput = structuredClone(step.with || {});
        const hash = payloadHash(intentInput);
        const idempotencyKey = step.idempotency_key || opId;

        let entry = ledger.steps[step.id];

        // Already durably executed in a prior attempt at this same mission
        // (stateKey) — skip re-invoking the handler entirely. This is the
        // step-boundary equivalent of the old run-boundary "resume from
        // last completed run": now it's per step, not just per run.
        if (entry?.outcome === "EXECUTED") {
          state = entry.result && typeof entry.result === "object" ? { ...state, ...entry.result } : state;
          stepReceipts.push({ stepId: step.id, handler: step.handler, permission: step.permission, attempt: 0, status: "skipped_already_executed", opId });
        } else {
          const resuming = Boolean(entry?.intent);

          if (entry?.intent && entry.intent.payloadHash !== hash) {
            // Same idempotency key, different payload. This is the conflict
            // case the false-green corpus targets explicitly: never silently
            // resubmit under a reused key with different data.
            throw new IdempotencyConflictError(
              `step ${step.id}: idempotency key ${idempotencyKey} was already used with a different payload (existing ${entry.intent.payloadHash}, now ${hash}) — refusing to proceed`
            );
          }

          // Handler/version drift: this step's definition changed underneath
          // an intent that's still open from a prior attempt. Silently
          // continuing under the new definition would mean the resumed
          // execution isn't actually the one the persisted intent describes
          // — refuse instead of guessing which definition is authoritative.
          if (resuming) {
            const driftDetails = [];
            if (entry.intent.handler !== step.handler) driftDetails.push(`handler changed from "${entry.intent.handler}" to "${step.handler}"`);
            if (entry.intent.loopVersion !== loop.version) driftDetails.push(`loop version changed from ${entry.intent.loopVersion} to ${loop.version}`);
            if (entry.intent.capsuleVersion !== capsule.version) driftDetails.push(`capsule version changed from ${entry.intent.capsuleVersion} to ${capsule.version}`);
            if (driftDetails.length) {
              throw new DriftDetectedError(`step ${step.id}: definition drift detected across resume — ${driftDetails.join("; ")} — refusing to execute an intent against a changed definition`);
            }
          }

          // Authority gate: a step not yet executed must not be (re-)entered
          // if the CURRENT call's authority is REVOKED or EXPIRED — even if
          // the intent was originally created while AUTHORIZED. Effect/
          // verification of ALREADY-executed work is read-only and stays
          // unaffected; this only blocks NEW handler invocations.
          if (incomingAuthorityStatus === "REVOKED" || incomingAuthorityStatus === "EXPIRED") {
            throw new DreamLoopStepError(
              `step ${step.id}: authority is ${incomingAuthorityStatus} — refusing to execute under revoked/expired authority` +
                (resuming ? " (intent was created under different authority; execution was never completed)" : ""),
              { classification: "AUTHORIZATION" }
            );
          }

          // Intent-before-effect: persist what we are about to do BEFORE
          // doing it. If the process dies after this line but before the
          // outcome checkpoint below, the next run() sees an intent with no
          // outcome for this step — the signal that reconciliation, not a
          // blind resubmit, is needed.
          entry = ledger.steps[step.id] = entry || freshStepEntry();
          const isNewIntent = !entry.intent;
          entry.intent = entry.intent || {
            opId,
            idempotencyKey,
            payloadHash: hash,
            authorityRef: authority,
            intendedEffect: step.effect || step.handler,
            handler: step.handler,
            loopVersion: loop.version,
            capsuleVersion: capsule.version,
            createdAt: new Date().toISOString(),
          };
          if (isNewIntent) {
            appendEvidence(entry.evidence, { kind: "intent", stepId: step.id, opId, idempotencyKey, payloadHash: hash, runId });
          }
          ledgerVersion = await this.#checkpoint(ledger, state, { stateKey, expectedVersion: ledgerVersion });

          const maximumAttempts = Math.min(step.retry?.max_attempts || 1, loop.limits.max_retries_per_step + 1);
          let result;
          let lastError;

          for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
            try {
              const remaining = Math.max(1, loop.limits.max_wall_time_ms - (Date.now() - startedMs));
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(new Error(`${step.id} timed out`)), remaining);
              timer.unref?.();
              try {
                result = await Promise.race([
                  handler({
                    input: structuredClone(intentInput),
                    state: structuredClone(state),
                    executionMode,
                    signal: controller.signal,
                    idempotencyKey,
                    resuming: resuming && attempt === 1,
                  }),
                  new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true })),
                ]);
              } finally {
                clearTimeout(timer);
              }
              lastError = undefined;
              const classification = null;
              stepReceipts.push({ stepId: step.id, handler: step.handler, permission: step.permission, attempt, status: "executed", opId, classification });
              entry.attempts.push({ attempt, status: "executed", runId });
              appendEvidence(entry.evidence, { kind: "attempt", stepId: step.id, attempt, status: "executed", runId });
              break;
            } catch (error) {
              lastError = error;
              const classification = classifyError(error);
              stepReceipts.push({ stepId: step.id, handler: step.handler, permission: step.permission, attempt, status: "failed", error: error.message, classification, opId });
              entry.attempts.push({ attempt, status: "failed", classification, error: error.message, runId });
              appendEvidence(entry.evidence, { kind: "attempt", stepId: step.id, attempt, status: "failed", classification, error: error.message, runId });
              const attemptsRemain = attempt < maximumAttempts;
              if (!attemptsRemain || !isRetryable(classification)) break;
              await sleep(backoffDelayMs(attempt));
            }
          }

          if (lastError) {
            const from = entry.outcome;
            entry.outcome = "FAILED";
            appendEvidence(entry.evidence, { kind: "outcome", stepId: step.id, from, to: "FAILED", reason: lastError.message, runId });
            ledgerVersion = await this.#checkpoint(ledger, state, { stateKey, expectedVersion: ledgerVersion });
            throw lastError;
          }

          const outcomeFrom = entry.outcome;
          entry.outcome = "EXECUTED";
          appendEvidence(entry.evidence, { kind: "outcome", stepId: step.id, from: outcomeFrom, to: "EXECUTED", reason: "all attempts resolved without error", runId });
          entry.result = result && typeof result === "object" ? structuredClone(result) : undefined;
          state = result && typeof result === "object" ? { ...state, ...structuredClone(result) } : state;
          // Effect state stays UNKNOWN unless the handler explicitly reports
          // it observed the effect land — "the call returned" is an
          // application ACK, not proof the effect happened, so UNKNOWN is
          // the honest default rather than an upgrade we haven't earned.
          if (result && typeof result === "object" && result.__effect) {
            const effectFrom = entry.effect;
            entry.effect = transitionEffect(entry.effect, result.__effect, { evidence: `handler for ${step.id} reported ${result.__effect}` });
            appendEvidence(entry.evidence, { kind: "effect", stepId: step.id, from: effectFrom, to: entry.effect, reason: `handler for ${step.id} reported ${result.__effect}`, runId });
          }
          // Checkpoint immediately on success — this is the step-boundary
          // durability the old runner didn't have (it only checkpointed once,
          // at the very end, on full-run completion).
          ledgerVersion = await this.#checkpoint(ledger, state, { stateKey, expectedVersion: ledgerVersion });
        }

        // Run any declared checks for this step. A step with no declared
        // check simply stays UNVERIFIED — that's a true statement, not an
        // error, and it is never silently upgraded.
        const declaredChecks = checksByStep.get(step.id) || [];
        for (const check of declaredChecks) {
          const preCheckState = entry.verification;
          entry.verification = transitionVerification(entry.verification, "CHECKING", { evidence: `running check ${check.id}` });
          appendEvidence(entry.evidence, { kind: "verification", stepId: step.id, checkId: check.id, verifier: check.verifier, from: preCheckState, to: "CHECKING", reason: `running check ${check.id}`, runId });
          const verifier = this.verifiers.get(check.verifier);
          if (!verifier) {
            const from = entry.verification;
            entry.verification = transitionVerification("CHECKING", "UNVERIFIED", { evidence: `no verifier registered for ${check.verifier}` });
            appendEvidence(entry.evidence, { kind: "verification", stepId: step.id, checkId: check.id, verifier: check.verifier, from, to: "UNVERIFIED", reason: `no verifier registered for ${check.verifier}`, runId });
            checkReceipts.push({ checkId: check.id, stepId: step.id, verifier: check.verifier, outcome: "unavailable" });
            continue;
          }
          // A verifier that THROWS (network down, verifier itself broken)
          // is "verification unavailable" — we don't know the answer. That
          // is NOT the same claim as "verification ran and said no", which
          // is what REJECTED means. Conflating the two would let an infra
          // failure masquerade as evidence of a bad receipt (or vice versa),
          // so they're kept as distinct outcomes on purpose.
          let outcome;
          let verifierThrew = false;
          try {
            outcome = await verifier({ state: structuredClone(state), stepResult: entry.result, signal: undefined });
          } catch (error) {
            verifierThrew = true;
            outcome = { reason: `verifier unavailable: ${error.message}` };
          }
          const from = entry.verification;
          if (verifierThrew) {
            entry.verification = transitionVerification("CHECKING", "UNVERIFIED", { evidence: outcome.reason });
          } else if (outcome?.verified) {
            const claimsIndependent = Boolean(outcome.independent) && this.attestIndependentVerifiers;
            entry.verification = transitionVerification("CHECKING", claimsIndependent ? "INDEPENDENTLY_VERIFIED" : "LOCALLY_VERIFIED", {
              evidence: `check ${check.id} verified${claimsIndependent ? " (independent, attested)" : " (same-process, capped local)"}`,
            });
          } else {
            entry.verification = transitionVerification("CHECKING", "REJECTED", { evidence: outcome?.reason || `check ${check.id} did not verify` });
          }
          appendEvidence(entry.evidence, {
            kind: "verification",
            stepId: step.id,
            checkId: check.id,
            verifier: check.verifier,
            from,
            to: entry.verification,
            reason: outcome?.reason || entry.verification,
            unavailable: verifierThrew,
            runId,
          });
          checkReceipts.push({
            checkId: check.id,
            stepId: step.id,
            verifier: check.verifier,
            outcome: entry.verification,
            reason: outcome?.reason,
            unavailable: verifierThrew,
          });
        }
        ledgerVersion = await this.#checkpoint(ledger, state, { stateKey, expectedVersion: ledgerVersion });
      }

      // Aggregate per-step verification/effect into the mission-level
      // truth state. Deliberately the WEAKEST of the per-step states, not
      // the strongest — one rejected or unverified step means the mission
      // as a whole cannot claim more than that step earned. This is a
      // recomputed summary of already-guarded per-step transitions (each of
      // which passed through transitionVerification/transitionEffect when it
      // happened), not a new promotion event itself, so it's assigned
      // directly rather than re-run through the edge-guard — the guard's
      // job (no promotion without evidence) was already done at the source.
      const stepEntries = Object.values(ledger.steps);
      const anyRejected = stepEntries.some((entry) => entry.verification === "REJECTED");
      const allVerifiedLocally = stepEntries.length > 0 && stepEntries.every((entry) => entry.verification === "LOCALLY_VERIFIED" || entry.verification === "INDEPENDENTLY_VERIFIED");
      const allIndependentlyVerified = stepEntries.length > 0 && stepEntries.every((entry) => entry.verification === "INDEPENDENTLY_VERIFIED");
      ledger.verification = anyRejected
        ? "REJECTED"
        : allIndependentlyVerified
          ? "INDEPENDENTLY_VERIFIED"
          : allVerifiedLocally
            ? "LOCALLY_VERIFIED"
            : "UNVERIFIED";

      const anyContradicted = stepEntries.some((entry) => entry.effect === "CONTRADICTED");
      const allConfirmed = stepEntries.length > 0 && stepEntries.every((entry) => entry.effect === "CONFIRMED");
      const anyObserved = stepEntries.some((entry) => entry.effect === "OBSERVED" || entry.effect === "CONFIRMED");
      ledger.effect = anyContradicted ? "CONTRADICTED" : allConfirmed ? "CONFIRMED" : anyObserved ? "OBSERVED" : "UNKNOWN";

      // EXECUTED is the strongest claim this return path may make. It is
      // not "complete" and it is not "verified" — a caller that wants to
      // know whether the mission's effect is trustworthy must also read
      // `verification` and `effect`, not just check that nothing threw.
      return await finishReceipt("EXECUTED");
    } catch (error) {
      const receipt = await finishReceipt("FAILED", error);
      error.receipt = receipt;
      throw error;
    }
  }
}
