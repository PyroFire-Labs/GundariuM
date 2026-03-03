"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, usePublicClient, useAccount, useChainId } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { ERC20_ABI } from "@/lib/contracts/abis/ERC20";
import { GNDM_STAKING_ABI } from "@/lib/contracts/abis/GNDMStaking";
import { getContracts, GNDM_TOKEN_ADDRESS, isPlaceholder } from "@/lib/contracts/addresses";

export const TIERS = [
  { name: "Recruit",   min: 1_000_000,   unlocks: ["Dashboard access"] },
  { name: "Sergeant",  min: 5_000_000,   unlocks: ["⚔️ PVP", "🏆 Leaderboard"] },
  { name: "Commander", min: 25_000_000,  unlocks: ["Prize pool multiplier"] },
  { name: "Legend",    min: 100_000_000, unlocks: ["Exclusive status", "All perks"] },
] as const;

export type TierName = typeof TIERS[number]["name"];

export function getTier(stakedGndm: number): TierName | null {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (stakedGndm >= TIERS[i].min) return TIERS[i].name;
  }
  return null;
}

export type StakePhase = "idle" | "approving" | "staking" | "unstaking" | "done" | "error";

export function useStaking() {
  const [phase, setPhase] = useState<StakePhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported chain */ }

  const stakingAddress = contracts?.gndmStaking;
  const contractReady = !!stakingAddress && !isPlaceholder(stakingAddress);

  // Read GNDM balance
  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: GNDM_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read staked balance
  const { data: stakedRaw, refetch: refetchStaked } = useReadContract({
    address: stakingAddress,
    abi: GNDM_STAKING_ABI,
    functionName: "stakedBalance",
    args: address ? [address] : undefined,
    query: { enabled: contractReady && !!address },
  });

  // Read total staked
  const { data: totalStakedRaw } = useReadContract({
    address: stakingAddress,
    abi: GNDM_STAKING_ABI,
    functionName: "totalStaked",
    query: { enabled: contractReady },
  });

  const balance = balanceRaw ? parseFloat(formatUnits(balanceRaw, 18)) : 0;
  const staked = stakedRaw ? parseFloat(formatUnits(stakedRaw, 18)) : 0;
  const totalStaked = totalStakedRaw ? parseFloat(formatUnits(totalStakedRaw, 18)) : 0;
  const tier = getTier(staked);

  const stake = async (amount: string) => {
    if (!contracts || !contractReady) return;
    setPhase("approving");
    setError(null);
    try {
      const amountWei = parseUnits(amount, 18);
      // Step 1: approve
      const approveTx = await writeContractAsync({
        address: GNDM_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.gndmStaking, amountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: approveTx });

      // Step 2: stake
      setPhase("staking");
      const stakeTx = await writeContractAsync({
        address: contracts.gndmStaking,
        abi: GNDM_STAKING_ABI,
        functionName: "stake",
        args: [amountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: stakeTx });

      setPhase("done");
      refetchBalance();
      refetchStaked();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Staking failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  };

  const unstake = async (amount: string) => {
    if (!contracts || !contractReady) return;
    setPhase("unstaking");
    setError(null);
    try {
      const amountWei = parseUnits(amount, 18);
      const tx = await writeContractAsync({
        address: contracts.gndmStaking,
        abi: GNDM_STAKING_ABI,
        functionName: "unstake",
        args: [amountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: tx });
      setPhase("done");
      refetchBalance();
      refetchStaked();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unstake failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  };

  return {
    balance,
    staked,
    totalStaked,
    tier,
    phase,
    error,
    contractReady,
    stake,
    unstake,
    reset: () => { setPhase("idle"); setError(null); },
  };
}
