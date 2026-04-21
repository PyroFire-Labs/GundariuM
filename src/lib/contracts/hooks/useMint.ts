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
    frameId: 0,
    colorShift: 0,
    repaintStyle: 0,
  };
}

export function useMint() {
  const [phase, setPhase] = useState<MintPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const chainId = useChainId();
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

  const account = useAccount();

  const { data: mintPriceData } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "mintPriceUsdc",
    query: { enabled: !!contracts },
  });

  // Fall back to the known constant (5 USDC, 6 decimals) if the read hasn't resolved yet
  const mintPrice = mintPriceData ?? BigInt(5_000_000);

  const { data: currentPhase } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "mintPhase",
  });

  const { data: wlMintCount } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "whitelistMintCount",
    args: account.address ? [account.address] : undefined,
  });

  const { data: mintCap } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "whitelistMintCap",
  });

  const { data: vipPrice } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "tierPrice",
    args: [1],
  });

  const { data: wlPrice } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "tierPrice",
    args: [2],
  });

  const approveMint = async (priceOverride?: bigint) => {
    if (!contracts) return;
    try {
      setError(null);
      setPhase("approving");
      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [contracts.gunplaCard, priceOverride ?? mintPrice],
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
    if (!account.address || !contracts) return null;
    try {
      setPhase("minting");
      const hash = await writeContractAsync({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "mintCard",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: [account.address, tokenUri, traitsToOnchain(traits) as any],
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

  async function executeWhitelistMint(
    tokenUri: string,
    traits: TraitSet,
    tier: number,
    proof: `0x${string}`[]
  ): Promise<bigint | null> {
    if (!contracts || !publicClient) return null;
    setPhase("minting");
    setError(null);
    try {
      const onchainTraits = traitsToOnchain(traits);
      const hash = await writeContractAsync({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "mintCardWhitelist",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: [account.address!, tokenUri, onchainTraits as any, tier, proof],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const transferLog = receipt.logs.find(
        (l) =>
          l.address.toLowerCase() === contracts!.gunplaCard.toLowerCase() &&
          l.topics[0] === TRANSFER_SIG
      );
      const tokenId =
        transferLog && transferLog.topics[3]
          ? BigInt(transferLog.topics[3])
          : null;
      setPhase("done");
      return tokenId;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Mint failed";
      setError(msg);
      setPhase("error");
      return null;
    }
  }

  return {
    phase,
    error,
    mintPrice,
    contracts,
    approveMint,
    executeMint,
    executeWhitelistMint,
    currentPhase: currentPhase as number | undefined,
    whitelistMintCount: wlMintCount as bigint | undefined,
    whitelistMintCap: mintCap as bigint | undefined,
    vipPrice: vipPrice as bigint | undefined,
    wlPrice: wlPrice as bigint | undefined,
  };
}
