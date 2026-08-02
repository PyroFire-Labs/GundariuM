/**
 * Shared per-wallet EXP-history scan+cache logic, computing the exact
 * same bonus formula both /api/exp-history (on-demand, single wallet,
 * called from /tasks) and refresh-leaderboard (batch, every ranked
 * participant) use — they used to disagree, since the leaderboard only
 * ever counted streak/check-ins/minted-count and never this bonus, so
 * the same wallet showed two different totals in two different places.
 *
 * Two entry points, deliberately different: updateExpHistory scans for
 * new blocks (bounded, paced, retried) and writes the cache forward —
 * only /api/exp-history calls this, once per real page visit.
 * getExpHistoryTotals only reads whatever's already cached, no scanning
 * — the leaderboard cron calls this for every participant, since
 * actively scanning dozens of wallets inline on every run would blow
 * past a serverless function's time budget.
 */

import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { getExpHistoryRecord, setExpHistoryRecord, type ExpHistoryRecord } from "@/lib/expHistoryStore";

const GNRM_ADDRESS = "0x271b01cc11032a4e23f0200f8f57eb45176ab491" as const;
const GNRM_POOL_ADDRESS = "0x72d3338600cf47766e4f9e435be4879593870181" as const;
const MIN_DAILY_BUY = 30_000n * 10n ** 18n;
const STGNRM_ADDRESS = "0x7efdd2724910ed0e0614fa0c084eabd30c644c1d" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const STAKE_GROWTH_THRESHOLD = 20_000n * 10n ** 18n;
const SECONDS_PER_DAY = 86_400n;
const MAX_LOG_RANGE = 9_000n; // public RPC eth_getLogs range limit
// DailyCheckIn's mainnet deploy block. Nothing in the EXP-history system
// predates this — none of these daily tasks existed before it did.
const SCAN_START_BLOCK = 48_798_292n;
// Caps how much of a cold wallet's backlog a single call will attempt —
// see /api/exp-history's original comment for why (a full-history catch-up
// in one go is what tripped the public RPC's rate limit in the first place).
const MAX_BLOCKS_PER_REQUEST = 50_000n;
const CHUNK_DELAY_MS = 200;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_500;

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const CHECKED_IN_EVENT = parseAbiItem("event CheckedIn(address indexed user, uint256 day, uint256 streak)");
const SHARE_CONFIRMED_EVENT = parseAbiItem(
  "event ShareConfirmed(address indexed user, uint256 day, uint256 streak, uint256 exp)"
);
const BATTLE_SHARE_CONFIRMED_EVENT = parseAbiItem(
  "event BattleShareConfirmed(address indexed user, uint256 day, string playerName, string enemyName, bool won, uint16 hpPct)"
);

export const expHistoryPublicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function scanChunked<T>(
  fromBlock: bigint,
  toBlock: bigint,
  fetchChunk: (chunkStart: bigint, chunkEnd: bigint) => Promise<T[]>
): Promise<T[]> {
  const results: T[] = [];
  let chunkStart = fromBlock;
  while (chunkStart <= toBlock) {
    const chunkEnd = chunkStart + MAX_LOG_RANGE - 1n > toBlock ? toBlock : chunkStart + MAX_LOG_RANGE - 1n;
    results.push(...(await withRetry(() => fetchChunk(chunkStart, chunkEnd))));
    chunkStart = chunkEnd + 1n;
    if (chunkStart <= toBlock) await sleep(CHUNK_DELAY_MS);
  }
  return results;
}

async function getBlocksSequentially(blockNumbers: bigint[]) {
  const blocks = [];
  for (const bn of blockNumbers) {
    blocks.push(await withRetry(() => expHistoryPublicClient.getBlock({ blockNumber: bn })));
    await sleep(CHUNK_DELAY_MS);
  }
  return blocks;
}

function emptyRecord(): ExpHistoryRecord {
  return {
    lastScannedBlock: (SCAN_START_BLOCK - 1n).toString(),
    gnrmBuyTotalsByDay: {},
    stakeNetByDay: {},
    dossierShareCount: 0,
    arenaShareCount: 0,
    checkedInDaysByWeek: {},
  };
}

export interface ExpHistoryTotals {
  gnrmBuyDays: number;
  stakeClaims: number;
  dossierShares: number;
  arenaShares: number;
  perfectWeeks: number;
  /** gnrmBuyDays*12 + stakeClaims*50 + dossierShares*8 + arenaShares*8 + perfectWeeks*200 */
  bonusExp: number;
}

function deriveTotals(record: ExpHistoryRecord): ExpHistoryTotals {
  let gnrmBuyDays = 0;
  for (const total of Object.values(record.gnrmBuyTotalsByDay)) {
    if (BigInt(total) >= MIN_DAILY_BUY) gnrmBuyDays++;
  }

  const days = Object.keys(record.stakeNetByDay)
    .map((d) => BigInt(d))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let balance = 0n;
  let claimBaseline = 0n;
  let stakeClaims = 0;
  for (const day of days) {
    balance += BigInt(record.stakeNetByDay[day.toString()]);
    if (balance >= claimBaseline + STAKE_GROWTH_THRESHOLD) {
      stakeClaims++;
      claimBaseline = balance;
    }
  }

  let perfectWeeks = 0;
  for (const daysArr of Object.values(record.checkedInDaysByWeek)) {
    if (daysArr.length === 7) perfectWeeks++;
  }

  const dossierShares = record.dossierShareCount;
  const arenaShares = record.arenaShareCount;
  const bonusExp = gnrmBuyDays * 12 + stakeClaims * 50 + dossierShares * 8 + arenaShares * 8 + perfectWeeks * 200;

  return { gnrmBuyDays, stakeClaims, dossierShares, arenaShares, perfectWeeks, bonusExp };
}

/**
 * Incrementally catches up one wallet's cached EXP-history record and
 * returns its derived totals. Only scans the delta since the wallet's
 * last scanned block, bounded to MAX_BLOCKS_PER_REQUEST — a badly-behind
 * wallet just needs another call or two to fully converge, never one
 * large burst.
 */
/**
 * Reads whatever is already cached for this wallet and derives totals
 * from it, without scanning for new blocks. For batch callers (the
 * leaderboard cron, ranking every participant every run) — actively
 * catching up dozens of wallets inline, each needing its own paced,
 * possibly-multi-chunk scan, blows well past a serverless function's
 * time budget. Only updateExpHistory (called per-wallet from
 * /api/exp-history when someone actually visits /tasks) should scan;
 * this just reads whatever that's already pushed forward.
 */
export async function getExpHistoryTotals(address: Address): Promise<ExpHistoryTotals> {
  const record = (await getExpHistoryRecord(address)) ?? emptyRecord();
  return deriveTotals(record);
}

export async function updateExpHistory(address: Address): Promise<ExpHistoryTotals> {
  const record = (await getExpHistoryRecord(address)) ?? emptyRecord();
  const fromBlock = BigInt(record.lastScannedBlock) + 1n;
  const chainTip = await withRetry(() => expHistoryPublicClient.getBlockNumber());

  if (fromBlock > chainTip) {
    return deriveTotals(record);
  }

  const toBlock = fromBlock + MAX_BLOCKS_PER_REQUEST - 1n > chainTip ? chainTip : fromBlock + MAX_BLOCKS_PER_REQUEST - 1n;

  const contracts = getContracts(base.id);

  // 1. GNRM buys — sum pool-sourced transfers per UTC day.
  const toUserLogs = await scanChunked(fromBlock, toBlock, (a, b) =>
    expHistoryPublicClient.getLogs({
      address: GNRM_ADDRESS,
      event: TRANSFER_EVENT,
      args: { to: address },
      fromBlock: a,
      toBlock: b,
    })
  );
  if (toUserLogs.length > 0) {
    const fromPoolLogs = await scanChunked(fromBlock, toBlock, (a, b) =>
      expHistoryPublicClient.getLogs({
        address: GNRM_ADDRESS,
        event: TRANSFER_EVENT,
        args: { from: GNRM_POOL_ADDRESS },
        fromBlock: a,
        toBlock: b,
      })
    );
    const poolTxHashes = new Set(fromPoolLogs.map((l) => l.transactionHash));
    const qualifying = toUserLogs.filter((l) => poolTxHashes.has(l.transactionHash));
    if (qualifying.length > 0) {
      const blockNumbers = [...new Set(qualifying.map((l) => l.blockNumber!))];
      const blocks = await getBlocksSequentially(blockNumbers);
      const tsByBlock = new Map(blocks.map((b) => [b.number, b.timestamp]));
      for (const log of qualifying) {
        const day = (tsByBlock.get(log.blockNumber!)! / SECONDS_PER_DAY).toString();
        const prev = BigInt(record.gnrmBuyTotalsByDay[day] ?? "0");
        record.gnrmBuyTotalsByDay[day] = (prev + (log.args.value ?? 0n)).toString();
      }
    }
  }

  // 2. Stakes — net stGNRM mint/burn per UTC day.
  const mintLogs = await scanChunked(fromBlock, toBlock, (a, b) =>
    expHistoryPublicClient.getLogs({
      address: STGNRM_ADDRESS,
      event: TRANSFER_EVENT,
      args: { from: ZERO_ADDRESS, to: address },
      fromBlock: a,
      toBlock: b,
    })
  );
  const burnLogs = await scanChunked(fromBlock, toBlock, (a, b) =>
    expHistoryPublicClient.getLogs({
      address: STGNRM_ADDRESS,
      event: TRANSFER_EVENT,
      args: { from: address, to: ZERO_ADDRESS },
      fromBlock: a,
      toBlock: b,
    })
  );
  if (mintLogs.length > 0 || burnLogs.length > 0) {
    const blockNumbers = [...new Set([...mintLogs, ...burnLogs].map((l) => l.blockNumber!))];
    const blocks = await getBlocksSequentially(blockNumbers);
    const tsByBlock = new Map(blocks.map((b) => [b.number, b.timestamp]));
    for (const log of mintLogs) {
      const day = (tsByBlock.get(log.blockNumber!)! / SECONDS_PER_DAY).toString();
      const prev = BigInt(record.stakeNetByDay[day] ?? "0");
      record.stakeNetByDay[day] = (prev + (log.args.value ?? 0n)).toString();
    }
    for (const log of burnLogs) {
      const day = (tsByBlock.get(log.blockNumber!)! / SECONDS_PER_DAY).toString();
      const prev = BigInt(record.stakeNetByDay[day] ?? "0");
      record.stakeNetByDay[day] = (prev - (log.args.value ?? 0n)).toString();
    }
  }

  // 3. Dossier shares — the contract already caps one confirm per day.
  if (!isPlaceholder(contracts.dossierShareLog)) {
    const logs = await scanChunked(fromBlock, toBlock, (a, b) =>
      expHistoryPublicClient.getLogs({
        address: contracts.dossierShareLog,
        event: SHARE_CONFIRMED_EVENT,
        args: { user: address },
        fromBlock: a,
        toBlock: b,
      })
    );
    record.dossierShareCount += logs.length;
  }

  // 4. Arena shares — same one-per-day cap on the contract side.
  if (!isPlaceholder(contracts.arenaBattleLog)) {
    const logs = await scanChunked(fromBlock, toBlock, (a, b) =>
      expHistoryPublicClient.getLogs({
        address: contracts.arenaBattleLog,
        event: BATTLE_SHARE_CONFIRMED_EVENT,
        args: { user: address },
        fromBlock: a,
        toBlock: b,
      })
    );
    record.arenaShareCount += logs.length;
  }

  // 5. Perfect weeks — bucket CheckedIn days by day/7, same as the contract.
  if (!isPlaceholder(contracts.dailyCheckIn)) {
    const logs = await scanChunked(fromBlock, toBlock, (a, b) =>
      expHistoryPublicClient.getLogs({
        address: contracts.dailyCheckIn,
        event: CHECKED_IN_EVENT,
        args: { user: address },
        fromBlock: a,
        toBlock: b,
      })
    );
    for (const log of logs) {
      const day = (log.args.day as bigint).toString();
      const week = ((log.args.day as bigint) / 7n).toString();
      if (!record.checkedInDaysByWeek[week]) record.checkedInDaysByWeek[week] = [];
      if (!record.checkedInDaysByWeek[week].includes(day)) record.checkedInDaysByWeek[week].push(day);
    }
  }

  record.lastScannedBlock = toBlock.toString();
  await setExpHistoryRecord(address, record);

  return deriveTotals(record);
}
