"use client";

import { useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import { parseAbiItem } from "viem";
import { base } from "viem/chains";

const GNRM_ADDRESS = "0x271b01cc11032a4e23f0200f8f57eb45176ab491" as const;
const GNRM_POOL_ADDRESS = "0x72d3338600cf47766e4f9e435be4879593870181" as const;
const MIN_DAILY_BUY = 30_000n * 10n ** 18n; // 30,000 GNRM, 18 decimals
const BASE_BLOCKS_PER_DAY = 45_000n; // ~2s blocks on Base, buffered above the exact 43,200
const MAX_LOG_RANGE = 9_000n; // mainnet.base.org's public RPC caps eth_getLogs at 10,000 blocks/call

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export type GnrmCheckPhase = "idle" | "checking" | "verified" | "not-met" | "error";

/**
 * Verifies a GNRM purchase by checking for a Transfer event from the
 * GNRM/WETH pool directly to the connected wallet — proves the tokens
 * came from the pool contract itself (a swap or an LP action), not an
 * arbitrary wallet. Window is an approximate rolling ~24h (Base block
 * times make exact UTC-midnight boundaries impractical to pin down
 * without an indexer), not a precise calendar-day check.
 */
export function useGnrmPurchaseCheck() {
  const [phase, setPhase] = useState<GnrmCheckPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });

  const check = async () => {
    if (!address || !publicClient) {
      setError("Wallet not connected");
      setPhase("error");
      return;
    }
    setPhase("checking");
    setError(null);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const windowStart = currentBlock > BASE_BLOCKS_PER_DAY ? currentBlock - BASE_BLOCKS_PER_DAY : 0n;

      // mainnet.base.org rejects eth_getLogs over more than ~10,000 blocks,
      // but the daily-purchase window is ~45,000 blocks — page through it
      // in chunks that stay under the limit.
      let total = 0n;
      let chunkStart = windowStart;
      while (chunkStart <= currentBlock) {
        const chunkEnd =
          chunkStart + MAX_LOG_RANGE - 1n > currentBlock ? currentBlock : chunkStart + MAX_LOG_RANGE - 1n;

        const logs = await publicClient.getLogs({
          address: GNRM_ADDRESS,
          event: TRANSFER_EVENT,
          args: { from: GNRM_POOL_ADDRESS, to: address },
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        });

        total += logs.reduce((sum, log) => sum + (log.args.value ?? 0n), 0n);
        chunkStart = chunkEnd + 1n;
      }

      setPhase(total >= MIN_DAILY_BUY ? "verified" : "not-met");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check failed";
      setError(msg);
      setPhase("error");
    }
  };

  return {
    phase,
    error,
    check,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
  };
}
