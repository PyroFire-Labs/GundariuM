/**
 * Reroll payment tracking — server-side only.
 *
 * A reroll tx hash is marked "consumed" only after a paid reroll's Gemini
 * generation actually succeeds (see /api/generate-kitbash), so a Gemini
 * failure after a real on-chain payment never costs the user a second burn
 * on retry — the same tx hash and signature remain valid until consumed.
 */

import { Redis } from "@upstash/redis";

// Constructed lazily, never at module scope. A broken/missing config would
// otherwise take down the entire route at import time — and
// /api/generate-kitbash statically imports this module, so a module-level
// client would break the free, revenue-critical first-mint generation path
// that touches Redis not at all. (This codebase has already lost 16 hours of
// production Gemini availability to a Doppler/Vercel env drift; same failure
// class.) Deferring construction means an env problem can only surface on an
// actual paid-reroll attempt.
//
// Redis.fromEnv() is deliberately NOT used here: it only warns and returns a
// non-functional client when UPSTASH_REDIS_REST_URL/TOKEN are simply absent
// (@upstash/redis v1.38's SDK behavior) rather than throwing — which would
// have made the "env vars missing entirely" case, the exact incident this
// module's design is reacting to, silently fall through to the fail-open
// path below instead of the fail-closed one. Reading and validating the vars
// directly makes "unconfigured" detectable before construction.
let redisClient: Redis | null = null;
// Set once construction is known to be broken, so the error is logged a
// single time per serverless instance instead of on every paid-reroll
// request. Env vars can't change under a running instance, so caching the
// failure costs nothing; a fixed deploy starts fresh instances with the flag
// clear.
let redisUnconfigured = false;

// Consecutive-failure circuit breaker for the OTHER misconfiguration shape:
// credentials that are present and well-formed but wrong (a stale token
// after rotation, pointed at the wrong project) — construction succeeds, so
// the missing-env check below can't catch it, and every read would
// otherwise fail open forever. After a run of consecutive read failures with
// no success in between, treat the store as unconfigured too. A single
// success resets the counter, so a real transient blip never trips it.
const CONSECUTIVE_FAILURE_THRESHOLD = 5;
let consecutiveFailures = 0;

/**
 * Returns the client, or `null` when Upstash simply isn't configured (env
 * vars missing/empty, or the credential looked valid but has now failed
 * enough consecutive times to be treated as broken rather than blipping).
 *
 * Returning null rather than throwing is what lets callers tell "Redis is
 * fundamentally unavailable" (a config problem, permanent until an operator
 * fixes it) apart from "this one call failed" (a blip). They warrant opposite
 * responses — see isRerollTxConsumed.
 */
function getRedis(): Redis | null {
  if (redisUnconfigured) return null;
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisUnconfigured = true;
    console.error(
      "Upstash Redis is not configured — reroll replay protection is disabled, " +
        "so all paid rerolls will be rejected until UPSTASH_REDIS_REST_URL and " +
        "UPSTASH_REDIS_REST_TOKEN are set on this deployment."
    );
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (err) {
    redisUnconfigured = true;
    console.error(
      "Upstash Redis client construction failed — reroll replay protection " +
        "is disabled, so all paid rerolls will be rejected until this is fixed:",
      err
    );
    return null;
  }
}

/** Called after every real Redis operation to drive the circuit breaker. */
function recordRedisOutcome(succeeded: boolean): void {
  if (succeeded) {
    consecutiveFailures = 0;
    return;
  }
  consecutiveFailures += 1;
  if (consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD && !redisUnconfigured) {
    redisUnconfigured = true;
    redisClient = null;
    console.error(
      `Upstash Redis has failed ${consecutiveFailures} consecutive operations — ` +
        "treating credentials as broken (not a transient blip) and disabling " +
        "reroll replay protection; all paid rerolls will be rejected until " +
        "this is fixed."
    );
  }
}

/**
 * Whether replay protection is available at all. Callers use this to return a
 * truthful, retryable error instead of the misleading "already used" that
 * isRerollTxConsumed's fail-closed default would produce.
 */
export function isRerollStoreConfigured(): boolean {
  return getRedis() !== null;
}

function consumedKey(txHash: string): string {
  return `reroll:consumed:${txHash.toLowerCase()}`;
}

export async function isRerollTxConsumed(txHash: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    // Fail CLOSED — deliberately the opposite polarity from the transient
    // case below. A total misconfiguration isn't a blip that clears itself:
    // replay protection would be off for as long as the bad env persists,
    // and the paid path's own ceiling (100/day per IP) means one verified
    // burn could be replayed into 100 Gemini-cost generations a day,
    // indefinitely, with nothing but a log line to notice it. Rejecting every
    // paid reroll instead makes players complain within minutes, which
    // surfaces the ops problem far faster than silent replay would.
    return true;
  }
  try {
    const value = await redis.get(consumedKey(txHash));
    recordRedisOutcome(true);
    return value !== null;
  } catch (err) {
    console.error(`isRerollTxConsumed failed for ${txHash}:`, err);
    recordRedisOutcome(false);
    // Fail open on an ISOLATED call failure: the client exists and hasn't
    // yet crossed the consecutive-failure threshold above, so this reads as
    // a hiccup on one call. Failing closed here would block legitimate
    // rerolls during a brief blip; the on-chain + signature checks in
    // verifyRerollPayment still gate a real payment, so the worst case is a
    // narrow replay window, not an unpaid generation — and that window is
    // now bounded by CONSECUTIVE_FAILURE_THRESHOLD rather than open-ended.
    return false;
  }
}

// No TTL: a consumed reroll tx hash must be permanently unusable. Expiring the
// record would make the exact same burn transaction replayable again once it
// lapsed, defeating the point of tracking it at all.
export async function markRerollTxConsumed(txHash: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    // Unreachable in the normal flow — isRerollTxConsumed already rejected
    // the request before Gemini was called. Throwing keeps the contract
    // honest for any future caller; /api/generate-kitbash catches and logs it
    // rather than discarding an already-paid-for generation.
    throw new Error(
      "Upstash Redis is not configured — cannot record consumed reroll tx"
    );
  }
  try {
    await redis.set(consumedKey(txHash), true);
    recordRedisOutcome(true);
  } catch (err) {
    recordRedisOutcome(false);
    throw err;
  }
}
