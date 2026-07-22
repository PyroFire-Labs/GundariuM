/**
 * Leaderboard storage — server-side only.
 *
 * The leaderboard is computed periodically by a cron job (see
 * /api/cron/refresh-leaderboard), not on every page view — ranking every
 * participant requires enumerating all card holders and scanning
 * DailyCheckIn's full event history, which is too expensive to redo per
 * visitor. The page just reads whatever this store last cached.
 */

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const CACHE_KEY = "leaderboard:cache";
const PARTICIPANTS_KEY = "leaderboard:participants";
const LAST_SCANNED_BLOCK_KEY = "leaderboard:lastScannedBlock";

export interface LeaderboardEntry {
  address: string;
  exp: number;
  currentStreak: number;
  totalCheckIns: number;
  mintedCount: number;
  runnerName: string | null;
  pfpUrl: string | null;
  farcasterUsername: string | null;
}

export interface LeaderboardCache {
  entries: LeaderboardEntry[];
  updatedAt: number;
}

export async function getLeaderboardCache(): Promise<LeaderboardCache | null> {
  try {
    return (await redis.get<LeaderboardCache>(CACHE_KEY)) ?? null;
  } catch (err) {
    console.error("getLeaderboardCache failed:", err);
    return null;
  }
}

export async function setLeaderboardCache(cache: LeaderboardCache): Promise<void> {
  await redis.set(CACHE_KEY, cache);
}

export async function getKnownParticipants(): Promise<string[]> {
  try {
    return (await redis.smembers(PARTICIPANTS_KEY)) ?? [];
  } catch (err) {
    console.error("getKnownParticipants failed:", err);
    return [];
  }
}

export async function addKnownParticipants(addresses: string[]): Promise<void> {
  if (addresses.length === 0) return;
  await redis.sadd(PARTICIPANTS_KEY, addresses[0], ...addresses.slice(1));
}

export async function getLastScannedBlock(): Promise<bigint | null> {
  try {
    const value = await redis.get<string>(LAST_SCANNED_BLOCK_KEY);
    return value ? BigInt(value) : null;
  } catch (err) {
    console.error("getLastScannedBlock failed:", err);
    return null;
  }
}

export async function setLastScannedBlock(block: bigint): Promise<void> {
  await redis.set(LAST_SCANNED_BLOCK_KEY, block.toString());
}
