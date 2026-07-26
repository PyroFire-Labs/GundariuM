"use client";

import { useChainId } from "wagmi";
import { ARENA_BATTLE_LOG_ABI } from "@/lib/contracts/abis/ArenaBattleLog";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { useVerifiedShare } from "@/lib/contracts/hooks/useVerifiedShare";

export function useArenaBattleShareVerification({
  playerName,
  enemyName,
  won,
  hpPct,
}: {
  playerName: string;
  enemyName: string;
  won: boolean;
  hpPct: number;
}) {
  const chainId = useChainId();

  let contractAddress: `0x${string}` | undefined;
  try {
    const contracts = getContracts(chainId);
    contractAddress = isPlaceholder(contracts.arenaBattleLog) ? undefined : contracts.arenaBattleLog;
  } catch {
    contractAddress = undefined;
  }

  return useVerifiedShare({
    contractAddress,
    abi: ARENA_BATTLE_LOG_ABI,
    confirmFunctionName: "confirmBattleShare",
    buildConfirmArgs: () => [playerName, enemyName, won, Math.round(hpPct)] as const,
  });
}
