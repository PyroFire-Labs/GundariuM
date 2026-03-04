"use client";

import { useEffect } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { useArenaStore } from "@/store/useArenaStore";
import { GUNDANIUM_GAME_ABI } from "@/lib/contracts/abis/GundaniumGame";
import { getContracts } from "@/lib/contracts/addresses";

// BattleStatus enum: 0=Pending, 1=Active, 2=Complete, 3=Abandoned
const COMPLETE = 2;

export function ArenaWaiting() {
  const { sessionId, stakeAmount, setStep, reset } = useArenaStore();
  const { address } = useAccount();
  const chainId = useChainId();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported */ }

  const { data: session } = useReadContract({
    address: contracts?.gundaniumGame,
    abi: GUNDANIUM_GAME_ABI,
    functionName: "sessions",
    args: sessionId != null ? [sessionId] : undefined,
    query: {
      enabled: !!contracts && sessionId != null,
      refetchInterval: 5_000,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionStatus = (session as any)?.[6];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionWinner = (session as any)?.[8] as `0x${string}` | undefined;

  // When session becomes Complete, compare winner against my address
  useEffect(() => {
    if (Number(sessionStatus) !== COMPLETE || !sessionWinner || !address) return;
    const iWon = sessionWinner.toLowerCase() === address.toLowerCase();
    setStep(iWon ? "victory" : "defeat");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, sessionWinner, address]);

  const sessionIdDisplay = sessionId?.toString() ?? "...";
  const stakeGndm = Number(stakeAmount) / 1e18;

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
      <div className="w-12 h-12 border-2 border-[var(--accent-2)] border-t-transparent rounded-full animate-spin" />

      <div>
        <h2 className="font-[family-name:var(--font-orbitron)] text-xl font-bold text-[var(--accent-2)]">
          WAITING FOR OPPONENT
        </h2>
        <p className="mt-2 text-sm text-[var(--foreground)]/60">
          Share your Session ID with a challenger.
        </p>
      </div>

      {/* Session ID card */}
      <div className="w-full rounded-xl border border-[var(--accent-2)]/40 bg-[var(--surface)] p-4 space-y-2">
        <p className="text-xs text-[var(--foreground)]/40 font-[family-name:var(--font-orbitron)]">SESSION ID</p>
        <p className="font-mono text-2xl font-bold text-[var(--accent-2)]">#{sessionIdDisplay}</p>
        <p className="text-xs text-[var(--foreground)]/40">Stake: {stakeGndm} GNDM · Payout: {stakeGndm * 1.9} GNDM</p>
      </div>

      <p className="text-xs text-[var(--foreground)]/30 italic">
        Auto-refreshing every 5s...
      </p>

      <button
        onClick={reset}
        className="w-full py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors"
      >
        Cancel &amp; Return to Lobby
      </button>
    </div>
  );
}
