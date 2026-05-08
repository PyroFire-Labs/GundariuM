"use client";

import { useState } from "react";
import { useMintStore } from "@/store/useMintStore";
import { CardFrame } from "@/components/card/CardFrame";
import { displayRarity, type KitbashTraits, type TraitRarity } from "@/types/nft";
import { validateCustomName } from "@/lib/kitbash/namePools";

const RARITY_COLORS: Record<TraitRarity, string> = {
  Common: "text-gray-400",
  Uncommon: "text-green-400",
  Rare: "text-blue-400",
  "Ultra Rare": "text-purple-400",
  Legendary: "text-yellow-400",
};

const RARITY_BORDER: Record<TraitRarity, string> = {
  Common: "border-gray-600",
  Uncommon: "border-green-600",
  Rare: "border-blue-600",
  "Ultra Rare": "border-purple-600",
  Legendary: "border-yellow-600",
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
    fallbackName,
    customName,
    setCustomName,
    goTo,
    reset,
  } = useMintStore();

  const [nameError, setNameError] = useState<string | null>(null);

  if (!traits || !kitbashTraits || !traitRarities) {
    return null;
  }

  // The base64 image is intentionally not persisted (size). If the user
  // reloads before reaching the IPFS upload in MintConfirm, we can't recover
  // the preview — offer a clean restart instead of a blank screen.
  if (!generatedImageBase64) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 max-w-sm text-center">
        <p className="text-sm text-[var(--foreground)]/70">
          Your generation session was interrupted. Please reroll to forge a new Mobile Suit.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] font-bold rounded-xl hover:brightness-110 transition-all"
        >
          REROLL
        </button>
      </div>
    );
  }

  const imageUrl = `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`;
  const traitKeys = Object.keys(kitbashTraits) as (keyof KitbashTraits)[];

  const handleNameChange = (value: string) => {
    setCustomName(value);
    setNameError(validateCustomName(value));
  };

  const canProceed = nameError === null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center w-full px-2">
      {/* Card preview */}
      <div className="flex-shrink-0 w-full max-w-[92vw] sm:max-w-sm lg:max-w-md">
        <CardFrame imageUrl={imageUrl} traits={traits} />
      </div>

      {/* Trait breakdown */}
      <div className="flex-1 space-y-4 w-full max-w-[92vw] sm:max-w-sm lg:max-w-none">
        <h3 className="text-lg font-[family-name:var(--font-orbitron)] text-[var(--accent)] text-center lg:text-left">
          {traits.name}
        </h3>
        <p className="text-sm text-[var(--foreground)]/60 text-center lg:text-left">
          {traits.series} — {traits.faction}
        </p>

        {/* Name your Gundar-Frame */}
        <div>
          <label
            htmlFor="custom-name"
            className="block text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40 mb-1 tracking-wider"
          >
            NAME YOUR GUNDAR-FRAME
          </label>
          <input
            id="custom-name"
            type="text"
            maxLength={32}
            value={customName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={fallbackName ?? ""}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground)]/30 focus:outline-none focus:border-[var(--accent)]/60"
          />
          <div className="flex items-center justify-between mt-1">
            <span
              className={`text-[10px] ${
                nameError ? "text-red-400" : "text-[var(--foreground)]/30"
              }`}
            >
              {nameError ?? "Optional. Leave blank to use the auto-name."}
            </span>
            <span className="text-[10px] font-mono text-[var(--foreground)]/30">
              {customName.length}/32
            </span>
          </div>
        </div>

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
                    {displayRarity(rarity).toUpperCase()}
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
        <div className="flex gap-3 justify-center lg:justify-start">
          <button
            onClick={() => goTo("confirming")}
            disabled={!canProceed}
            className="flex-1 px-6 py-3 bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
