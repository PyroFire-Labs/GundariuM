// Mission ledger: the control-plane record the runner checkpoints around
// every consequential transition — separate from the business `state` blob
// handlers read and write. Stored under its own key (`${stateKey}::mission`)
// so business state keeps its pre-existing shape/contract for callers that
// only ever cared about that.
//
// This is what makes "intent before effect" real: an intent record for a
// step is persisted BEFORE its handler is invoked, not after. A crash
// between "handler ran" and "outcome checkpointed" leaves the intent behind
// with no outcome — that gap is exactly what resume-reconciliation reads.
//
// Evidence log: every consequential transition (execution, authority,
// verification, effect, outcome) is also appended — never overwritten — to
// a hash-chained `evidence` array (one on the ledger itself for
// mission-wide events, one per step for step-scoped events). The scalar
// fields (`ledger.execution`, `entry.verification`, ...) remain for cheap
// reads, but they are a CACHE of the latest evidence entry, not the source
// of truth. A retry or re-verification appends a new entry; it never
// rewrites or removes a prior one. This is what makes the ledger tamper-
// evident: `verifyEvidenceChain` recomputes the hash chain and will catch
// any entry that was edited, reordered, or deleted after the fact.

import crypto from "node:crypto";
import { canonicalJson } from "./contracts.js";

export function missionLedgerKey(stateKey) {
  return `${stateKey}::mission`;
}

// Stable across restarts of the SAME mission (same stateKey) — deliberately
// NOT derived from runId, which is minted fresh every run() call. Identity
// that must survive a crash cannot live in a value that doesn't survive one.
export function operationId({ stateKey, runId, stepId }) {
  return `${stateKey || runId}:${stepId}`;
}

export function payloadHash(value) {
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

const GENESIS_HASH = "sha256:genesis";

function hashOf(body) {
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(body)).digest("hex")}`;
}

// Append one evidence record to `list` (mutated in place) and return it.
// The record is chained to the previous one via `prevHash`, and its own
// `hash` covers its full content (including `prevHash`) — so an attacker or
// bug that edits, drops, reorders, or splices an entry breaks the chain at
// exactly that point, detectable by verifyEvidenceChain below.
export function appendEvidence(list, record) {
  const seq = list.length;
  const prevHash = seq === 0 ? GENESIS_HASH : list[seq - 1].hash;
  const body = { seq, at: new Date().toISOString(), prevHash, ...record };
  const entry = { ...body, hash: hashOf(body) };
  list.push(entry);
  return entry;
}

// Recompute the hash chain over `list` from genesis. Returns
// { valid: true } if every entry's hash and prevHash line up, or
// { valid: false, brokenAtSeq, reason } at the first entry that doesn't —
// which is exactly the entry that was tampered with (or the first one
// after a deletion/reorder).
export function verifyEvidenceChain(list) {
  let expectedPrevHash = GENESIS_HASH;
  for (let i = 0; i < list.length; i += 1) {
    const { hash, ...body } = list[i];
    if (body.seq !== i) {
      return { valid: false, brokenAtSeq: i, reason: `expected seq ${i}, found ${body.seq}` };
    }
    if (body.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAtSeq: i, reason: "prevHash does not match the preceding entry's hash" };
    }
    if (hashOf(body) !== hash) {
      return { valid: false, brokenAtSeq: i, reason: "entry content does not match its own recorded hash" };
    }
    expectedPrevHash = hash;
  }
  return { valid: true, brokenAtSeq: null, reason: null };
}

export function freshLedger({ runId, loopId, stateKey }) {
  return {
    runId,
    loopId,
    stateKey: stateKey ?? null,
    execution: "PENDING",
    verification: "UNVERIFIED",
    effect: "UNKNOWN",
    // Mission-wide authority state, tracked so a revocation between an
    // earlier run()'s intent and a later run()'s attempted execution is a
    // recorded, auditable transition — not just an in-memory parameter that
    // disappears between calls.
    authority: "UNAUTHORIZED",
    // Mission-wide evidence: execution and authority transitions. Step-scoped
    // evidence (intent, attempts, outcome, verification, effect) lives on
    // each step's own `evidence` array instead, so a step's audit trail is
    // self-contained and a chain break in one step doesn't implicate others.
    evidence: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: {},
  };
}

// Defensive defaulting for a ledger persisted before these fields existed —
// loading an older ledger should not throw, it should just adopt the
// honest defaults ("we don't have authority evidence for anything that
// happened before this field existed").
export function migrateLedger(ledger) {
  if (ledger.authority === undefined) ledger.authority = "UNAUTHORIZED";
  if (!Array.isArray(ledger.evidence)) ledger.evidence = [];
  for (const entry of Object.values(ledger.steps || {})) {
    if (!Array.isArray(entry.evidence)) entry.evidence = [];
  }
  return ledger;
}

export function freshStepEntry() {
  return {
    intent: null,
    outcome: null,
    attempts: [],
    verification: "UNVERIFIED",
    effect: "UNKNOWN",
    result: undefined,
    evidence: [],
  };
}

export function stepEntry(ledger, stepId) {
  return ledger.steps[stepId] ?? null;
}

export function touch(ledger) {
  ledger.updatedAt = new Date().toISOString();
  return ledger;
}
