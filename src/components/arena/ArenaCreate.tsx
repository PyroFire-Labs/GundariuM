"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useWriteContract,
  usePublicClient,
  useReadContract,
} from "wagmi";
import { useArenaStore } from "@/store/useArenaStore";
import { useCollection } from "@/lib/contracts/hooks/useCollection";
import { GUNDANIUM_GAME_ABI } from "@/lib/contracts/abis/GundaniumGame";
import { ERC20_ABI } from "@/lib/contracts/abis/ERC20";
import { getContracts } from "@/lib/contracts/addresses";
import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";

const GNDM_ADDRESS = process.env.NEXT_PUBLIC_GNDM_ADDRESS as `0x${string}`;

const RARITY_CLASS: Record<string, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

const MIN_STAKE_GNDM = 10;

function formatGndm(amount: bigint): string {
  return (Number(amount) / 1e18).toLocaleString();
}

export function ArenaCreate() {
  const { myCard, stakeAmount, setMyCard, setStakeAmount, setStep, setSessionId, setError } =
    useArenaStore();
  const { cards, isLoading } = useCollection();
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<"pick" | "approving" | "creating">("pick");
  const [localError, setLocalError] = useState<string | null>(null);
  const [stakeInput, setStakeInput] = useState(MIN_STAKE_GNDM.toString());

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported */ }

  const stakeAmountBig = BigInt(Math.max(MIN_STAKE_GNDM, Number(stakeInput) || MIN_STAKE_GNDM)) * BigInt(1e18);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: GNDM_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && contracts ? [address, contracts.gundaniumGame] : undefined,
    query: { enabled: !!address && !!contracts && !!GNDM_ADDRESS },
  });

  const needsApproval = allowance === undefined ? null : allowance < stakeAmountBig;
  // null = loading, true = needs approval, false = good to go

  async function handleApprove() {
    if (!contracts || !address) return;
    try {
      setLocalError(null);
      setPhase("approving");
      const hash = await writeContractAsync({
        address: GNDM_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.gundaniumGame, stakeAmountBig],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refetchAllowance();
      setPhase("pick");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Approval failed");
      setPhase("pick");
    }
  }

  async function handleCreate() {
    if (!contracts || !myCard || !address) return;
    try {
      setLocalError(null);
      setPhase("creating");
      setStakeAmount(stakeAmountBig);

      const hash = await writeContractAsync({
        address: contracts.gundaniumGame,
        abi: GUNDANIUM_GAME_ABI,
        functionName: "startPVP",
        args: [myCard.tokenId, stakeAmountBig],
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });

      // Parse sessionId from PVPStarted event — topics[2] is sessionId (indexed)
      let sessionId: bigint | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === contracts.gundaniumGame.toLowerCase()) {
          if (log.topics[2]) {
            sessionId = BigInt(log.topics[2]);
            break;
          }
        }
      }
      if (!sessionId) sessionId = BigInt(1);

      setSessionId(sessionId);
      setStep("waiting");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to create match");
      setPhase("pick");
    }
  }

  const err = localError;
  const canCreate = !!myCard && needsApproval === false && phase === "pick";

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Stake input */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
        <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)]/50">
          STAKE AMOUNT
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={MIN_STAKE_GNDM}
            value={stakeInput}
            onChange={(e) => setStakeInput(e.target.value)}
            className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          />
          <span className="text-sm font-bold text-[var(--accent)]">GNDM</span>
        </div>
        <p className="text-xs text-[var(--foreground)]/40">
          Minimum {MIN_STAKE_GNDM} GNDM · Winner gets{" "}
          {formatGndm(stakeAmountBig * BigInt(19) / BigInt(10))} GNDM
        </p>
      </div>

      {/* Card picker */}
      <div>
        <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)]/50 mb-3">
          SELECT YOUR CARD
        </p>

        {isLoading && (
          <div className="flex items-center gap-2 py-4 text-[var(--accent)] text-sm">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            Loading your cards...
          </div>
        )}

        {!isLoading && cards.length === 0 && (
          <p className="text-sm text-[var(--foreground)]/50 py-4">
            No cards found. Mint one first.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <CardPickerItem
              key={card.tokenId.toString()}
              card={card}
              isSelected={myCard?.tokenId === card.tokenId}
              onSelect={() => setMyCard(card)}
            />
          ))}
        </div>
      </div>

      {err && <p className="text-red-400 text-sm text-center">{err}</p>}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setStep("lobby")}
          className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
        >
          Back
        </button>

        {phase === "approving" && (
          <div className="flex-[2] flex items-center justify-center gap-2 py-2.5">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--accent)] text-sm font-bold font-[family-name:var(--font-orbitron)]">
              APPROVING...
            </span>
          </div>
        )}

        {phase === "creating" && (
          <div className="flex-[2] flex items-center justify-center gap-2 py-2.5">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--accent)] text-sm font-bold font-[family-name:var(--font-orbitron)]">
              CREATING...
            </span>
          </div>
        )}

        {phase === "pick" && needsApproval === true && myCard && (
          <button
            onClick={handleApprove}
            className="flex-[2] py-2.5 rounded-lg bg-yellow-500 text-black font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:brightness-110 transition-all"
          >
            1 / 2 — APPROVE GNDM
          </button>
        )}

        {phase === "pick" && needsApproval !== true && (
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex-[2] py-2.5 rounded-lg bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            {!myCard ? "SELECT A CARD" : needsApproval === null ? "LOADING..." : "CREATE MATCH"}
          </button>
        )}
      </div>
    </div>
  );
}

function CardPickerItem({
  card,
  isSelected,
  onSelect,
}: {
  card: OwnedCard;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const rarityClass = RARITY_CLASS[card.traits.rarity] ?? "rarity-common";
  return (
    <button
      onClick={onSelect}
      className={`rounded-xl border-2 bg-[var(--surface)] p-3 text-left transition-all ${rarityClass} ${
        isSelected
          ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--background)]"
          : "opacity-70 hover:opacity-100"
      }`}
    >
      <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)] leading-tight">
        {card.traits.name}
      </p>
      <div className="mt-1 flex justify-between text-xs text-[var(--foreground)]/50">
        <span className="text-[var(--accent)] font-mono">{card.traits.hp} HP</span>
        <span>{card.traits.rarity}</span>
      </div>
    </button>
  );
}
