const BASE_BLOCK_TIME_SECONDS = 2;
const BUFFER_BLOCKS = 300n; // ~10 min cushion for block-time drift

/**
 * Estimates the block nearest today's UTC 00:00, so an eth_getLogs window
 * can approximate "since the start of the UTC day" rather than "the last
 * N blocks." Base's block time isn't perfectly constant, so this is an
 * approximation — buffered to slightly over-include rather than risk
 * missing a same-day event right at the boundary.
 */
export function utcMidnightFromBlock(currentBlock: bigint): bigint {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const secondsSinceMidnight = BigInt(Math.floor((now.getTime() - utcMidnight) / 1000));
  const blocksSinceMidnight = secondsSinceMidnight / BigInt(BASE_BLOCK_TIME_SECONDS) + BUFFER_BLOCKS;
  return currentBlock > blocksSinceMidnight ? currentBlock - blocksSinceMidnight : 0n;
}
