"use client";

import { getArc, DIFFICULTY_COLOR } from "@/lib/battle/arcs";
import { useCollection } from "@/lib/contracts/hooks/useCollection";
import { useBattleStore } from "@/store/useBattleStore";
import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";

const RARITY_CLASS: Record<string, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

export function CardSelect() {
  const { selectedArcId, selectedCard, setCard, setStep } = useBattleStore();
  const { cards, isLoading } = useCollection();
  const arc = getArc(selectedArcId ?? 0);

  function handleStart() {
    if (!selectedCard) return;
    setStep("starting");
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Arc recap */}
      {arc && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-xs font-bold ${DIFFICULTY_COLOR[arc.difficulty]}`}>
                ARC {arc.id} — {arc.difficulty.toUpperCase()}
              </span>
              <p className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--foreground)] mt-0.5">
                {arc.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--foreground)]/40">Opponent</p>
              <p className="text-sm font-bold text-red-400">{arc.enemy.name}</p>
              <p className="text-xs text-[var(--foreground)]/40">{arc.enemy.hp} HP</p>
            </div>
          </div>
        </div>
      )}

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
            No cards in your collection. Mint one first.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <CardPickerItem
              key={card.tokenId.toString()}
              card={card}
              isSelected={selectedCard?.tokenId === card.tokenId}
              onSelect={() => setCard(card)}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setStep("arc-select")}
          className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleStart}
          disabled={!selectedCard}
          className="flex-[2] py-2.5 rounded-lg bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
        >
          DEPLOY TO BATTLEFIELD
        </button>
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
