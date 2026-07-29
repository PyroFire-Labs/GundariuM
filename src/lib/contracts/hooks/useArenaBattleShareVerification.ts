"use client";

import { useAccount, useChainId, useReadContract } from "wagmi";
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

/** Read-only status for the /tasks Arena row — no button lives there. */
export function useArenaBattleShareStatus() {
  const chainId = useChainId();
  const { address } = useAccount();

  let contractAddress: `0x${string}` | undefined;
  try {
    const contracts = getContracts(chainId);
    contractAddress = isPlaceholder(contracts.arenaBattleLog) ? undefined : contracts.arenaBattleLog;
  } catch {
    contractAddress = undefined;
  }

  const { data } = useReadContract({
    address: contractAddress,
    abi: ARENA_BATTLE_LOG_ABI,
    functionName: "hasSharedToday",
    args: address ? [address] : undefined,
    query: { enabled: !!contractAddress && !!address },
  });

  return !!data;
}
