"use client";

import { useAccount, useWriteContract, usePublicClient, useChainId } from "wagmi";
import { GUNDANIUM_GAME_ABI } from "@/lib/contracts/abis/GundaniumGame";
import { getContracts } from "@/lib/contracts/addresses";
import { useBattleStore } from "@/store/useBattleStore";
import { getArc } from "@/lib/battle/arcs";
import Link from "next/link";
import { useState } from "react";

export function BattleResult() {
  const { resolveResult, sessionId, selectedArcId, setStep, reset } = useBattleStore();
  const arc = getArc(selectedArcId ?? 0);
  const isVictory = resolveResult?.winner === "player";

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<"idle" | "settling" | "claiming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported chain */ }

  async function handleSettle() {
    if (!contracts || !resolveResult || sessionId == null || !address) return;
    try {
      setError(null);
      setPhase("settling");
      const hash = await writeContractAsync({
        address: contracts.gundaniumGame,
        abi: GUNDANIUM_GAME_ABI,
        functionName: "settleBattle",
        args: [
          sessionId,
          resolveResult.winnerAddress,
          resolveResult.finalHpWinner,
          BigInt(resolveResult.timestamp),
          resolveResult.signature,
        ],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setPhase("claiming");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settle failed");
      setPhase("idle");
    }
  }

  async function handleClaim() {
    if (!contracts || sessionId == null) return;
    try {
      setError(null);
      const hash = await writeContractAsync({
        address: contracts.gundaniumGame,
        abi: GUNDANIUM_GAME_ABI,
        functionName: "claimPVEReward",
        args: [sessionId],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    }
  }

  if (isVictory) {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">🏆</div>
        <div>
          <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-black text-[var(--color-rarity-legendary)]">
            VICTORY
          </h2>
          <p className="mt-2 text-[var(--foreground)]/60">
            {arc?.enemy.name} has been defeated.
          </p>
          {arc && (
            <p className="mt-1 text-sm text-[var(--accent)]">
              +{arc.gndmReward} GNDM reward
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {phase === "idle" && (
          <button
            onClick={() => { setStep("settling"); handleSettle(); }}
            className="w-full py-3 rounded-lg bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:brightness-110 transition-all"
          >
            1 / 2 — SETTLE BATTLE ON-CHAIN
          </button>
        )}

        {phase === "settling" && <Spinner label="SETTLING..." />}

        {phase === "claiming" && (
          <button
            onClick={handleClaim}
            className="w-full py-3 rounded-lg bg-[var(--accent-2)] text-white font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:brightness-110 transition-all"
          >
            2 / 2 — CLAIM GNDM REWARD
          </button>
        )}

        {phase === "done" && (
          <div className="w-full space-y-3">
            <p className="text-green-400 font-[family-name:var(--font-orbitron)] text-sm font-bold">
              REWARD CLAIMED
            </p>
            <button
              onClick={reset}
              className="w-full py-2.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-sm font-bold hover:bg-[var(--accent)] hover:text-black transition-all"
            >
              BATTLE AGAIN
            </button>
            <Link
              href="/collection"
              className="block w-full py-2.5 rounded-lg border border-[var(--border)] text-[var(--foreground)]/60 text-sm text-center hover:text-[var(--foreground)] transition-colors"
            >
              View Collection
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Defeat screen
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
      <div className="text-6xl">💥</div>
      <div>
        <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-black text-red-500">
          DEFEATED
        </h2>
        <p className="mt-2 text-[var(--foreground)]/60">
          {arc?.enemy.name} was too powerful. Train harder.
        </p>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={reset}
          className="flex-1 py-2.5 rounded-lg bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] text-sm font-bold hover:brightness-110 transition-all"
        >
          TRY AGAIN
        </button>
        <Link
          href="/collection"
          className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[var(--foreground)]/60 text-sm text-center flex items-center justify-center hover:text-[var(--foreground)] transition-colors"
        >
          Collection
        </Link>
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      <span className="text-[var(--accent)] font-[family-name:var(--font-orbitron)] text-sm">{label}</span>
    </div>
  );
}
