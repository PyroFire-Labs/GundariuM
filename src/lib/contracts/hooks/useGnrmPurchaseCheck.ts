"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import { parseAbiItem } from "viem";
import { base } from "viem/chains";
import { utcMidnightFromBlock } from "./utcDailyWindow";

const GNRM_ADDRESS = "0x271b01cc11032a4e23f0200f8f57eb45176ab491" as const;
const GNRM_POOL_ADDRESS = "0x72d3338600cf47766e4f9e435be4879593870181" as const;
const MIN_DAILY_BUY = 30_000n * 10n ** 18n; // 30,000 GNRM, 18 decimals
const MAX_LOG_RANGE = 9_000n; // mainnet.base.org's public RPC caps eth_getLogs at 10,000 blocks/call

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export type GnrmCheckPhase = "idle" | "checking" | "verified" | "not-met" | "error";

/**
 * Verifies a GNRM purchase by checking for a Transfer event from the
 * GNRM/WETH pool directly to the connected wallet — proves the tokens
 * came from the pool contract itself (a swap or an LP action), not an
 * arbitrary wallet. Window is bounded by an estimated block for today's
 * UTC 00:00 (approximate, since Base's block time isn't perfectly
 * constant), not a rolling N-blocks-ago window. Runs automatically
 * whenever the connected wallet changes, so the verified/not-met result
 * reflects real on-chain state on every page load rather than resetting
 * to idle until manually re-checked.
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
      const windowStart = utcMidnightFromBlock(currentBlock);

      // mainnet.base.org rejects eth_getLogs over more than ~10,000 blocks,
      // but the since-UTC-midnight window can span up to ~45,000 — page
      // through it in chunks that stay under the limit.
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

  useEffect(() => {
    if (address && publicClient) {
      check();
    } else {
      setPhase("idle");
    }
    // check is intentionally omitted: it's a plain (non-memoized) function
    // recreated every render, and this effect should only re-run when the
    // wallet/client actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicClient]);

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
