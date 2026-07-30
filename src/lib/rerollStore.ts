/**
 * Reroll payment tracking — server-side only.
 *
 * A reroll tx hash is marked "consumed" only after a paid reroll's Gemini
 * generation actually succeeds (see /api/generate-kitbash), so a Gemini
 * failure after a real on-chain payment never costs the user a second burn
 * on retry — the same tx hash and signature remain valid until consumed.
 */

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// 30 days is far longer than any plausible retry window; bounds storage
// instead of keeping every reroll tx hash forever.
const CONSUMED_TTL_SECONDS = 30 * 24 * 60 * 60;

function consumedKey(txHash: string): string {
  return `reroll:consumed:${txHash.toLowerCase()}`;
}

export async function isRerollTxConsumed(txHash: string): Promise<boolean> {
  try {
    const value = await redis.get(consumedKey(txHash));
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

export async function markRerollTxConsumed(txHash: string): Promise<void> {
  await redis.set(consumedKey(txHash), true, { ex: CONSUMED_TTL_SECONDS });
}
