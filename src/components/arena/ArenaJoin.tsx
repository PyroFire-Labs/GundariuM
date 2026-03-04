"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useWriteContract,
  usePublicClient,
  useReadContract,
  useReadContracts,
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

function formatGndm(amount: bigint): string {
  return (Number(amount) / 1e18).toLocaleString();
}

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ArenaJoin() {
  const { myCard, setMyCard, setStakeAmount, setSessionId, setStep, setError } = useArenaStore();
  const { cards, isLoading: cardsLoading } = useCollection();
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [selectedSessionId, setSelectedSessionId] = useState<bigint | null>(null);
  const [phase, setPhase] = useState<"browse" | "approving" | "joining">("browse");
  const [localError, setLocalError] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported */ }

  // Load the open session queue
  const { data: queueIds } = useReadContract({
    address: contracts?.gundaniumGame,
    abi: GUNDANIUM_GAME_ABI,
    functionName: "getPVPQueue",
    query: { enabled: !!contracts, refetchInterval: 10_000 },
  });

  // Batch-read session data for up to 20 queue entries
  const idsToCheck = (queueIds ?? []).slice(0, 20);
  const { data: sessionBatch } = useReadContracts({
    contracts: idsToCheck.map((id) => ({
      address: contracts!.gundaniumGame as `0x${string}`,
      abi: GUNDANIUM_GAME_ABI,
      functionName: "sessions" as const,
      args: [id],
    })),
    query: { enabled: !!contracts && idsToCheck.length > 0 },
  });

  // Filter to only Pending (status=0) sessions not owned by current user
  interface OpenSession {
    id: bigint;
    player1: `0x${string}`;
    stakeAmount: bigint;
  }
  const openSessions: OpenSession[] = [];
  if (sessionBatch) {
    for (let i = 0; i < idsToCheck.length; i++) {
      const r = sessionBatch[i];
      if (r?.status !== "success") continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = r.result as any;
      const status = Number(s[6]);
      const player1 = s[0] as `0x${string}`;
      if (status !== 0) continue; // not Pending
      if (address && player1.toLowerCase() === address.toLowerCase()) continue; // own session
      openSessions.push({ id: idsToCheck[i], player1, stakeAmount: s[4] as bigint });
    }
  }

  // Fetch selected session's stake for approval
  const { data: selSession } = useReadContract({
    address: contracts?.gundaniumGame,
    abi: GUNDANIUM_GAME_ABI,
    functionName: "sessions",
    args: selectedSessionId != null ? [selectedSessionId] : undefined,
    query: { enabled: !!contracts && selectedSessionId != null },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selStake: bigint = (selSession as any)?.[4] ?? BigInt(0);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: GNDM_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && contracts ? [address, contracts.gundaniumGame] : undefined,
    query: { enabled: !!address && !!contracts && !!GNDM_ADDRESS },
  });

  const needsApproval = !!selStake && (allowance === undefined || allowance < selStake);

  function handleSelectSession(id: bigint) {
    setSelectedSessionId(id);
    setMyCard(null as unknown as OwnedCard); // reset card selection
  }

  async function handleApprove() {
    if (!contracts || !address || !selStake) return;
    try {
      setLocalError(null);
      setPhase("approving");
      const hash = await writeContractAsync({
        address: GNDM_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.gundaniumGame, selStake],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refetchAllowance();
      setPhase("browse");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Approval failed");
      setPhase("browse");
    }
  }

  async function handleJoin() {
    if (!contracts || !myCard || !selectedSessionId || !address) return;
    try {
      setLocalError(null);
      setPhase("joining");
      setStakeAmount(selStake);

      const hash = await writeContractAsync({
        address: contracts.gundaniumGame,
        abi: GUNDANIUM_GAME_ABI,
        functionName: "joinPVP",
        args: [selectedSessionId, myCard.tokenId],
      });
      await publicClient!.waitForTransactionReceipt({ hash });

      // Store sessionId and proceed to resolve
      setSessionId(selectedSessionId);
      setError(null);
      setStep("resolving");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to join match");
      setPhase("browse");
    }
  }

  function handleManualJoin() {
    const parsed = BigInt(manualId.trim() || "0");
    if (parsed > 0n) handleSelectSession(parsed);
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Manual session ID entry */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
        <p className="text-xs font-bold text-[var(--foreground)]/40 font-[family-name:var(--font-orbitron)]">
          ENTER SESSION ID
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            placeholder="Session #"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={handleManualJoin}
            disabled={!manualId}
            className="px-4 py-2 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] text-sm font-bold disabled:opacity-40 hover:bg-[var(--accent)]/30 transition-all"
          >
            Go
          </button>
        </div>
      </div>

      {/* Open sessions list */}
      <div>
        <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)]/50 mb-3">
          OPEN MATCHES
        </p>
        {openSessions.length === 0 && (
          <p className="text-sm text-[var(--foreground)]/40 py-4 text-center">
            No open matches right now.
          </p>
        )}
        <div className="space-y-2">
          {openSessions.map((s) => (
            <button
              key={s.id.toString()}
              onClick={() => handleSelectSession(s.id)}
              className={`w-full rounded-xl border p-3 text-left transition-all ${
                selectedSessionId === s.id
                  ? "border-[var(--accent-2)] bg-[var(--accent-2)]/10"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-2)]/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)]/40">
                    SESSION #{s.id.toString()}
                  </span>
                  <p className="text-sm text-[var(--foreground)]/80">{truncateAddr(s.player1)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[var(--accent-2)]">
                    {formatGndm(s.stakeAmount)} GNDM
                  </p>
                  <p className="text-xs text-[var(--foreground)]/40">each</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Card picker (shows when session selected) */}
      {selectedSessionId != null && (
        <div>
          <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)]/50 mb-3">
            SELECT YOUR CARD
          </p>
          {cardsLoading && (
            <div className="flex items-center gap-2 py-4 text-[var(--accent)] text-sm">
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              Loading your cards...
            </div>
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
      )}

      {localError && <p className="text-red-400 text-sm text-center">{localError}</p>}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setStep("lobby")}
          className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
        >
          Back
        </button>

        {phase === "approving" && (
          <div className="flex-[2] flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--accent)] text-sm font-bold font-[family-name:var(--font-orbitron)]">
              APPROVING...
            </span>
          </div>
        )}

        {phase === "joining" && (
          <div className="flex-[2] flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--accent)] text-sm font-bold font-[family-name:var(--font-orbitron)]">
              JOINING...
            </span>
          </div>
        )}

        {phase === "browse" && selectedSessionId != null && myCard && needsApproval && (
          <button
            onClick={handleApprove}
            className="flex-[2] py-2.5 rounded-lg bg-yellow-500 text-black font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:brightness-110 transition-all"
          >
            1 / 2 — APPROVE GNDM
          </button>
        )}

        {phase === "browse" && selectedSessionId != null && myCard && !needsApproval && (
          <button
            onClick={handleJoin}
            className="flex-[2] py-2.5 rounded-lg bg-[var(--accent-2)] text-white font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:brightness-110 transition-all"
          >
            JOIN BATTLE
          </button>
        )}

        {phase === "browse" && (!selectedSessionId || !myCard) && (
          <button
            disabled
            className="flex-[2] py-2.5 rounded-lg bg-[var(--accent-2)] text-white font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider opacity-40 cursor-not-allowed"
          >
            {!selectedSessionId ? "SELECT A MATCH" : "SELECT A CARD"}
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
          ? "ring-2 ring-[var(--accent-2)] ring-offset-1 ring-offset-[var(--background)]"
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
