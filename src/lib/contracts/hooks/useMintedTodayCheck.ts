"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useAccount, useChainId } from "wagmi";
import { parseAbiItem } from "viem";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { utcMidnightFromBlock } from "./utcDailyWindow";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const MAX_LOG_RANGE = 9_000n; // public RPC eth_getLogs range limit (see useGnrmPurchaseCheck)

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

export type MintedTodayPhase = "idle" | "checking" | "verified" | "not-met" | "error";

/**
 * Verifies a mint happened since today's UTC 00:00 by checking for an
 * ERC-721 Transfer from the zero address (a mint) to the connected wallet
 * on GunplaCard. Same paginated-log-range approach as
 * useGnrmPurchaseCheck, including the UTC-midnight-bounded window. Runs
 * automatically on wallet/chain change rather than waiting for a manual
 * click, so a page refresh reflects real on-chain state instead of
 * resetting to idle.
 */
export function useMintedTodayCheck() {
  const [phase, setPhase] = useState<MintedTodayPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try {
    contracts = getContracts(chainId);
  } catch {
    /* unsupported chain */
  }

  const cardAddress = contracts?.gunplaCard;
  const contractReady = !!cardAddress && !isPlaceholder(cardAddress);

  const check = async () => {
    if (!address || !publicClient || !contractReady || !cardAddress) {
      setError("Wallet not connected to a supported network");
      setPhase("error");
      return;
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
          address: cardAddress,
          event: TRANSFER_EVENT,
          args: { from: ZERO_ADDRESS, to: address },
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        });

        if (logs.length > 0) found = true;
        chunkStart = chunkEnd + 1n;
      }

      setPhase(found ? "verified" : "not-met");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check failed";
      setError(msg);
      setPhase("error");
    }
  };

  useEffect(() => {
    if (address && publicClient && contractReady) {
      check();
    } else {
      setPhase("idle");
    }
    // check intentionally omitted — see useGnrmPurchaseCheck for why.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicClient, contractReady]);

  return {
    phase,
    error,
    contractReady,
    check,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
  };
}
