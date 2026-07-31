/**
 * Reroll payment tracking — server-side only.
 *
 * A reroll tx hash is marked "consumed" only after a paid reroll's Gemini
 * generation actually succeeds (see /api/generate-kitbash), so a Gemini
 * failure after a real on-chain payment never costs the user a second burn
 * on retry — the same tx hash and signature remain valid until consumed.
 */

import { Redis } from "@upstash/redis";

// Constructed lazily, never at module scope. Redis.fromEnv() throws
// immediately if UPSTASH_REDIS_REST_URL/TOKEN are missing or misconfigured,
// and /api/generate-kitbash statically imports this module — so a module-level
// client would take down the entire route, including the free,
// revenue-critical first-mint generation path that touches Redis not at all.
// (This codebase has already lost 16 hours of production Gemini availability
// to a Doppler/Vercel env drift; same failure class.) Deferring construction
// means an env problem can only surface on an actual paid-reroll attempt.
let redisClient: Redis | null = null;
// Set once construction has failed, so the error is logged a single time per
// serverless instance instead of on every paid-reroll request. Env vars can't
// change under a running instance, so caching the failure costs nothing; a
// fixed deploy starts fresh instances with the flag clear.
let redisUnconfigured = false;

/**
 * Returns the client, or `null` when Upstash simply isn't configured.
 *
 * Returning null rather than throwing is what lets callers tell "Redis is
 * fundamentally unavailable" (a config problem, permanent until an operator
 * fixes it) apart from "this one call failed" (a blip). They warrant opposite
 * responses — see isRerollTxConsumed.
 */
function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  if (redisUnconfigured) return null;
  try {
    redisClient = Redis.fromEnv();
    return redisClient;
  } catch (err) {
    redisUnconfigured = true;
    console.error(
      "Upstash Redis is not configured — reroll replay protection is disabled, " +
        "so all paid rerolls will be rejected until UPSTASH_REDIS_REST_URL and " +
        "UPSTASH_REDIS_REST_TOKEN are set on this deployment:",
      err
    );
    return null;
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
    return value !== null;
  } catch (err) {
    console.error(`isRerollTxConsumed failed for ${txHash}:`, err);
    // Unchanged, and intentionally different from the null case above: the
    // client exists, so this is a hiccup on one call. Failing closed here
    // would block legitimate rerolls during a brief blip; the on-chain +
    // signature checks in verifyRerollPayment still gate a real payment, so
    // the worst case is a very narrow replay window, not an unpaid
    // generation.
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
  await redis.set(consumedKey(txHash), true);
}
