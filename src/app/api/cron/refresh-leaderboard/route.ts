/**
 * GET /api/cron/refresh-leaderboard
 *
 * Vercel Cron-triggered. Ranks every known participant by the same stable
 * EXP formula the dossier uses (currentStreak*10 + totalCheckIns*5 +
 * mintedCount*25 + perfectWeek bonus), caches the top 100 in KV for the
 * /leaderboard page to read.
 *
 * Population = every current GunplaCard holder (re-enumerated fresh each
 * run via ERC721Enumerable — cheap at current scale, and self-corrects
 * for card transfers) UNION every address that's ever called checkIn()
 * (found via an incremental, paginated CheckedIn log scan since the last
 * run, not a full history rescan every time).
 */

import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { DAILY_CHECKIN_ABI } from "@/lib/contracts/abis/DailyCheckIn";
import { GUNPLA_CARD_ABI } from "@/lib/contracts/abis/GunplaCard";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { lookupFarcasterByAddresses } from "@/lib/neynar";
import {
  getKnownParticipants,
  addKnownParticipants,
  getLastScannedBlock,
  setLastScannedBlock,
  setLeaderboardCache,
  type LeaderboardEntry,
} from "@/lib/leaderboardStore";

export const maxDuration = 60;

const DAILYCHECKIN_DEPLOY_BLOCK = 48_798_292n; // Base mainnet
const MAX_LOG_RANGE = 9_000n; // public RPC eth_getLogs range limit
const TOP_N = 100;
const CHUNK_DELAY_MS = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_500;

const CHECKED_IN_EVENT = parseAbiItem(
  "event CheckedIn(address indexed user, uint256 day, uint256 streak)"
);

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a rate-limited RPC call with a fixed backoff before giving up.
 * The public RPC's rate limit is real and shared across every route in
 * this app that talks to it (see /api/exp-history) — without this, a
 * single rate-limit hit partway through this cron's many calls throws
 * uncaught, and the leaderboard cache is either left stale or, depending
 * on exactly where the throw lands, never gets past an empty result.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("rate limit") || attempt === MAX_RETRIES) throw err;
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

type MulticallResult = { status: "success"; result: unknown } | { status: "failure"; error: unknown };

// viem nests the actual RPC error several levels down (error.cause.cause.details
// for a rate-limit response, not error.message) — has to walk the chain.
function containsRateLimit(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 5) return false;
  const obj = err as Record<string, unknown>;
  const message = typeof obj.message === "string" ? obj.message : "";
  const details = typeof obj.details === "string" ? obj.details : "";
  if (message.includes("rate limit") || details.includes("rate limit")) return true;
  return containsRateLimit(obj.cause, depth + 1);
}

function hasRateLimitFailure(results: readonly MulticallResult[]): boolean {
  return results.some((r) => r.status === "failure" && containsRateLimit(r.error));
}

/**
 * viem's multicall (allowFailure: true, the default) resolves normally
 * even when the RPC rate-limits an underlying batched eth_call — every
 * result in that batch comes back as status: "failure" with the
 * rate-limit error attached per-item, not as a rejected promise. Plain
 * withRetry only catches thrown errors, so it never sees this: the whole
 * population silently reads back as "failure" and the leaderboard ends
 * up empty despite real on-chain data existing. This checks the
 * *resolved* results for that signature and retries the whole call.
 */
async function multicallWithRetry<T extends readonly MulticallResult[]>(fn: () => Promise<T>): Promise<T> {
  let result = await withRetry(fn);
  for (let attempt = 0; attempt < MAX_RETRIES && hasRateLimitFailure(result); attempt++) {
    await sleep(RETRY_DELAY_MS);
    result = await withRetry(fn);
  }
  return result;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const contracts = getContracts(base.id);
  if (isPlaceholder(contracts.dailyCheckIn)) {
    return NextResponse.json({ error: "DailyCheckIn not deployed on mainnet" }, { status: 200 });
  }

  const currentBlock = await withRetry(() => publicClient.getBlockNumber());

  // 1. Incrementally scan for new check-in participants since the last run.
  const lastScanned = (await getLastScannedBlock()) ?? DAILYCHECKIN_DEPLOY_BLOCK;
  const newParticipants = new Set<string>();
  let chunkStart = lastScanned + 1n;
  while (chunkStart <= currentBlock) {
    const chunkEnd =
      chunkStart + MAX_LOG_RANGE - 1n > currentBlock ? currentBlock : chunkStart + MAX_LOG_RANGE - 1n;
    const logs = await withRetry(() =>
      publicClient.getLogs({
        address: contracts.dailyCheckIn,
        event: CHECKED_IN_EVENT,
        fromBlock: chunkStart,
        toBlock: chunkEnd,
      })
    );
    for (const log of logs) {
      if (log.args.user) newParticipants.add(log.args.user.toLowerCase());
    }
    chunkStart = chunkEnd + 1n;
    if (chunkStart <= currentBlock) await sleep(CHUNK_DELAY_MS);
  }
  if (newParticipants.size > 0) {
    await addKnownParticipants([...newParticipants]);
  }
  await setLastScannedBlock(currentBlock);

  // 2. Re-enumerate all current card holders fresh (cheap at this scale,
  // and correctly reflects transfers rather than trusting stale history).
  const totalSupply = Number(
    await withRetry(() =>
      publicClient.readContract({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "totalSupply",
      })
    )
  );
  await sleep(CHUNK_DELAY_MS);
  const tokenIds = await multicallWithRetry(() =>
    publicClient.multicall({
      contracts: Array.from({ length: totalSupply }, (_, i) => ({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "tokenByIndex" as const,
        args: [BigInt(i)],
      })),
    })
  );
  await sleep(CHUNK_DELAY_MS);
  const owners = await multicallWithRetry(() =>
    publicClient.multicall({
      contracts: tokenIds
        .filter((r) => r.status === "success")
        .map((r) => ({
          address: contracts.gunplaCard,
          abi: GUNPLA_CARD_ABI,
          functionName: "ownerOf" as const,
          args: [r.result as bigint],
        })),
    })
  );
  const cardHolders = owners
    .filter((r) => r.status === "success")
    .map((r) => (r.result as string).toLowerCase());

  // 3. Union everything ever seen with today's card holders.
  const known = await getKnownParticipants();
  const population = [...new Set([...known, ...cardHolders])];

  if (population.length === 0) {
    return NextResponse.json({ ranked: 0, note: "no participants yet" });
  }

  // 4. Batch-read streak + card balance for every participant.
  await sleep(CHUNK_DELAY_MS);
  const streakResults = await multicallWithRetry(() =>
    publicClient.multicall({
      contracts: population.map((address) => ({
        address: contracts.dailyCheckIn,
        abi: DAILY_CHECKIN_ABI,
        functionName: "getStreak" as const,
        args: [address as `0x${string}`],
      })),
    })
  );
  await sleep(CHUNK_DELAY_MS);
  const balanceResults = await multicallWithRetry(() =>
    publicClient.multicall({
      contracts: population.map((address) => ({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "balanceOf" as const,
        args: [address as `0x${string}`],
      })),
    })
  );

  const ranked = population
    .map((address, i) => {
      const streak = streakResults[i];
      const balance = balanceResults[i];
      if (streak.status !== "success" || balance.status !== "success") return null;
      const [current, , total, , weekCount] = streak.result as readonly [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
      ];
      const mintedCount = Number(balance.result as bigint);
      const currentStreak = Number(current);
      const totalCheckIns = Number(total);
      const perfectWeek = weekCount === 7n;
      const exp =
        currentStreak * 10 + totalCheckIns * 5 + mintedCount * 25 + (perfectWeek ? 200 : 0);
      return { address, exp, currentStreak, totalCheckIns, mintedCount };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null && e.exp > 0)
    .sort((a, b) => b.exp - a.exp)
    .slice(0, TOP_N);

  // 5. Resolve Farcaster identity for just the top N, in one batched call.
  const profiles = await lookupFarcasterByAddresses(ranked.map((e) => e.address));

  const entries: LeaderboardEntry[] = ranked.map((e) => {
    const profile = profiles.get(e.address);
    return {
      ...e,
      runnerName: profile?.runnerName ?? null,
      pfpUrl: profile?.pfpUrl ?? null,
      farcasterUsername: profile?.farcasterUsername ?? null,
    };
  });

  await setLeaderboardCache({ entries, updatedAt: Date.now() });

  return NextResponse.json({
    ranked: entries.length,
    population: population.length,
    newParticipants: newParticipants.size,
  });
}
