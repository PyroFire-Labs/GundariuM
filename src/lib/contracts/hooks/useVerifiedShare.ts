"use client";

import { useRef, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import type { Abi } from "viem";
import { createGuardedWrite } from "@/lib/contracts/guardedWrite";

export type VerifiedSharePhase =
  | "idle"
  | "intent-pending"
  | "awaiting-share"
  | "confirm-pending"
  | "done"
  | "cancelled"
  | "error";

function mapError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Share verification failed";
  if (msg.includes("User rejected")) return "Signature cancelled";
  if (msg.includes("AlreadySharedToday") || msg.includes("AlreadyConfirmedToday")) {
    return "Already shared today";
  }
  if (msg.includes("NoIntentForToday")) {
    return "Share session expired — click Share again to restart";
  }
  return msg;
}

/**
 * Drives the two-transaction intent/confirm flow shared by DossierShareLog
 * and ArenaBattleLog: intentToShare() fires before the compose dialog opens,
 * the confirm transaction only fires after a real (non-null) cast result.
 * Reuses guardedWrite() for both transactions — same chain-recheck and
 * 20s-timeout safety net proven necessary for Farcaster's wallet bridge.
 */
export function useVerifiedShare(config: {
  contractAddress: `0x${string}` | undefined;
  abi: Abi;
  confirmFunctionName: string;
  buildConfirmArgs: () => readonly unknown[];
}) {
  const { contractAddress, abi, confirmFunctionName, buildConfirmArgs } = config;
  const [phase, setPhase] = useState<VerifiedSharePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [canRetryConfirm, setCanRetryConfirm] = useState(false);
  const lastConfirmArgsRef = useRef<readonly unknown[] | null>(null);

  const account = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const guardedWrite = createGuardedWrite(account, chainId, writeContractAsync);

  const { data: hasSharedTodayData, refetch: refetchHasSharedToday } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "hasSharedToday",
    args: account.address ? [account.address] : undefined,
    query: { enabled: !!contractAddress && !!account.address },
  });
  const hasSharedToday = !!hasSharedTodayData;

  const verifiedShare = async (
    composeCastFn: () => Promise<{ cast: unknown } | null>
  ): Promise<boolean> => {
    if (!contractAddress || !publicClient) return false;
    if (hasSharedToday) {
      setPhase("done");
      return false;
    }
    setError(null);
    try {
      setPhase("intent-pending");
      const intentHash = await guardedWrite({
        address: contractAddress,
        abi,
        functionName: "intentToShare",
        args: [],
      });
      await publicClient.waitForTransactionReceipt({ hash: intentHash });

      setPhase("awaiting-share");
      const result = await composeCastFn();
      if (!result?.cast) {
        setPhase("cancelled");
        return false;
      }

      const confirmArgs = buildConfirmArgs();
      lastConfirmArgsRef.current = confirmArgs;
      setCanRetryConfirm(true);
      setPhase("confirm-pending");
      const confirmHash = await guardedWrite({
        address: contractAddress,
        abi,
        functionName: confirmFunctionName,
        args: confirmArgs,
      });
      await publicClient.waitForTransactionReceipt({ hash: confirmHash });

      setPhase("done");
      refetchHasSharedToday();
      return true;
    } catch (e) {
      setError(mapError(e));
      setPhase("error");
      return false;
    }
  };

  const retryConfirm = async (): Promise<boolean> => {
    if (!contractAddress || !publicClient || !lastConfirmArgsRef.current) return false;
    setError(null);
    try {
      setPhase("confirm-pending");
      const confirmHash = await guardedWrite({
        address: contractAddress,
        abi,
        functionName: confirmFunctionName,
        args: lastConfirmArgsRef.current,
      });
      await publicClient.waitForTransactionReceipt({ hash: confirmHash });
      setPhase("done");
      refetchHasSharedToday();
      return true;
    } catch (e) {
      setError(mapError(e));
      setPhase("error");
      return false;
    }
  };

  return {
    phase,
    error,
    hasSharedToday,
    canRetryConfirm,
    verifiedShare,
    retryConfirm,
  };
}
