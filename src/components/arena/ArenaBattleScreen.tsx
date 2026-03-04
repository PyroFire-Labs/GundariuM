"use client";

import { useEffect, useRef, useState } from "react";
import { useArenaStore } from "@/store/useArenaStore";

const LOG_INTERVAL_MS = 180;

export function ArenaBattleScreen() {
  const { resolveResult, myCard, setStep } = useArenaStore();
  const log = resolveResult?.log ?? [];

  const [visibleTurns, setVisibleTurns] = useState(0);
  const [done, setDone] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Animate turn log
  useEffect(() => {
    if (visibleTurns >= log.length) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setVisibleTurns((v) => v + 1), LOG_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [visibleTurns, log.length]);

  // Auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleTurns]);

  if (!resolveResult) return null;

  const myName = myCard?.traits.name ?? "";
  const opponentName =
    resolveResult.player1Name === myName
      ? resolveResult.player2Name
      : resolveResult.player1Name;

  const myMaxHp = myCard?.traits.hp ?? 1;
  // Opponent max HP — infer from log (first entry where they take damage)
  let opponentMaxHp = 1;
  for (const entry of log) {
    if (entry.defenderName === opponentName) {
      // Find the first turn they take damage — their starting HP is not in the log directly
      // Use a high value and let it settle; instead, scan for the maximum HP seen
    }
  }
  // Best approach: find the highest defenderHpAfter + finalDamage for opponent
  for (const entry of log) {
    if (entry.defenderName === opponentName) {
      const startHp = entry.defenderHpAfter + entry.finalDamage;
      if (startHp > opponentMaxHp) opponentMaxHp = startHp;
    }
  }

  // Compute current HP from visible log
  let currentMyHp = myMaxHp;
  let currentOpponentHp = opponentMaxHp;
  for (let i = 0; i < visibleTurns; i++) {
    const entry = log[i];
    if (entry.defenderName === myName) {
      currentMyHp = entry.defenderHpAfter;
    } else {
      currentOpponentHp = entry.defenderHpAfter;
    }
  }

  const myHpPct       = Math.max(0, (currentMyHp / myMaxHp) * 100);
  const opponentHpPct = Math.max(0, (currentOpponentHp / opponentMaxHp) * 100);

  const iWon = resolveResult.winnerAddress !== "0x0000000000000000000000000000000000000000" &&
    resolveResult.winner === "player2"; // joiner is always player2 in simulate

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* HP bars */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--accent)] truncate">
            {myName || "YOUR CARD"}
          </p>
          <p className="text-xs text-[var(--foreground)]/50 mb-2">
            {currentMyHp} / {myMaxHp} HP
          </p>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${myHpPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--accent-2)] truncate">
            {opponentName || "OPPONENT"}
          </p>
          <p className="text-xs text-[var(--foreground)]/50 mb-2">
            {currentOpponentHp} / {opponentMaxHp} HP
          </p>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-2)] transition-all duration-300"
              style={{ width: `${opponentHpPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Battle log */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] h-72 overflow-y-auto p-3 space-y-1.5 font-mono text-xs">
        {log.slice(0, visibleTurns).map((entry, i) => {
          const isMe = entry.attackerName === myName;
          return (
            <div
              key={i}
              className={`flex items-baseline gap-2 ${isMe ? "text-[var(--accent)]" : "text-[var(--accent-2)]"}`}
            >
              <span className="text-[var(--foreground)]/30 shrink-0">T{entry.turn}</span>
              <span className="truncate">
                <span className="font-bold">{entry.attackerName}</span>
                {" uses "}
                <span className="italic">{entry.weapon}</span>
                {" — "}
                <span className="font-bold">{entry.finalDamage} DMG</span>
                {entry.finalDamage < entry.rawDamage && (
                  <span className="text-[var(--foreground)]/40"> (armor reduced from {entry.rawDamage})</span>
                )}
              </span>
              <span className="ml-auto shrink-0 text-[var(--foreground)]/50">
                {entry.defenderHpAfter} HP left
              </span>
            </div>
          );
        })}
        {!done && (
          <div className="flex items-center gap-1.5 text-[var(--foreground)]/30">
            <div className="w-3 h-3 border border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span>...</span>
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {/* Continue button */}
      {done && (
        <button
          onClick={() => setStep("settling")}
          className="w-full py-3 rounded-lg bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:brightness-110 transition-all animate-pulse"
        >
          {iWon ? "VICTORY — SETTLE ON-CHAIN" : "DEFEAT — SETTLE RESULT"}
        </button>
      )}
    </div>
  );
}
