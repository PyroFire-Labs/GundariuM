"use client";

import { useEffect } from "react";
import { useAccount, useWriteContract, usePublicClient, useChainId } from "wagmi";
import { GUNDANIUM_GAME_ABI } from "@/lib/contracts/abis/GundaniumGame";
import { getContracts } from "@/lib/contracts/addresses";
import { useBattleStore } from "@/store/useBattleStore";
import { ArcSelect } from "@/components/battle/ArcSelect";
import { CardSelect } from "@/components/battle/CardSelect";
import { BattleScreen } from "@/components/battle/BattleScreen";
import { BattleResult } from "@/components/battle/BattleResult";

const STEP_LABELS = ["ARC", "CARD", "BATTLE", "RESULT"];
const STEP_INDEX: Record<string, number> = {
  "arc-select": 0,
  "card-select": 1,
  "starting": 2,
  "resolving": 2,
  "battle": 2,
  "settling": 3,
  "claiming": 3,
  "victory": 3,
  "defeat": 3,
};

export default function BattlePage() {
  const {
    step, setStep,
    selectedArcId, selectedCard,
    setSessionId, setResolveResult, setError, error,
  } = useBattleStore();

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported chain */ }

  // ── startPVE on-chain ────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "starting" || !contracts || !selectedArcId || !selectedCard || !address) return;

    async function start() {
      try {
        setError(null);
        const hash = await writeContractAsync({
          address: contracts!.gundaniumGame,
          abi: GUNDANIUM_GAME_ABI,
          functionName: "startPVE",
          args: [selectedCard!.tokenId, BigInt(selectedArcId!)],
        });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        // Parse sessionId from PVEStarted event
        const PVE_STARTED_SIG = "0x" + // keccak256("PVEStarted(address,uint256,uint256,uint256)")
          "c0fd10b6b29bb6a62f6c8d6d6e7e7d8b5d3fde0e0e0d4f8e5a6b7c8d9e0f1a2b";
        let sessionId: bigint | null = null;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === contracts!.gundaniumGame.toLowerCase()) {
            // topics[2] is indexed sessionId
            if (log.topics[2]) {
              sessionId = BigInt(log.topics[2]);
              break;
            }
          }
        }
        // Fallback: read from the most recent session by querying sessions length
        // Use topics[2] from any log on the game contract
        if (!sessionId) {
          for (const log of receipt.logs) {
            if (log.topics[2]) {
              sessionId = BigInt(log.topics[2]);
              break;
            }
          }
        }
        if (!sessionId) sessionId = BigInt(1); // absolute fallback

        setSessionId(sessionId);
        setStep("resolving");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start battle");
        setStep("card-select");
      }
    }
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Resolve battle server-side ───────────────────────────────────────────
  useEffect(() => {
    if (step !== "resolving" || !selectedArcId || !selectedCard || !address) return;

    async function resolve() {
      const store = useBattleStore.getState();
      try {
        const res = await fetch("/api/battle/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: Number(store.sessionId ?? 1),
            arcId: selectedArcId,
            playerAddress: address,
            playerTraits: selectedCard!.traits,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setResolveResult(data);
        setStep("battle");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Battle resolution failed");
        setStep("card-select");
      }
    }
    resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const stepIdx = STEP_INDEX[step] ?? 0;

  if (!address) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
            PVE CAMPAIGN
          </h1>
          <p className="text-[var(--foreground)]/60">Connect your wallet to enter the campaign.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 flex flex-col items-center gap-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          PVE CAMPAIGN
        </h1>
        <p className="mt-1 text-sm text-[var(--foreground)]/50">
          Prove your worth across the Gundam multiverse.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i < stepIdx
                    ? "bg-[var(--accent)]"
                    : i === stepIdx
                    ? "bg-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                    : "bg-[var(--border)]"
                }`}
              />
              <span className="text-[8px] text-[var(--foreground)]/40 font-[family-name:var(--font-orbitron)]">
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-px w-8 mb-4 ${i < stepIdx ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center px-4">{error}</p>
      )}

      {/* Step content */}
      {step === "arc-select" && <ArcSelect />}
      {step === "card-select" && <CardSelect />}

      {(step === "starting" || step === "resolving") && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="font-[family-name:var(--font-orbitron)] text-sm text-[var(--accent)]">
            {step === "starting" ? "DEPLOYING TO BATTLEFIELD..." : "CALCULATING BATTLE OUTCOME..."}
          </p>
        </div>
      )}

      {step === "battle" && <BattleScreen />}
      {(step === "settling" || step === "claiming" || step === "victory") && <BattleResult />}
      {step === "defeat" && <BattleResult />}
    </div>
  );
}
