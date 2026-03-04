"use client";

import Link from "next/link";
import { useArenaStore } from "@/store/useArenaStore";

function formatGndm(amount: bigint): string {
  return (Number(amount) / 1e18).toLocaleString();
}

export function ArenaResult({ isVictory }: { isVictory: boolean }) {
  const { resolveResult, stakeAmount, myCard, isCreator, reset } = useArenaStore();

  const iWon = isVictory;

  const myName = myCard?.traits.name ?? "Your Card";
  const opponentName = resolveResult
    ? isCreator
      ? resolveResult.player2Name
      : resolveResult.player1Name
    : "Opponent";

  // Payout calculations
  const winnerPayout = stakeAmount * 19n / 10n; // stakeAmount * 1.9
  const netGain      = stakeAmount * 9n  / 10n;  // stakeAmount * 0.9

  if (iWon) {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">🏆</div>
        <div>
          <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-black text-[var(--color-rarity-legendary)]">
            VICTORY
          </h2>
          <p className="mt-2 text-[var(--foreground)]/60">
            {myName} defeated {opponentName}.
          </p>
          <p className="mt-1 text-sm text-[var(--accent)]">
            +{formatGndm(netGain)} GNDM profit · Received {formatGndm(winnerPayout)} GNDM
          </p>
        </div>
        <div className="w-full space-y-3">
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-sm font-bold font-[family-name:var(--font-orbitron)] hover:bg-[var(--accent)] hover:text-black transition-all"
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
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
      <div className="text-6xl">💥</div>
      <div>
        <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-black text-red-500">
          DEFEATED
        </h2>
        <p className="mt-2 text-[var(--foreground)]/60">
          {opponentName} was stronger. Train harder.
        </p>
        <p className="mt-1 text-sm text-red-400">
          -{formatGndm(stakeAmount)} GNDM staked &amp; lost
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
