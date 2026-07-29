"use client";

import { displayRarity, type TraitSet } from "@/types/nft";
import { RARITY_PALETTES } from "@/lib/card/frame-config";

interface CardBackProps {
  traits: TraitSet;
  tokenId: bigint | null;
}

/**
 * The flip-card back face — stats panel shared between the mint-success
 * screen and the collection grid. Uses frame-config's RARITY_PALETTES so
 * there's one canonical rarity-color source instead of a per-component copy
 * (this codebase has already had two real bugs from that kind of drift).
 */
export function CardBack({ traits, tokenId }: CardBackProps) {
  const glowColor = RARITY_PALETTES[traits.rarity].primary;

  const weapons = [
    { label: "PRI", name: traits.primaryWeapon, dmg: traits.primaryDamage },
    { label: "SEC", name: traits.secondaryWeapon, dmg: traits.secondaryDamage },
    { label: "TER", name: traits.tertiaryWeapon, dmg: traits.tertiaryDamage },
    { label: "SPL", name: traits.specialAttack, dmg: traits.specialDamage },
  ];

  return (
    <div
      className="h-full rounded-xl border-2 overflow-hidden"
      style={{
        borderColor: glowColor,
        boxShadow: `0 0 20px ${glowColor}40`,
      }}
    >
      <div className="h-full bg-[var(--surface)] p-5 flex flex-col">
        {/* Header */}
        <div className="border-b border-[var(--border)] pb-3 mb-3">
          <p
            className="font-[family-name:var(--font-orbitron)] font-bold text-sm"
            style={{ color: glowColor }}
          >
            {traits.name}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">
              {traits.series}
            </span>
            {tokenId !== null && (
              <span className="text-[10px] font-mono text-[var(--foreground)]/40">
                #{tokenId.toString()}
              </span>
            )}
          </div>
        </div>

        {/* Core stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
          <div className="flex justify-between">
            <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">FACTION</span>
          </div>
          <span className="text-right text-[var(--foreground)]/80">{traits.faction}</span>

          <div className="flex justify-between">
            <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">ARMOR</span>
          </div>
          <span className="text-right text-[var(--foreground)]/80">{traits.armorType}</span>

          <div className="flex justify-between">
            <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">RARITY</span>
          </div>
          <span className="text-right" style={{ color: glowColor }}>{displayRarity(traits.rarity)}</span>
        </div>

        {/* HP bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">HP</span>
            <span className="font-mono font-bold" style={{ color: glowColor }}>{traits.hp}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((traits.hp / 2000) * 100, 100)}%`,
                backgroundColor: glowColor,
              }}
            />
          </div>
        </div>

        {/* Weapons */}
        <div className="flex-1 space-y-1.5">
          <p className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40 mb-1">
            ARMAMENT
          </p>
          {weapons.map((w) => (
            <div key={w.label} className="flex items-center gap-2 text-xs">
              <span
                className="font-[family-name:var(--font-orbitron)] text-[10px] w-7 flex-shrink-0"
                style={{ color: w.label === "SPL" ? glowColor : "var(--foreground)", opacity: w.label === "SPL" ? 1 : 0.4 }}
              >
                {w.label}
              </span>
              <span className="flex-1 text-[var(--foreground)]/70 truncate">{w.name}</span>
              <span
                className={`font-mono font-bold ${w.label === "SPL" ? "" : "text-[var(--foreground)]/80"}`}
                style={w.label === "SPL" ? { color: glowColor } : {}}
              >
                {w.dmg}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-[var(--foreground)]/30 font-[family-name:var(--font-orbitron)] mt-3 pt-2 border-t border-[var(--border)]">
          TAP TO FLIP BACK
        </p>
      </div>
    </div>
  );
}
