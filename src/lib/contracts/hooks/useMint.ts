"use client";

import { useState } from "react";
import {
  useWriteContract,
  usePublicClient,
  useChainId,
  useAccount,
  useReadContract,
} from "wagmi";
import { erc20Abi } from "viem";
import { GUNPLA_CARD_ABI } from "@/lib/contracts/abis/GunplaCard";
import { getContracts } from "@/lib/contracts/addresses";
import type { TraitSet, ArmorType } from "@/types/nft";
import { rarityToIndex } from "@/types/nft";

export type MintPhase =
  | "idle"
  | "approving"
  | "approved"
  | "minting"
  | "done"
  | "error";

const ARMOR_TYPE_MAP: Record<ArmorType, number> = {
  Standard: 0,
  Gundanium: 1,
  "Phase Shift": 2,
  "I-Field": 3,
  "GN Particle": 4,
  "Luna Titanium": 5,
};

const TRANSFER_SIG =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function traitsToOnchain(traits: TraitSet) {
  return {
    name: traits.name,
    series: traits.series,
    faction: traits.faction,
    pilotName: traits.pilotName,
    rarity: rarityToIndex(traits.rarity),
    armorType: ARMOR_TYPE_MAP[traits.armorType],
    hp: traits.hp,
    primaryWeapon: traits.primaryWeapon,
    primaryDamage: traits.primaryDamage,
    secondaryWeapon: traits.secondaryWeapon,
    secondaryDamage: traits.secondaryDamage,
    tertiaryWeapon: traits.tertiaryWeapon,
    tertiaryDamage: traits.tertiaryDamage,
    specialAttack: traits.specialAttack,
    specialDamage: traits.specialDamage,
    repaintColor: traits.repaintColor ?? "",
    decalId: traits.decalId ?? "",
  };
}

export function useMint() {
  const [phase, setPhase] = useState<MintPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try {
    contracts = getContracts(chainId);
  } catch {
    // unsupported chain — contracts will be null
  }

  const usdcAddress = process.env
    .NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  const { data: mintPriceData } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "mintPriceUsdc",
    query: { enabled: !!contracts },
  });

  // Fall back to the known constant (5 USDC, 6 decimals) if the read hasn't resolved yet
  const mintPrice = mintPriceData ?? BigInt(5_000_000);

  const approveMint = async () => {
    if (!contracts) return;
    try {
      setError(null);
      setPhase("approving");
      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [contracts.gunplaCard, mintPrice],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setPhase("approved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
      setPhase("error");
    }
  };

  const executeMint = async (
    tokenUri: string,
    traits: TraitSet
  ): Promise<bigint | null> => {
    if (!address || !contracts) return null;
    try {
      setPhase("minting");
      const hash = await writeContractAsync({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "mintCard",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: [address, tokenUri, traitsToOnchain(traits) as any],
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      setPhase("done");

      // Parse tokenId from Transfer(from, to, tokenId) event
      const transferLog = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === contracts!.gunplaCard.toLowerCase() &&
          log.topics[0] === TRANSFER_SIG
      );
      if (transferLog?.topics[3]) {
        return BigInt(transferLog.topics[3]);
      }
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mint failed");
      setPhase("error");
      return null;
    }
  };

  return {
    phase,
    error,
    mintPrice,
    contracts,
    approveMint,
    executeMint,
  };
}
