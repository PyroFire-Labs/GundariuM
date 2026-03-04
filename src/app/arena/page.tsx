"use client";

import { useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useChainId,
} from "wagmi";
import { GUNDANIUM_GAME_ABI } from "@/lib/contracts/abis/GundaniumGame";
import { GUNPLA_CARD_ABI } from "@/lib/contracts/abis/GunplaCard";
import { getContracts } from "@/lib/contracts/addresses";
import { useArenaStore } from "@/store/useArenaStore";
import { ArenaBrowse } from "@/components/arena/ArenaBrowse";
import { ArenaCreate } from "@/components/arena/ArenaCreate";
import { ArenaWaiting } from "@/components/arena/ArenaWaiting";
import { ArenaJoin } from "@/components/arena/ArenaJoin";
import { ArenaBattleScreen } from "@/components/arena/ArenaBattleScreen";
import { ArenaResult } from "@/components/arena/ArenaResult";
import { indexToRarity } from "@/types/nft";
import type { ArmorType } from "@/types/nft";

const STEP_LABELS = ["MATCH", "BATTLE", "RESULT"];
const STEP_INDEX: Record<string, number> = {
  lobby: 0,
  "create-card": 0,
  creating: 0,
  waiting: 0,
  "join-browse": 0,
  "join-card": 0,
  joining: 0,
  resolving: 1,
  battle: 1,
  settling: 1,
  victory: 2,
  defeat: 2,
};

const ARMOR_TYPES: ArmorType[] = [
  "Standard", "Gundanium", "Phase Shift", "I-Field", "GN Particle", "Luna Titanium",
];

export default function ArenaPage() {
  const {
    step,
    sessionId,
    myCard,
    isCreator,
    resolveResult,
    setResolveResult,
    setStep,
    setError,
    error,
  } = useArenaStore();

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported */ }

  // ── Resolve battle (joiner path) ──────────────────────────────────────────
  useEffect(() => {
    if (step !== "resolving" || !sessionId || !myCard || !address || !contracts) return;

    async function resolve() {
      try {
        setError(null);

        // Read full session to get card1TokenId and player1 address
        const session = await publicClient!.readContract({
          address: contracts!.gundaniumGame,
          abi: GUNDANIUM_GAME_ABI,
          functionName: "sessions",
          args: [sessionId!],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = session as any;
        const player1 = s[0] as `0x${string}`;
        const player2 = s[1] as `0x${string}`;
        const card1TokenId = s[2] as bigint;

        // Fetch opponent's traits (player1 is the creator / opponent)
        const rawTraits = await publicClient!.readContract({
          address: contracts!.gunplaCard,
          abi: GUNPLA_CARD_ABI,
          functionName: "getTraits",
          args: [card1TokenId],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rt = rawTraits as any;
        const opponentTraits = {
          name: rt.name,
          series: rt.series,
          faction: rt.faction,
          pilotName: rt.pilotName,
          rarity: indexToRarity(Number(rt.rarity)),
          armorType: ARMOR_TYPES[Number(rt.armorType)] ?? "Standard",
          hp: Number(rt.hp),
          primaryWeapon: rt.primaryWeapon,
          primaryDamage: Number(rt.primaryDamage),
          secondaryWeapon: rt.secondaryWeapon,
          secondaryDamage: Number(rt.secondaryDamage),
          tertiaryWeapon: rt.tertiaryWeapon,
          tertiaryDamage: Number(rt.tertiaryDamage),
          specialAttack: rt.specialAttack,
          specialDamage: Number(rt.specialDamage),
        };

        // Call resolve-pvp API (player1=creator=opponent, player2=joiner=me)
        const res = await fetch("/api/battle/resolve-pvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: Number(sessionId),
            player1Address: player1,
            player2Address: player2 || address,
            player1Traits: opponentTraits,
            player2Traits: myCard!.traits,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setResolveResult(data);
        setStep("battle");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Battle resolution failed");
        setStep("lobby");
      }
    }
    resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Settle battle (joiner path) ───────────────────────────────────────────
  useEffect(() => {
    if (step !== "settling" || !resolveResult || !sessionId || !contracts) return;

    async function settle() {
      try {
        setError(null);
        const hash = await writeContractAsync({
          address: contracts!.gundaniumGame,
          abi: GUNDANIUM_GAME_ABI,
          functionName: "settleBattle",
          args: [
            sessionId!,
            resolveResult!.winnerAddress,
            resolveResult!.finalHpWinner,
            BigInt(resolveResult!.timestamp),
            resolveResult!.signature,
          ],
        });
        await publicClient!.waitForTransactionReceipt({ hash });

        const iWon = resolveResult!.winnerAddress.toLowerCase() === address?.toLowerCase();
        setStep(iWon ? "victory" : "defeat");
      } catch (e) {
        // If already settled (e.g. creator beat us to it), still show result
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("not active") || msg.includes("already")) {
          const iWon = resolveResult!.winnerAddress.toLowerCase() === address?.toLowerCase();
          setStep(iWon ? "victory" : "defeat");
        } else {
          setError(msg || "Settlement failed");
          setStep("lobby");
        }
      }
    }
    settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const stepIdx = STEP_INDEX[step] ?? 0;

  if (!address) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent-2)]">
            PVP ARENA
          </h1>
          <p className="text-[var(--foreground)]/60">Connect your wallet to enter the Arena.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 flex flex-col items-center gap-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent-2)]">
          PVP ARENA
        </h1>
        <p className="mt-1 text-sm text-[var(--foreground)]/50">
          Challenge real players. Stake GNDM. Dominate.
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
                    ? "bg-[var(--accent-2)]"
                    : i === stepIdx
                    ? "bg-[var(--accent-2)] ring-2 ring-[var(--accent-2)]/40"
                    : "bg-[var(--border)]"
                }`}
              />
              <span className="text-[8px] text-[var(--foreground)]/40 font-[family-name:var(--font-orbitron)]">
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`h-px w-8 mb-4 ${i < stepIdx ? "bg-[var(--accent-2)]" : "bg-[var(--border)]"}`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center px-4">{error}</p>
      )}

      {/* Step content */}
      {step === "lobby" && <ArenaBrowse />}
      {step === "create-card" && <ArenaCreate />}
      {step === "waiting" && <ArenaWaiting />}
      {(step === "join-browse" || step === "join-card") && <ArenaJoin />}

      {(step === "resolving" || step === "joining") && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-10 h-10 border-2 border-[var(--accent-2)] border-t-transparent rounded-full animate-spin" />
          <p className="font-[family-name:var(--font-orbitron)] text-sm text-[var(--accent-2)]">
            {step === "joining" ? "JOINING BATTLE..." : "CALCULATING OUTCOME..."}
          </p>
        </div>
      )}

      {step === "settling" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-10 h-10 border-2 border-[var(--accent-2)] border-t-transparent rounded-full animate-spin" />
          <p className="font-[family-name:var(--font-orbitron)] text-sm text-[var(--accent-2)]">
            SETTLING ON-CHAIN...
          </p>
        </div>
      )}

      {step === "battle" && <ArenaBattleScreen />}
      {(step === "victory" || step === "defeat") && <ArenaResult isVictory={step === "victory"} />}
    </div>
  );
}
