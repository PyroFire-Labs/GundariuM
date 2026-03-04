"use client";

import { CAMPAIGN_ARCS, DIFFICULTY_COLOR } from "@/lib/battle/arcs";
import { useBattleStore } from "@/store/useBattleStore";

export function ArcSelect() {
  const setArc = useBattleStore((s) => s.setArc);

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="text-center mb-8">
        <h2 className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-[var(--accent)]">
          SELECT CAMPAIGN ARC
        </h2>
        <p className="mt-1 text-sm text-[var(--foreground)]/50">
          Choose your mission. Difficulty scales with your opponent.
        </p>
      </div>

      {CAMPAIGN_ARCS.map((arc) => (
        <button
          key={arc.id}
          onClick={() => setArc(arc.id)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-all hover:border-[var(--accent)]/60 hover:bg-[var(--surface-2)] group"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)]/40">
                  ARC {arc.id}
                </span>
                <span className={`text-xs font-bold ${DIFFICULTY_COLOR[arc.difficulty]}`}>
                  {arc.difficulty.toUpperCase()}
                </span>
              </div>
              <p className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                {arc.name}
              </p>
              <p className="text-xs text-[var(--foreground)]/50 mt-0.5">{arc.description}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-[var(--foreground)]/40">VS</p>
              <p className="text-sm font-bold text-[var(--foreground)]/80">{arc.enemy.name}</p>
              <p className="text-xs text-[var(--foreground)]/40 mt-1">
                {arc.enemy.hp} HP
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
