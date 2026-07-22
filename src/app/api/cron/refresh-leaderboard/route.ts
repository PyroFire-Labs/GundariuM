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

const CHECKED_IN_EVENT = parseAbiItem(
  "event CheckedIn(address indexed user, uint256 day, uint256 streak)"
);

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

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

  const currentBlock = await publicClient.getBlockNumber();

  // 1. Incrementally scan for new check-in participants since the last run.
  const lastScanned = (await getLastScannedBlock()) ?? DAILYCHECKIN_DEPLOY_BLOCK;
  const newParticipants = new Set<string>();
  let chunkStart = lastScanned + 1n;
  while (chunkStart <= currentBlock) {
    const chunkEnd =
      chunkStart + MAX_LOG_RANGE - 1n > currentBlock ? currentBlock : chunkStart + MAX_LOG_RANGE - 1n;
    const logs = await publicClient.getLogs({
      address: contracts.dailyCheckIn,
      event: CHECKED_IN_EVENT,
      fromBlock: chunkStart,
      toBlock: chunkEnd,
    });
    for (const log of logs) {
      if (log.args.user) newParticipants.add(log.args.user.toLowerCase());
    }
    chunkStart = chunkEnd + 1n;
  }
  if (newParticipants.size > 0) {
    await addKnownParticipants([...newParticipants]);
  }
  await setLastScannedBlock(currentBlock);

  // 2. Re-enumerate all current card holders fresh (cheap at this scale,
  // and correctly reflects transfers rather than trusting stale history).
  const totalSupply = Number(
    await publicClient.readContract({
      address: contracts.gunplaCard,
      abi: GUNPLA_CARD_ABI,
      functionName: "totalSupply",
    })
  );
  const tokenIds = await publicClient.multicall({
    contracts: Array.from({ length: totalSupply }, (_, i) => ({
      address: contracts.gunplaCard,
      abi: GUNPLA_CARD_ABI,
      functionName: "tokenByIndex" as const,
      args: [BigInt(i)],
    })),
  });
  const owners = await publicClient.multicall({
    contracts: tokenIds
      .filter((r) => r.status === "success")
      .map((r) => ({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "ownerOf" as const,
        args: [r.result as bigint],
      })),
  });
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
  const streakResults = await publicClient.multicall({
    contracts: population.map((address) => ({
      address: contracts.dailyCheckIn,
      abi: DAILY_CHECKIN_ABI,
      functionName: "getStreak" as const,
      args: [address as `0x${string}`],
    })),
  });
  const balanceResults = await publicClient.multicall({
    contracts: population.map((address) => ({
      address: contracts.gunplaCard,
      abi: GUNPLA_CARD_ABI,
      functionName: "balanceOf" as const,
      args: [address as `0x${string}`],
    })),
  });

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
    newParticipantsThisRun: newParticipants.size,
  });
}
