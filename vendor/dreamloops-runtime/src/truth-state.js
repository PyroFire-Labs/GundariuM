// Truth-state vocabulary for DreamLoops missions.
//
// Core invariant this module exists to enforce: nothing may promote itself
// to a stronger truth state without evidence proving that transition. Three
// independent axes, on purpose — a mission can be EXECUTED and still be
// UNVERIFIED with an effect that's UNKNOWN. "Completed" is not a state here;
// callers must read all three axes to know what actually happened.

export const EXECUTION_STATES = Object.freeze([
  "PENDING",
  "RUNNING",
  "INTERRUPTED",
  "EXECUTED",
  "FAILED",
]);

export const VERIFICATION_STATES = Object.freeze([
  "UNVERIFIED",
  "CHECKING",
  "LOCALLY_VERIFIED",
  "INDEPENDENTLY_VERIFIED",
  "REJECTED",
]);

export const EFFECT_STATES = Object.freeze([
  "UNKNOWN",
  "OBSERVED",
  "CONFIRMED",
  "CONTRADICTED",
]);

export const AUTHORITY_STATES = Object.freeze([
  "UNAUTHORIZED",
  "AUTHORIZED",
  "EXPIRED",
  "REVOKED",
]);

export const FAILURE_CLASSES = Object.freeze([
  "TRANSIENT", // another attempt could plausibly change the result
  "AUTHORIZATION", // 401/permission/expired-or-revoked authority — retrying with the same authority cannot help
  "VALIDATION", // bad input/schema/unregistered handler — retrying with the same input cannot help
  "CONFLICT", // e.g. same idempotency key, different payload — retrying blindly would be unsafe, not just useless
  "UNKNOWN", // not classified; treated as non-retryable by default (fail closed, not open)
]);

// Only TRANSIENT failures are retried. Everything else is a class of failure
// where "try again" cannot plausibly change the outcome (or, for CONFLICT,
// where trying again blindly would be actively unsafe).
export const RETRYABLE_FAILURE_CLASSES = Object.freeze(["TRANSIENT"]);

const EXECUTION_EDGES = {
  PENDING: ["RUNNING"],
  RUNNING: ["EXECUTED", "FAILED", "INTERRUPTED"],
  INTERRUPTED: ["RUNNING"], // resume
  // EXECUTED/FAILED are terminal for one run() attempt, but re-invoking
  // run() against the same stateKey (at-least-once semantics: callers may
  // call this as many times as they want) must be safe, not a hard error —
  // so both allow re-entry into RUNNING. Each individual step's own
  // outcome ("already EXECUTED, skip" vs "retry") is what actually decides
  // whether a re-entry does any new work.
  EXECUTED: ["RUNNING"],
  FAILED: ["RUNNING"],
};

const VERIFICATION_EDGES = {
  UNVERIFIED: ["CHECKING"],
  // UNVERIFIED here = verifier unavailable/threw, not a rejection.
  // INDEPENDENTLY_VERIFIED is reachable directly from CHECKING (not only
  // via LOCALLY_VERIFIED first) — an attested-independent verifier's
  // result doesn't need to pass through the weaker "local" claim on its
  // way to the stronger one, it just earns the stronger one directly.
  CHECKING: ["LOCALLY_VERIFIED", "INDEPENDENTLY_VERIFIED", "REJECTED", "UNVERIFIED"],
  LOCALLY_VERIFIED: ["INDEPENDENTLY_VERIFIED", "CHECKING"], // re-check allowed
  INDEPENDENTLY_VERIFIED: ["CHECKING"], // re-check allowed (spaced revalidation)
  REJECTED: ["CHECKING"], // may be re-attempted, never silently promoted
};

const EFFECT_EDGES = {
  UNKNOWN: ["OBSERVED", "CONTRADICTED"],
  OBSERVED: ["CONFIRMED", "CONTRADICTED"],
  CONFIRMED: ["CONTRADICTED"], // new contradicting evidence can always demote
  CONTRADICTED: ["OBSERVED", "UNKNOWN"], // re-observation allowed
};

const AUTHORITY_EDGES = {
  UNAUTHORIZED: ["AUTHORIZED"],
  AUTHORIZED: ["EXPIRED", "REVOKED"],
  EXPIRED: ["AUTHORIZED"], // re-provisioned
  REVOKED: [], // terminal — a revoked key does not un-revoke itself
};

function makeTransitioner(name, edges, allStates) {
  return function transition(current, next, { evidence } = {}) {
    if (!allStates.includes(current)) throw new Error(`${name}: unknown current state "${current}"`);
    if (!allStates.includes(next)) throw new Error(`${name}: unknown target state "${next}"`);
    if (current === next) return next; // idempotent no-op, always legal
    const allowed = edges[current] || [];
    if (!allowed.includes(next)) {
      throw new Error(`${name}: illegal transition ${current} -> ${next} (allowed: ${allowed.join(", ") || "none, terminal"})`);
    }
    if (!evidence) {
      throw new Error(`${name}: transition ${current} -> ${next} requires an evidence reason, refusing to promote on assertion alone`);
    }
    return next;
  };
}

export const transitionExecution = makeTransitioner("execution", EXECUTION_EDGES, EXECUTION_STATES);
export const transitionVerification = makeTransitioner("verification", VERIFICATION_EDGES, VERIFICATION_STATES);
export const transitionEffect = makeTransitioner("effect", EFFECT_EDGES, EFFECT_STATES);
export const transitionAuthority = makeTransitioner("authority", AUTHORITY_EDGES, AUTHORITY_STATES);

// A typed failure. Handlers may throw this directly to declare their own
// classification (they know best whether their own failure is transient);
// classifyError() below is only the fallback for handlers that throw plain
// Errors.
export class DreamLoopStepError extends Error {
  constructor(message, { classification = "UNKNOWN", cause } = {}) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "DreamLoopStepError";
    this.classification = FAILURE_CLASSES.includes(classification) ? classification : "UNKNOWN";
  }
}

// A step tried to reuse an idempotency key with a different payload than
// the one that key was first issued for. This is not a normal failure —
// it means either the caller changed its mind mid-flight or something is
// wrong upstream — so it is always classified CONFLICT and never retried
// automatically.
export class IdempotencyConflictError extends DreamLoopStepError {
  constructor(message, extra) {
    super(message, { ...extra, classification: "CONFLICT" });
    this.name = "IdempotencyConflictError";
  }
}

// Two runner instances (or two processes) checkpointed the same mission's
// ledger concurrently. Whichever loses the race must fail loudly, not
// silently overwrite or merge with the winner's progress — a merge here
// would mean guessing which side's evidence is "real," which is exactly the
// kind of unearned promotion this whole module exists to refuse.
export class LedgerConflictError extends DreamLoopStepError {
  constructor(message, extra) {
    super(message, { ...extra, classification: "CONFLICT" });
    this.name = "LedgerConflictError";
  }
}

// A step is being resumed against a definition (handler, loop version, or
// capsule version) that differs from the one its still-open intent was
// created under. Retrying with the SAME (changed) definition cannot resolve
// this — the mission itself changed underneath an in-flight intent — so it
// is classified VALIDATION, matching that class's existing meaning.
export class DriftDetectedError extends DreamLoopStepError {
  constructor(message, extra) {
    super(message, { ...extra, classification: "VALIDATION" });
    this.name = "DriftDetectedError";
  }
}

// Best-effort classification for handlers that throw plain Error objects
// (most will). Deliberately conservative: anything not clearly transient,
// authorization, validation, or conflict falls into UNKNOWN, and UNKNOWN is
// NOT retried — fail closed rather than guess that retrying is safe.
export function classifyError(error) {
  if (error instanceof DreamLoopStepError) return error.classification;
  const message = String(error?.message || error || "");
  if (/timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|429|503|network/i.test(message)) return "TRANSIENT";
  if (/assignment_key_required|401|unauthorized|not granted permission|blocks permission|expired|revoked/i.test(message)) return "AUTHORIZATION";
  if (/unregistered handler|must be|invalid|schema|wall-time ceiling/i.test(message)) return "VALIDATION";
  if (/idempotency key.*different payload|conflict/i.test(message)) return "CONFLICT";
  return "UNKNOWN";
}

export function isRetryable(classification) {
  return RETRYABLE_FAILURE_CLASSES.includes(classification);
}

// Bounded exponential backoff with jitter, only ever consulted before a
// TRANSIENT retry. Deterministic seam for tests: pass random() explicitly.
export function backoffDelayMs(attempt, { baseMs = 25, capMs = 1000, random = Math.random } = {}) {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(exp / 2 + random() * (exp / 2));
}
