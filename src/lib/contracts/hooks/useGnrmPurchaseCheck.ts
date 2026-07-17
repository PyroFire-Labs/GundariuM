"use client";

import { useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import { parseAbiItem } from "viem";

const GNRM_ADDRESS = "0x271b01cc11032a4e23f0200f8f57eb45176ab491" as const;
const GNRM_POOL_ADDRESS = "0x72d3338600cf47766e4f9e435be4879593870181" as const;
const MIN_DAILY_BUY = 30_000n * 10n ** 18n; // 30,000 GNRM, 18 decimals
const BASE_BLOCKS_PER_DAY = 45_000n; // ~2s blocks on Base, buffered above the exact 43,200

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export type GnrmCheckPhase = "idle" | "checking" | "verified" | "not-met" | "error";

/**
 * Verifies a GNRM purchase by checking for a Transfer event from the
 * GNRM/WETH pool directly to the connected wallet — proves a real swap,
 * not just any incoming transfer. Window is an approximate rolling ~24h
 * (Base block times make exact UTC-midnight boundaries impractical to
 * pin down without an indexer), not a precise calendar-day check.
 */
export function useGnrmPurchaseCheck() {
  const [phase, setPhase] = useState<GnrmCheckPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const { address } = useAccount();
  const publicClient = usePublicClient();

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
      const fromBlock = currentBlock > BASE_BLOCKS_PER_DAY ? currentBlock - BASE_BLOCKS_PER_DAY : 0n;

      const logs = await publicClient.getLogs({
        address: GNRM_ADDRESS,
        event: TRANSFER_EVENT,
        args: { from: GNRM_POOL_ADDRESS, to: address },
        fromBlock,
        toBlock: "latest",
      });

      const total = logs.reduce((sum, log) => sum + (log.args.value ?? 0n), 0n);
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
