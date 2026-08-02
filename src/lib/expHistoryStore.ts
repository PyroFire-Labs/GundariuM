/**
 * Per-wallet EXP-history cache — server-side only.
 *
 * Backs /api/exp-history. Each record accumulates raw per-day/per-week
 * on-chain totals plus the last block scanned, so every request after
 * the first only needs to scan the delta since lastScannedBlock instead
 * of replaying a wallet's entire history — the mistake that tripped the
 * public RPC's rate limit when useExpHistory did the scan client-side.
 */

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export interface ExpHistoryRecord {
  lastScannedBlock: string;
  /** UTC day (as string) -> total pool-sourced GNRM bought that day (bigint as string) */
  gnrmBuyTotalsByDay: Record<string, string>;
  /** UTC day (as string) -> net stGNRM minted minus burned that day (bigint as string, can be negative) */
  stakeNetByDay: Record<string, string>;
  dossierShareCount: number;
  arenaShareCount: number;
  /** rolling week (day/7, as string) -> distinct UTC days checked in that week */
  checkedInDaysByWeek: Record<string, string[]>;
}

function key(address: string): string {
  return `expHistory:${address}`;
}

export async function getExpHistoryRecord(address: string): Promise<ExpHistoryRecord | null> {
  try {
    return await redis.get<ExpHistoryRecord>(key(address));
  } catch (err) {
    console.error("getExpHistoryRecord failed:", err);
    return null;
  }
}

export async function setExpHistoryRecord(address: string, record: ExpHistoryRecord): Promise<void> {
  await redis.set(key(address), record);
}
