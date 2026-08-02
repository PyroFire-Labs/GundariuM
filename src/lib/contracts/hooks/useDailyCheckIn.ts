"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, usePublicClient, useAccount, useChainId } from "wagmi";
import { DAILY_CHECKIN_ABI } from "@/lib/contracts/abis/DailyCheckIn";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";

export type CheckInPhase = "idle" | "checking-in" | "done" | "error";

export function useDailyCheckIn() {
  const [phase, setPhase] = useState<CheckInPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try {
    contracts = getContracts(chainId);
  } catch {
    /* unsupported chain */
  }

  const checkInAddress = contracts?.dailyCheckIn;
  const contractReady = !!checkInAddress && !isPlaceholder(checkInAddress);

  const { data: streakData, refetch: refetchStreak } = useReadContract({
    address: checkInAddress,
    abi: DAILY_CHECKIN_ABI,
    functionName: "getStreak",
    args: address ? [address] : undefined,
    query: { enabled: contractReady && !!address },
  });

  const [current, longest, total, lastDay, weekCount] = streakData ?? [0n, 0n, 0n, 0n, 0n];
  const today = BigInt(Math.floor(Date.now() / 86_400_000));
  const checkedInToday = lastDay === today;
  const perfectWeek = weekCount === 7n;

  const checkIn = async () => {
    if (!contracts || !contractReady) return;
    setPhase("checking-in");
    setError(null);
    if (!publicClient) {
      setError("Wallet not connected to a supported network");
      setPhase("error");
      return;
    }
    try {
      const tx = await writeContractAsync({
        address: contracts.dailyCheckIn,
        abi: DAILY_CHECKIN_ABI,
        functionName: "checkIn",
        args: [],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 60_000 * 5 });

      // waitForTransactionReceipt resolves normally on a reverted tx too —
      // it doesn't throw. Without this check a revert (out of gas, RPC
      // hiccup, anything) still showed "done" and refetched, silently
      // reading back the unchanged on-chain state as if it had succeeded.
      if (receipt.status === "reverted") {
        setError("Check-in transaction reverted on-chain — please try again");
        setPhase("error");
        return;
      }

      setPhase("done");
      refetchStreak();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check-in failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  };

  return {
    currentStreak: Number(current),
    longestStreak: Number(longest),
    totalCheckIns: Number(total),
    checkInsThisWeek: Number(weekCount),
    perfectWeek,
    checkedInToday,
    phase,
    error,
    contractReady,
    checkIn,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
  };
}
