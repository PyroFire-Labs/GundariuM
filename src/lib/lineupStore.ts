/**
 * Starting-lineup storage — server-side only.
 *
 * Phase 2 of the Runner Dossier (see src/types/runner.ts): a hero card
 * plus up to 4 support cards, stored per-wallet in Upstash Redis (via
 * Vercel's storage integration). Purely cosmetic today — no battle system
 * reads this yet, it's profile/bragging-rights only.
 *
 * Writes are gated by an EIP-191 signature (verifyLineupMessage) so only
 * the wallet itself can set its own lineup, plus an on-chain ownership
 * check (call site's job) so a wallet can't feature a card it doesn't hold.
 */

import { Redis } from "@upstash/redis";
import { verifyMessage } from "viem";
import type { RunnerLineup } from "@/types/runner";
import { buildLineupMessage } from "@/lib/lineupMessage";

const redis = Redis.fromEnv();

const MAX_SUPPORT = 4;
const SIGNATURE_FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

function lineupKey(address: string) {
  return `dossier:lineup:${address.toLowerCase()}`;
}

export async function getLineup(address: string): Promise<RunnerLineup | null> {
  try {
    const data = await redis.get<RunnerLineup>(lineupKey(address));
    return data ?? null;
  } catch (err) {
    console.error(`getLineup failed for ${address}:`, err);
    return null;
  }
}

export async function setLineup(address: string, lineup: RunnerLineup): Promise<void> {
  await redis.set(lineupKey(address), lineup);
}

/**
 * Verifies a lineup-save signature: recovers to the claimed address, and
 * the timestamp is within the freshness window (prevents replaying an old
 * signature indefinitely — low-stakes since this is cosmetic, but cheap
 * to guard).
 */
export async function verifyLineupSignature(params: {
  address: string;
  hero: number;
  support: number[];
  ts: number;
  signature: `0x${string}`;
}): Promise<{ valid: boolean; reason?: string }> {
  const { address, hero, support, ts, signature } = params;

  if (Math.abs(Date.now() - ts) > SIGNATURE_FRESHNESS_MS) {
    return { valid: false, reason: "Signature expired — try again" };
  }
  if (support.length > MAX_SUPPORT) {
    return { valid: false, reason: `Support squad can't exceed ${MAX_SUPPORT} cards` };
  }

  const message = buildLineupMessage(address, hero, support, ts);
  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature,
    });
    return valid ? { valid: true } : { valid: false, reason: "Signature doesn't match wallet" };
  } catch (err) {
    console.error(`verifyLineupSignature failed for ${address}:`, err);
    return { valid: false, reason: "Signature verification failed" };
  }
}
