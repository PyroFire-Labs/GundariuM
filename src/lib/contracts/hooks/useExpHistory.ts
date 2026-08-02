"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { GNRM_ADDRESS, GNRM_POOL_ADDRESS, MIN_DAILY_BUY } from "./useGnrmPurchaseCheck";
import { STGNRM_ADDRESS, ZERO_ADDRESS } from "./useStakedTodayCheck";

const MAX_LOG_RANGE = 9_000n; // public RPC eth_getLogs range limit (see useGnrmPurchaseCheck)
const STAKE_GROWTH_THRESHOLD = 20_000n * 10n ** 18n;
const SECONDS_PER_DAY = 86_400n;
// DailyCheckIn's mainnet deploy block. Nothing in the EXP-history system
// predates this — none of these daily tasks existed before it did.
const SCAN_START_BLOCK = 48_798_292n;

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const CHECKED_IN_EVENT = parseAbiItem("event CheckedIn(address indexed user, uint256 day, uint256 streak)");
const SHARE_CONFIRMED_EVENT = parseAbiItem(
  "event ShareConfirmed(address indexed user, uint256 day, uint256 streak, uint256 exp)"
);
const BATTLE_SHARE_CONFIRMED_EVENT = parseAbiItem(
  "event BattleShareConfirmed(address indexed user, uint256 day, string playerName, string enemyName, bool won, uint16 hpPct)"
);

export interface ExpHistory {
  loading: boolean;
  gnrmBuyDays: number;
  stakeClaims: number;
  dossierShares: number;
  arenaShares: number;
  perfectWeeks: number;
  /** gnrmBuyDays*12 + stakeClaims*50 + dossierShares*8 + arenaShares*8 + perfectWeeks*200 */
  bonusExp: number;
  /** Re-runs the scan on demand — see the `refreshOn` param for why this exists. */
  refetch: () => void;
}

const NOOP = () => {};

const EMPTY: ExpHistory = {
  loading: true,
  gnrmBuyDays: 0,
  stakeClaims: 0,
  dossierShares: 0,
  arenaShares: 0,
  perfectWeeks: 0,
  bonusExp: 0,
  refetch: NOOP,
};

type PublicClient = NonNullable<ReturnType<typeof usePublicClient>>;

/** Pages an eth_getLogs-shaped fetch through MAX_LOG_RANGE-sized chunks. */
async function scanChunked<T>(
  fromBlock: bigint,
  toBlock: bigint,
  fetchChunk: (chunkStart: bigint, chunkEnd: bigint) => Promise<T[]>
): Promise<T[]> {
  const results: T[] = [];
  let chunkStart = fromBlock;
  while (chunkStart <= toBlock) {
    const chunkEnd = chunkStart + MAX_LOG_RANGE - 1n > toBlock ? toBlock : chunkStart + MAX_LOG_RANGE - 1n;
    results.push(...(await fetchChunk(chunkStart, chunkEnd)));
    chunkStart = chunkEnd + 1n;
  }
  return results;
}

/**
 * Distinct UTC days where pool-sourced GNRM transfers to this wallet
 * summed to at least MIN_DAILY_BUY — a day can clear the bar via several
 * smaller buys, so amounts are summed per day before comparing, not
 * checked transfer-by-transfer (mirrors useGnrmPurchaseCheck's same-day
 * logic, just replayed across full history instead of a 24h window).
 */
async function scanGnrmBuyDays(publicClient: PublicClient, address: Address, toBlock: bigint): Promise<number> {
  const toUserLogs = await scanChunked(SCAN_START_BLOCK, toBlock, (from, to) =>
    publicClient.getLogs({
      address: GNRM_ADDRESS,
      event: TRANSFER_EVENT,
      args: { to: address },
      fromBlock: from,
      toBlock: to,
    })
  );
  if (toUserLogs.length === 0) return 0;

  const fromPoolLogs = await scanChunked(SCAN_START_BLOCK, toBlock, (from, to) =>
    publicClient.getLogs({
      address: GNRM_ADDRESS,
      event: TRANSFER_EVENT,
      args: { from: GNRM_POOL_ADDRESS },
      fromBlock: from,
      toBlock: to,
    })
  );
  const poolTxHashes = new Set(fromPoolLogs.map((log) => log.transactionHash));
  const qualifying = toUserLogs.filter((log) => poolTxHashes.has(log.transactionHash));
  if (qualifying.length === 0) return 0;

  const blockNumbers = [...new Set(qualifying.map((log) => log.blockNumber))];
  const blocks = await Promise.all(blockNumbers.map((bn) => publicClient.getBlock({ blockNumber: bn! })));
  const timestampByBlock = new Map(blocks.map((b) => [b.number, b.timestamp]));

  const totalsByDay = new Map<bigint, bigint>();
  for (const log of qualifying) {
    const ts = timestampByBlock.get(log.blockNumber!)!;
    const day = ts / SECONDS_PER_DAY;
    totalsByDay.set(day, (totalsByDay.get(day) ?? 0n) + (log.args.value ?? 0n));
  }

  let qualifyingDays = 0;
  for (const total of totalsByDay.values()) {
    if (total >= MIN_DAILY_BUY) qualifyingDays++;
  }
  return qualifyingDays;
}

/**
 * Replays every stGNRM mint (stake) and burn (unstake) for this wallet in
 * day order against a running balance, starting from a claim baseline of
 * 0. Each day the balance first clears baseline+20,000 GNRM counts as one
 * claim and resets the baseline to that day's ending balance — so the
 * first-ever stake needs to reach 20,000 to count, and every claim after
 * needs another +20,000 on top of the last one. At most one claim per
 * day even if the threshold is crossed twice in it. Plain P2P transfers
 * are ignored — only mint/burn count as "staking", matching
 * useStakedTodayCheck's existing definition.
 */
async function scanStakeClaims(publicClient: PublicClient, address: Address, toBlock: bigint): Promise<number> {
  const mintLogs = await scanChunked(SCAN_START_BLOCK, toBlock, (from, to) =>
    publicClient.getLogs({
      address: STGNRM_ADDRESS,
      event: TRANSFER_EVENT,
      args: { from: ZERO_ADDRESS, to: address },
      fromBlock: from,
      toBlock: to,
    })
  );
  if (mintLogs.length === 0) return 0;

  const burnLogs = await scanChunked(SCAN_START_BLOCK, toBlock, (from, to) =>
    publicClient.getLogs({
      address: STGNRM_ADDRESS,
      event: TRANSFER_EVENT,
      args: { from: address, to: ZERO_ADDRESS },
      fromBlock: from,
      toBlock: to,
    })
  );

  const blockNumbers = [...new Set([...mintLogs, ...burnLogs].map((log) => log.blockNumber))];
  const blocks = await Promise.all(blockNumbers.map((bn) => publicClient.getBlock({ blockNumber: bn! })));
  const timestampByBlock = new Map(blocks.map((b) => [b.number, b.timestamp]));

  const netByDay = new Map<bigint, bigint>();
  for (const log of mintLogs) {
    const day = timestampByBlock.get(log.blockNumber!)! / SECONDS_PER_DAY;
    netByDay.set(day, (netByDay.get(day) ?? 0n) + (log.args.value ?? 0n));
  }
  for (const log of burnLogs) {
    const day = timestampByBlock.get(log.blockNumber!)! / SECONDS_PER_DAY;
    netByDay.set(day, (netByDay.get(day) ?? 0n) - (log.args.value ?? 0n));
  }

  const days = [...netByDay.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let balance = 0n;
  let claimBaseline = 0n;
  let claims = 0;
  for (const day of days) {
    balance += netByDay.get(day)!;
    if (balance >= claimBaseline + STAKE_GROWTH_THRESHOLD) {
      claims++;
      claimBaseline = balance;
    }
  }
  return claims;
}

/** Total confirmed shares ever — the contracts already cap one per day. */
async function scanShareCount(
  publicClient: PublicClient,
  contractAddress: Address,
  event: typeof SHARE_CONFIRMED_EVENT | typeof BATTLE_SHARE_CONFIRMED_EVENT,
  address: Address,
  toBlock: bigint
): Promise<number> {
  const logs = await scanChunked(SCAN_START_BLOCK, toBlock, (from, to) =>
    publicClient.getLogs({
      address: contractAddress,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: event as any,
      args: { user: address },
      fromBlock: from,
      toBlock: to,
    })
  );
  return logs.length;
}

/** Count of rolling 7-day buckets (day/7, same bucketing as the contract) where all 7 days were checked in. */
async function scanPerfectWeeks(
  publicClient: PublicClient,
  dailyCheckInAddress: Address,
  address: Address,
  toBlock: bigint
): Promise<number> {
  const logs = await scanChunked(SCAN_START_BLOCK, toBlock, (from, to) =>
    publicClient.getLogs({
      address: dailyCheckInAddress,
      event: CHECKED_IN_EVENT,
      args: { user: address },
      fromBlock: from,
      toBlock: to,
    })
  );

  const daysHitPerWeek = new Map<bigint, Set<bigint>>();
  for (const log of logs) {
    const day = log.args.day as bigint;
    const week = day / 7n;
    if (!daysHitPerWeek.has(week)) daysHitPerWeek.set(week, new Set());
    daysHitPerWeek.get(week)!.add(day);
  }

  let perfectWeeks = 0;
  for (const daysSet of daysHitPerWeek.values()) {
    if (daysSet.size === 7) perfectWeeks++;
  }
  return perfectWeeks;
}

type ExpHistoryData = Omit<ExpHistory, "refetch">;

const EMPTY_DATA: ExpHistoryData = {
  loading: true,
  gnrmBuyDays: 0,
  stakeClaims: 0,
  dossierShares: 0,
  arenaShares: 0,
  perfectWeeks: 0,
  bonusExp: 0,
};

/**
 * Permanent EXP bonuses reconstructed from pure on-chain event history,
 * rather than "is this true right now" flags (which reset at UTC
 * midnight and made the tasks page's displayed total look like it was
 * decaying every day). Since it's a deterministic replay of immutable
 * events, there's nothing to persist or trust beyond the chain itself —
 * recomputing it always gives the same answer.
 *
 * The scan only re-runs on wallet change by itself — completing a task
 * mid-session doesn't touch `address` or `publicClient`, so the returned
 * `refetch()` exists for the page to call right after any task-completing
 * action succeeds (stake, GNRM buy, dossier/arena share, check-in),
 * otherwise the total would look frozen until the next reload.
 */
export function useExpHistory(address: Address | undefined): ExpHistory {
  const [data, setData] = useState<ExpHistoryData>(EMPTY_DATA);
  const [refreshKey, setRefreshKey] = useState(0);
  const publicClient = usePublicClient({ chainId: base.id });

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!address || !publicClient) return;

    let cancelled = false;

    (async () => {
      setData((prev) => ({ ...prev, loading: true }));

      const contracts = getContracts(base.id);
      const toBlock = await publicClient.getBlockNumber();

      const [gnrmBuyDays, stakeClaims, dossierShares, arenaShares, perfectWeeks] = await Promise.all([
        scanGnrmBuyDays(publicClient, address, toBlock),
        scanStakeClaims(publicClient, address, toBlock),
        isPlaceholder(contracts.dossierShareLog)
          ? Promise.resolve(0)
          : scanShareCount(publicClient, contracts.dossierShareLog, SHARE_CONFIRMED_EVENT, address, toBlock),
        isPlaceholder(contracts.arenaBattleLog)
          ? Promise.resolve(0)
          : scanShareCount(publicClient, contracts.arenaBattleLog, BATTLE_SHARE_CONFIRMED_EVENT, address, toBlock),
        isPlaceholder(contracts.dailyCheckIn)
          ? Promise.resolve(0)
          : scanPerfectWeeks(publicClient, contracts.dailyCheckIn, address, toBlock),
      ]);

      if (cancelled) return;

      const bonusExp =
        gnrmBuyDays * 12 + stakeClaims * 50 + dossierShares * 8 + arenaShares * 8 + perfectWeeks * 200;

      setData({
        loading: false,
        gnrmBuyDays,
        stakeClaims,
        dossierShares,
        arenaShares,
        perfectWeeks,
        bonusExp,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient, refreshKey]);

  if (!address) return EMPTY;
  return { ...data, refetch };
}
