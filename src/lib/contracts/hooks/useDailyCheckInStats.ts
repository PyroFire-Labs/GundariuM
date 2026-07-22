"use client";

import { useReadContract, useChainId } from "wagmi";
import { DAILY_CHECKIN_ABI } from "@/lib/contracts/abis/DailyCheckIn";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";

/**
 * Read-only streak stats for an arbitrary address — for viewing someone
 * else's dossier. Deliberately separate from useDailyCheckIn(), which is
 * connected-wallet-only and bundles the checkIn() write action; mixing an
 * arbitrary-address read into that hook would make its write half
 * ambiguous about whose wallet it's acting on.
 */
export function useDailyCheckInStats(address: `0x${string}` | undefined) {
  const chainId = useChainId();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try {
    contracts = getContracts(chainId);
  } catch {
    /* unsupported chain */
  }

  const checkInAddress = contracts?.dailyCheckIn;
  const contractReady = !!checkInAddress && !isPlaceholder(checkInAddress);

  const { data: streakData, isLoading } = useReadContract({
    address: checkInAddress,
    abi: DAILY_CHECKIN_ABI,
    functionName: "getStreak",
    args: address ? [address] : undefined,
    query: { enabled: contractReady && !!address },
  });

  const [current, longest, total, , weekCount] = streakData ?? [0n, 0n, 0n, 0n, 0n];

  return {
    currentStreak: Number(current),
    longestStreak: Number(longest),
    totalCheckIns: Number(total),
    checkInsThisWeek: Number(weekCount),
    perfectWeek: weekCount === 7n,
    isLoading,
    contractReady,
  };
}
