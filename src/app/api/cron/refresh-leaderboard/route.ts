/**
 * GET /api/cron/refresh-leaderboard
 *
 * Vercel Cron-triggered. Ranks every known participant by the exact same
 * EXP formula /tasks uses (currentStreak*10 + totalCheckIns*5 +
 * mintedCount*25, plus the permanent GNRM-buy/stake/share/perfect-week
 * bonus from updateExpHistory) — the two used to disagree, since this
 * cron only ever computed the base and never called into the shared
 * bonus logic, so the same wallet showed two different totals in two
 * different places. Caches the top 100 in KV for the /leaderboard page.
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
import { getExpHistoryTotals } from "@/lib/expHistoryScan";
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

// Prefer the dedicated RPC endpoint over the free public one — this route
// batches multiple contract reads per request, and mainnet.base.org's free
// tier intermittently rejects those with "RPC Request failed" under load
// (same fix as og/dossier/[address] — see that route's comment).
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries any failed RPC call with a fixed backoff before giving up.
 * Deliberately not scoped to a specific error-message substring — the
 * first version of this only retried errors whose text included "rate
 * limit", which worked when testing from a home/office IP but missed
 * whatever the public RPC actually says when it throttles requests from
 * Vercel's cloud IP ranges specifically (a plausibly different, stricter
 * response than what local testing ever saw). Retrying unconditionally
 * is safe here — there's no side effect to double up on, only reads.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES) throw err;
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

type MulticallResult = { status: "success"; result: unknown } | { status: "failure"; error: unknown };

function hasAnyFailure(results: readonly MulticallResult[]): boolean {
  return results.some((r) => r.status === "failure");
}

/**
 * viem's multicall (allowFailure: true, the default) resolves normally
 * even when the RPC throttles an underlying batched eth_call — every
 * result in that batch comes back as status: "failure", not as a
 * rejected promise. Plain withRetry only catches thrown errors, so it
 * never sees this: the whole population silently reads back as
 * "failure" and the leaderboard ends up empty despite real on-chain
 * data existing. This checks the *resolved* results for any failure at
 * all and retries the whole call — not scoped to a specific error
 * signature, for the same reason withRetry above isn't.
 */
async function multicallWithRetry<T extends readonly MulticallResult[]>(fn: () => Promise<T>): Promise<T> {
  let result = await withRetry(fn);
  for (let attempt = 0; attempt < MAX_RETRIES && hasAnyFailure(result); attempt++) {
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

  // Permanent base only — no live perfectWeek check here. That would
  // double-count against updateExpHistory's own perfectWeeks*200 below,
  // which replays CheckedIn history into a permanent count rather than a
  // live "is this week currently perfect" boolean (the same live-flag
  // problem /tasks already had — see feedback_onchain_scan_architecture).
  const baseResults = population
    .map((address, i) => {
      const streak = streakResults[i];
      const balance = balanceResults[i];
      if (streak.status !== "success" || balance.status !== "success") return null;
      const [current, , total] = streak.result as readonly [bigint, bigint, bigint, bigint, bigint];
      const mintedCount = Number(balance.result as bigint);
      const currentStreak = Number(current);
      const totalCheckIns = Number(total);
      const baseExp = currentStreak * 10 + totalCheckIns * 5 + mintedCount * 25;
      return { address, baseExp, currentStreak, totalCheckIns, mintedCount };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  // Sequential, not Promise.all — each call already paces/retries its own
  // RPC traffic against the same rate-limited public endpoint; running
  // them concurrently would just recreate the burst this was built to avoid.
  // Reads whatever bonus each wallet already has cached — see
  // getExpHistoryTotals's doc comment for why this doesn't scan inline.
  const withBonus: Array<(typeof baseResults)[number] & { exp: number }> = [];
  for (const r of baseResults) {
    const { bonusExp } = await getExpHistoryTotals(r.address as `0x${string}`);
    withBonus.push({ ...r, exp: r.baseExp + bonusExp });
  }

  const ranked = withBonus
    .filter((e) => e.exp > 0)
    .sort((a, b) => b.exp - a.exp)
    .slice(0, TOP_N);

  // This has silently gone empty in production before despite non-zero
  // population, purely from the multicall failure mode above — leaving a
  // trail in the logs beats re-diagnosing from scratch next time.
  if (ranked.length === 0 && population.length > 0) {
    console.error(
      "refresh-leaderboard: 0 ranked despite non-empty population",
      JSON.stringify({
        population: population.length,
        baseResults: baseResults.length,
        streakFailures: streakResults.filter((r) => r.status === "failure").length,
        balanceFailures: balanceResults.filter((r) => r.status === "failure").length,
      })
    );
  }

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
