"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import { parseAbiItem } from "viem";
import { base } from "viem/chains";
import { utcMidnightFromBlock } from "./utcDailyWindow";

export const STGNRM_ADDRESS = "0x7efdd2724910ed0e0614fa0c084eabd30c644c1d" as const;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const MAX_LOG_RANGE = 9_000n; // public RPC eth_getLogs range limit (see useGnrmPurchaseCheck)

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export type StakedTodayPhase = "idle" | "checking" | "verified" | "not-met" | "error";

/**
 * Verifies a GNRM stake happened since today's UTC 00:00 by checking for
 * a stGNRM mint (Transfer from the zero address) to the connected wallet.
 * stGNRM is Streme's StakedTokenV2 receipt token — staking mints new
 * stGNRM 1:1 to the staker. Same UTC-midnight-bounded, paginated-log
 * approach as useGnrmPurchaseCheck and useMintedTodayCheck. Runs
 * automatically on wallet change rather than waiting for a manual click.
 */
export function useStakedTodayCheck() {
  const [phase, setPhase] = useState<StakedTodayPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });

  const check = async (): Promise<StakedTodayPhase> => {
    if (!address || !publicClient) {
      setError("Wallet not connected");
      setPhase("error");
      return "error";
    }
    setPhase("checking");
    setError(null);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const windowStart = utcMidnightFromBlock(currentBlock);

      let found = false;
      let chunkStart = windowStart;
      while (chunkStart <= currentBlock && !found) {
        const chunkEnd =
          chunkStart + MAX_LOG_RANGE - 1n > currentBlock ? currentBlock : chunkStart + MAX_LOG_RANGE - 1n;

        const logs = await publicClient.getLogs({
          address: STGNRM_ADDRESS,
          event: TRANSFER_EVENT,
          args: { from: ZERO_ADDRESS, to: address },
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        });

        if (logs.length > 0) found = true;
        chunkStart = chunkEnd + 1n;
      }

      const result: StakedTodayPhase = found ? "verified" : "not-met";
      setPhase(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check failed";
      setError(msg);
      setPhase("error");
      return "error";
    }
  };

  useEffect(() => {
    if (address && publicClient) {
      check();
    } else {
      setPhase("idle");
    }
    // check intentionally omitted — see useGnrmPurchaseCheck for why.
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
