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

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

function consumedKey(txHash: string): string {
  return `reroll:consumed:${txHash.toLowerCase()}`;
}

export async function isRerollTxConsumed(txHash: string): Promise<boolean> {
  try {
    const value = await getRedis().get(consumedKey(txHash));
    return value !== null;
  } catch (err) {
    console.error(`isRerollTxConsumed failed for ${txHash}:`, err);
    // Fail closed would block legitimate rerolls on a Redis hiccup; fail
    // open here since the on-chain + signature checks in verifyRerollPayment
    // still gate a real payment — worst case on a Redis outage is a very
    // narrow replay window, not an unpaid generation.
    return false;
  }
}

// No TTL: a consumed reroll tx hash must be permanently unusable. Expiring the
// record would make the exact same burn transaction replayable again once it
// lapsed, defeating the point of tracking it at all.
export async function markRerollTxConsumed(txHash: string): Promise<void> {
  await getRedis().set(consumedKey(txHash), true);
}
