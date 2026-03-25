"use client";

import { useMintStore } from "@/store/useMintStore";
import type { Rarity } from "@/types/nft";

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

const RARITY_TEXT: Record<Rarity, string> = {
  Common: "text-[var(--color-rarity-common)]",
  Uncommon: "text-[var(--color-rarity-uncommon)]",
  Rare: "text-[var(--color-rarity-rare)]",
  "Ultra Rare": "text-[var(--color-rarity-ultra)]",
  Legendary: "text-[var(--color-rarity-legendary)]",
};

const GRADE_LABEL: Record<string, string> = {
  SD: "SD",
  HG: "HG",
  RG: "RG",
  MG: "MG",
  MG_VERKA: "MG Ver.Ka",
  HIRM: "Hi-RM",
  PG: "PG",
};

export function TraitReview() {
  const { traits, imagePreviewUrl, grade, goTo } = useMintStore();
  const local = traits!;

  const handleContinue = () => {
    goTo("card_preview");
  };

  return (
    <div className="w-full max-w-3xl flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: image + locked stats */}
        <div className="flex flex-col gap-4">
          <div
            className={`rounded-xl border-2 overflow-hidden beam-scan ${RARITY_CLASS[local.rarity]}`}
          >
            {imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt={local.name}
                className="w-full object-cover"
              />
            )}
          </div>

          {/* Locked stats panel */}
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
            {/* Locked grade + rarity */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[var(--foreground)]/40 text-xs uppercase tracking-wider">Grade</span>
                <span className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)] bg-[var(--surface-2)] px-2 py-0.5 rounded">
                  {grade ? GRADE_LABEL[grade] : local.grade ?? "—"}
                </span>
                <span className="text-[var(--foreground)]/30 text-xs">🔒</span>
              </div>
              <span className={`text-sm font-bold ${RARITY_TEXT[local.rarity]}`}>
                {local.rarity}
              </span>
            </div>

            {/* Locked HP */}
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
              <span className="text-[var(--foreground)]/40 text-xs uppercase tracking-wider flex items-center gap-1">
                HP <span className="text-[var(--foreground)]/30">🔒</span>
              </span>
              <span className="font-mono text-sm font-bold text-[var(--foreground)]">{local.hp}</span>
            </div>

            {/* Locked damage values */}
            <div className="space-y-1 border-t border-[var(--border)] pt-2">
              <p className="text-xs text-[var(--foreground)]/30 uppercase tracking-wider flex items-center gap-1">
                Damage Values 🔒
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                <span className="text-[var(--foreground)]/50">Primary</span>
                <span className="text-right text-[var(--foreground)]">{local.primaryDamage}</span>
                <span className="text-[var(--foreground)]/50">Secondary</span>
                <span className="text-right text-[var(--foreground)]">{local.secondaryDamage}</span>
                <span className="text-[var(--foreground)]/50">Tertiary</span>
                <span className="text-right text-[var(--foreground)]">{local.tertiaryDamage}</span>
                <span className="text-[var(--foreground)]/50">Special</span>
                <span className="text-right text-[var(--foreground)]">{local.specialDamage}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: trait fields (scrollable) */}
        <div className="flex flex-col gap-3 overflow-y-auto max-h-[75vh] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-wider font-[family-name:var(--font-orbitron)] font-bold">
            Your card traits
          </p>

          <ReadOnlyField label="Suit Name" value={local.name} />
          <ReadOnlyField label="Series" value={local.series} />
          <ReadOnlyField label="Faction" value={local.faction} />
          <ReadOnlyField label="Pilot" value={local.pilotName} />
          <ReadOnlyField label="Armor Type" value={local.armorType} />
          <ReadOnlyField label="Primary Weapon" value={local.primaryWeapon} />
          <ReadOnlyField label="Secondary Weapon" value={local.secondaryWeapon} />
          <ReadOnlyField label="Tertiary Weapon" value={local.tertiaryWeapon} />
          <ReadOnlyField label="Special Attack" value={local.specialAttack} />
        </div>
      </div>

      {/* Action buttons — always visible, outside the scrollable area */}
      <div className="flex flex-col items-center gap-2 w-full max-w-md mx-auto">
        <button
          onClick={handleContinue}
          className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          PREVIEW CARD →
        </button>
        <button
          onClick={() => goTo("idle")}
          className="w-full py-2 text-[var(--foreground)]/40 text-sm hover:text-[var(--foreground)]/60 transition-colors"
        >
          ← Back to photo
        </button>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--foreground)]/50 uppercase tracking-wider">
        {label}
      </label>
      <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}
