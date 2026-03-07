"use client";

import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { GUNPLA_CARD_ABI } from "@/lib/contracts/abis/GunplaCard";
import { getContracts } from "@/lib/contracts/addresses";
import { indexToRarity } from "@/types/nft";
import type { TraitSet, ArmorType } from "@/types/nft";

const ARMOR_TYPES: ArmorType[] = [
  "Standard",
  "Gundanium",
  "Phase Shift",
  "I-Field",
  "GN Particle",
  "Luna Titanium",
];

export interface OwnedCard {
  tokenId: bigint;
  tokenUri: string;
  traits: TraitSet;
}

export function useCollection() {
  const { address } = useAccount();
  const chainId = useChainId();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try {
    contracts = getContracts(chainId);
  } catch {
    // unsupported chain
  }

  // 1. Get balance
  const { data: balance } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!contracts && !!address },
  });

  const count = balance ? Number(balance) : 0;

  // 2. Get all tokenIds owned
  const { data: tokenIdResults } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: contracts!.gunplaCard as `0x${string}`,
      abi: GUNPLA_CARD_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address!, BigInt(i)],
    })),
    query: { enabled: !!contracts && !!address && count > 0 },
  });

  const tokenIds = (tokenIdResults ?? [])
    .map((r) => (r.status === "success" ? (r.result as bigint) : null))
    .filter((id): id is bigint => id !== null);

  // 3. Batch fetch traits + tokenURI for each tokenId
  const { data: cardData, isLoading } = useReadContracts({
    contracts: tokenIds.flatMap((tokenId) => [
      {
        address: contracts!.gunplaCard as `0x${string}`,
        abi: GUNPLA_CARD_ABI,
        functionName: "getTraits" as const,
        args: [tokenId],
      },
      {
        address: contracts!.gunplaCard as `0x${string}`,
        abi: GUNPLA_CARD_ABI,
        functionName: "tokenURI" as const,
        args: [tokenId],
      },
    ]),
    query: { enabled: tokenIds.length > 0 },
  });

  // 4. Parse results into OwnedCard[]
  const cards: OwnedCard[] = [];

  if (cardData && tokenIds.length > 0) {
    for (let i = 0; i < tokenIds.length; i++) {
      const traitsResult = cardData[i * 2];
      const uriResult = cardData[i * 2 + 1];

      if (traitsResult?.status !== "success" || uriResult?.status !== "success") continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = traitsResult.result as any;
      const tokenUri = uriResult.result as string;

      const traits: TraitSet = {
        name: raw.name,
        series: raw.series,
        faction: raw.faction,
        pilotName: raw.pilotName,
        rarity: indexToRarity(Number(raw.rarity)),
        armorType: ARMOR_TYPES[Number(raw.armorType)] ?? "Standard",
        hp: Number(raw.hp),
        primaryWeapon: raw.primaryWeapon,
        primaryDamage: Number(raw.primaryDamage),
        secondaryWeapon: raw.secondaryWeapon,
        secondaryDamage: Number(raw.secondaryDamage),
        tertiaryWeapon: raw.tertiaryWeapon,
        tertiaryDamage: Number(raw.tertiaryDamage),
        specialAttack: raw.specialAttack,
        specialDamage: Number(raw.specialDamage),
        repaintColor: raw.repaintColor || undefined,
        decalId: raw.decalId || undefined,
      };

      cards.push({ tokenId: tokenIds[i], tokenUri, traits });
    }
  }

  return {
    cards,
    isLoading: isLoading || (count > 0 && tokenIds.length < count),
    isConnected: !!address,
    count,
  };
}
