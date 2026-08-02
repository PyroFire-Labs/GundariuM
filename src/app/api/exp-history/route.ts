/**
 * GET /api/exp-history?address=0x...
 *
 * Server-side, incrementally-cached replacement for what useExpHistory
 * used to do client-side: reconstruct permanent EXP bonuses (GNRM buy
 * days, stake growth claims, dossier/arena share counts, perfect weeks)
 * from on-chain event history. Only the blocks since this wallet's last
 * scan are ever fetched, bounded to MAX_BLOCKS_PER_REQUEST and paced with
 * retries per chunk — a cold wallet more than that far behind just takes
 * a couple more (cheap) requests to fully catch up instead of one huge
 * burst. This is the fix for the previous client-side version, which
 * scanned a wallet's entire history from scratch on every page load and
 * every task completion, hammering the public RPC into its rate limit.
 */

import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { getExpHistoryRecord, setExpHistoryRecord, type ExpHistoryRecord } from "@/lib/expHistoryStore";

export const maxDuration = 60;

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
// Caps how much of a cold wallet's backlog a single request will attempt.
// A brand-new wallet can be ~700k+ blocks behind SCAN_START_BLOCK; trying
// to catch that up in one request means hundreds of getLogs calls in a
// burst, which is exactly what tripped the public RPC's rate limit even
// with incremental caching (the cache only helps from the SECOND request
// on — the first request for any wallet is still a cold scan). Bounding
// it here means a badly-behind wallet just takes a few more requests
// (each cheap) to fully catch up, spread across page loads/refetches,
// instead of one large burst.
const MAX_BLOCKS_PER_REQUEST = 50_000n;
const CHUNK_DELAY_MS = 200; // paces requests instead of firing chunks back-to-back
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries a rate-limited RPC call with a fixed backoff before giving up. */
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

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const CHECKED_IN_EVENT = parseAbiItem("event CheckedIn(address indexed user, uint256 day, uint256 streak)");
const SHARE_CONFIRMED_EVENT = parseAbiItem(
  "event ShareConfirmed(address indexed user, uint256 day, uint256 streak, uint256 exp)"
);
const BATTLE_SHARE_CONFIRMED_EVENT = parseAbiItem(
  "event BattleShareConfirmed(address indexed user, uint256 day, string playerName, string enemyName, bool won, uint16 hpPct)"
);

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

/**
 * Pages an eth_getLogs-shaped fetch through MAX_LOG_RANGE-sized chunks,
 * sequentially (not concurrently), with a small delay and a rate-limit
 * retry between each — the combination that actually stays under the
 * public RPC's rate limit instead of just reducing call count.
 */
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

/** Fetches blocks one at a time (not Promise.all) — a burst of concurrent requests is exactly what trips the rate limit even at small counts. */
async function getBlocksSequentially(blockNumbers: bigint[]) {
  const blocks = [];
  for (const bn of blockNumbers) {
    blocks.push(await withRetry(() => publicClient.getBlock({ blockNumber: bn })));
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

function deriveTotals(record: ExpHistoryRecord) {
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const addressParam = searchParams.get("address");
  if (!addressParam || !/^0x[a-fA-F0-9]{40}$/.test(addressParam)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  const address = addressParam.toLowerCase() as Address;

  const record = (await getExpHistoryRecord(address)) ?? emptyRecord();
  const fromBlock = BigInt(record.lastScannedBlock) + 1n;
  const chainTip = await withRetry(() => publicClient.getBlockNumber());

  if (fromBlock > chainTip) {
    return NextResponse.json(deriveTotals(record));
  }

  // Bounded to MAX_BLOCKS_PER_REQUEST — see its comment above. A wallet
  // more than that far behind just needs another request or two to fully
  // catch up; lastScannedBlock below reflects this window, not chainTip.
  const toBlock = fromBlock + MAX_BLOCKS_PER_REQUEST - 1n > chainTip ? chainTip : fromBlock + MAX_BLOCKS_PER_REQUEST - 1n;

  const contracts = getContracts(base.id);

  // 1. GNRM buys — sum pool-sourced transfers per UTC day.
  const toUserLogs = await scanChunked(fromBlock, toBlock, (a, b) =>
    publicClient.getLogs({ address: GNRM_ADDRESS, event: TRANSFER_EVENT, args: { to: address }, fromBlock: a, toBlock: b })
  );
  if (toUserLogs.length > 0) {
    const fromPoolLogs = await scanChunked(fromBlock, toBlock, (a, b) =>
      publicClient.getLogs({
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
    publicClient.getLogs({
      address: STGNRM_ADDRESS,
      event: TRANSFER_EVENT,
      args: { from: ZERO_ADDRESS, to: address },
      fromBlock: a,
      toBlock: b,
    })
  );
  const burnLogs = await scanChunked(fromBlock, toBlock, (a, b) =>
    publicClient.getLogs({
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
      publicClient.getLogs({
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
      publicClient.getLogs({
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
      publicClient.getLogs({
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

  return NextResponse.json(deriveTotals(record));
}
