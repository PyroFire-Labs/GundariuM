"use client";

import { useChainId } from "wagmi";
import { DOSSIER_SHARE_LOG_ABI } from "@/lib/contracts/abis/DossierShareLog";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { useVerifiedShare } from "@/lib/contracts/hooks/useVerifiedShare";

export function useDossierShareVerification({ streak, exp }: { streak: number; exp: number }) {
  const chainId = useChainId();

  let contractAddress: `0x${string}` | undefined;
  try {
    const contracts = getContracts(chainId);
    contractAddress = isPlaceholder(contracts.dossierShareLog) ? undefined : contracts.dossierShareLog;
  } catch {
    contractAddress = undefined;
  }

  return useVerifiedShare({
    contractAddress,
    abi: DOSSIER_SHARE_LOG_ABI,
    confirmFunctionName: "confirmShare",
    buildConfirmArgs: () => [BigInt(streak), BigInt(exp)] as const,
  });
}
