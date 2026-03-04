"use client";

import { useEffect, useRef, useState } from "react";
import { useBattleStore } from "@/store/useBattleStore";
import { getArc } from "@/lib/battle/arcs";
import type { TurnLog } from "@/lib/battle/simulate";

const LOG_INTERVAL_MS = 180;

export function BattleScreen() {
  const { resolveResult, selectedCard, selectedArcId } = useBattleStore();
  const arc = getArc(selectedArcId ?? 0);
  const log = resolveResult?.log ?? [];

  const [visibleTurns, setVisibleTurns] = useState(0);
  const [done, setDone] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const setStep = useBattleStore((s) => s.setStep);

  // Animate turn log entries one by one
  useEffect(() => {
    if (visibleTurns >= log.length) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setVisibleTurns((v) => v + 1), LOG_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [visibleTurns, log.length]);

  // Auto-scroll to latest entry
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleTurns]);

  const playerHp = selectedCard?.traits.hp ?? 0;
  const enemyHp = arc?.enemy.hp ?? 0;

  // Compute current HP from visible log
  let currentPlayerHp = playerHp;
  let currentEnemyHp = enemyHp;
  for (let i = 0; i < visibleTurns; i++) {
    const entry = log[i];
    if (entry.defenderName === selectedCard?.traits.name) {
      currentPlayerHp = entry.defenderHpAfter;
    } else {
      currentEnemyHp = entry.defenderHpAfter;
    }
  }

  const playerHpPct = Math.max(0, (currentPlayerHp / playerHp) * 100);
  const enemyHpPct  = Math.max(0, (currentEnemyHp / enemyHp) * 100);

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* HP bars */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--accent)] truncate">
            {selectedCard?.traits.name ?? "YOUR CARD"}
          </p>
          <p className="text-xs text-[var(--foreground)]/50 mb-2">
            {currentPlayerHp} / {playerHp} HP
          </p>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${playerHpPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-red-400 truncate">
            {arc?.enemy.name ?? "ENEMY"}
          </p>
          <p className="text-xs text-[var(--foreground)]/50 mb-2">
            {currentEnemyHp} / {enemyHp} HP
          </p>
          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500 transition-all duration-300"
              style={{ width: `${enemyHpPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Battle log */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] h-72 overflow-y-auto p-3 space-y-1.5 font-mono text-xs">
        {log.slice(0, visibleTurns).map((entry, i) => (
          <LogEntry key={i} entry={entry} playerName={selectedCard?.traits.name ?? ""} />
        ))}
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
          onClick={() =>
            setStep(resolveResult?.winner === "player" ? "settling" : "defeat")
          }
          className="w-full py-3 rounded-lg bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:brightness-110 transition-all animate-pulse"
        >
          {resolveResult?.winner === "player" ? "VICTORY — SETTLE ON-CHAIN" : "DEFEAT — VIEW RESULT"}
        </button>
      )}
    </div>
  );
}

function LogEntry({ entry, playerName }: { entry: TurnLog; playerName: string }) {
  const isPlayer = entry.attackerName === playerName;
  return (
    <div className={`flex items-baseline gap-2 ${isPlayer ? "text-[var(--accent)]" : "text-red-400"}`}>
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
}
