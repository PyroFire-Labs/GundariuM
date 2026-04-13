"use client";

import { useMintStore } from "@/store/useMintStore";
import { CardFrame } from "@/components/card/CardFrame";
import type { KitbashTraits, TraitRarity } from "@/types/nft";

const RARITY_COLORS: Record<TraitRarity, string> = {
  Common: "text-gray-400",
  Uncommon: "text-green-400",
  Rare: "text-blue-400",
  "Ultra Rare": "text-yellow-400",
  Legendary: "text-purple-400",
};

const RARITY_BORDER: Record<TraitRarity, string> = {
  Common: "border-gray-600",
  Uncommon: "border-green-600",
  Rare: "border-blue-600",
  "Ultra Rare": "border-yellow-600",
  Legendary: "border-purple-600",
};

const TRAIT_LABELS: Record<keyof KitbashTraits, string> = {
  frameType: "FRAME",
  head: "HEAD",
  primaryWeapon: "WEAPON",
  backpack: "BACKPACK",
  colorway: "COLORWAY",
  stance: "STANCE",
  background: "BACKGROUND",
  special: "SPECIAL",
};

export function GenerationReveal() {
  const {
    traits,
    kitbashTraits,
    traitRarities,
    generatedImageBase64,
    generatedImageMimeType,
    goTo,
    reset,
  } = useMintStore();

  if (!traits || !kitbashTraits || !traitRarities || !generatedImageBase64) {
    return null;
  }

  const imageUrl = `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`;
  const traitKeys = Object.keys(kitbashTraits) as (keyof KitbashTraits)[];

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
      {/* Card preview */}
      <div className="flex-shrink-0 w-full max-w-xs sm:max-w-sm lg:max-w-md">
        <CardFrame imageUrl={imageUrl} traits={traits} />
      </div>

      {/* Trait breakdown */}
      <div className="flex-1 space-y-4">
        <h3 className="text-lg font-[family-name:var(--font-orbitron)] text-[var(--accent)]">
          {traits.name}
        </h3>
        <p className="text-sm text-[var(--foreground)]/60">
          {traits.series} — {traits.faction}
        </p>

        {/* Trait badges */}
        <div className="grid grid-cols-2 gap-2">
          {traitKeys
            .filter((k) => kitbashTraits[k] !== "None")
            .map((key) => {
              const rarity = traitRarities[key] as TraitRarity;
              return (
                <div
                  key={key}
                  className={`px-3 py-2 rounded-lg border ${RARITY_BORDER[rarity]} bg-[var(--surface)]`}
                >
                  <div className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">
                    {TRAIT_LABELS[key]}
                  </div>
                  <div className="text-sm text-[var(--foreground)]">
                    {kitbashTraits[key]}
                  </div>
                  <div
                    className={`text-[10px] font-[family-name:var(--font-orbitron)] ${RARITY_COLORS[rarity]}`}
                  >
                    {rarity.toUpperCase()}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Battle stats */}
        <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40 mb-2">
            BATTLE STATS
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-[var(--foreground)]/60">HP</span>
            <span className="text-right">{traits.hp}</span>
            <span className="text-[var(--foreground)]/60">
              {traits.primaryWeapon}
            </span>
            <span className="text-right">{traits.primaryDamage}</span>
            <span className="text-[var(--foreground)]/60">
              {traits.secondaryWeapon}
            </span>
            <span className="text-right">{traits.secondaryDamage}</span>
            <span className="text-[var(--foreground)]/60">
              {traits.tertiaryWeapon}
            </span>
            <span className="text-right">{traits.tertiaryDamage}</span>
            <span className="text-[var(--foreground)]/60">
              {traits.specialAttack}
            </span>
            <span className="text-right font-bold text-[var(--accent)]">
              {traits.specialDamage}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => goTo("confirming")}
            className="flex-1 px-6 py-3 bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] font-bold rounded-xl hover:brightness-110 transition-all"
          >
            MINT THIS CARD
          </button>
          <button
            onClick={reset}
            className="px-6 py-3 border border-[var(--border)] text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)] text-sm rounded-xl hover:border-[var(--foreground)]/20 transition-all"
          >
            REROLL
          </button>
        </div>
      </div>
    </div>
  );
}
