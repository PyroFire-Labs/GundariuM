"use client";

import { useState, useEffect } from "react";
import { ipfsToHttp } from "@/lib/ipfs";
import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";
import type { GunplaCardMetadata } from "@/types/nft";

const RARITY_CLASS: Record<string, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

const RARITY_LABEL_COLOR: Record<string, string> = {
  Common: "text-[var(--color-rarity-common)]",
  Uncommon: "text-[var(--color-rarity-uncommon)]",
  Rare: "text-[var(--color-rarity-rare)]",
  "Ultra Rare": "text-[var(--color-rarity-ultra)]",
  Legendary: "text-[var(--color-rarity-legendary)]",
};

interface Props {
  card: OwnedCard;
  isExpanded: boolean;
  onToggle: () => void;
}

export function GunplaCardItem({ card, isExpanded, onToggle }: Props) {
  const { traits, tokenId, tokenUri } = card;
  const [imageUrl, setImageUrl] = useState<string>("");

  useEffect(() => {
    if (!tokenUri) return;
    const metaUrl = ipfsToHttp(tokenUri);
    fetch(metaUrl)
      .then((r) => r.json())
      .then((meta: GunplaCardMetadata) => {
        setImageUrl(ipfsToHttp(meta.image));
      })
      .catch(() => {});
  }, [tokenUri]);

  const rarityClass = RARITY_CLASS[traits.rarity] ?? "rarity-common";
  const rarityColor = RARITY_LABEL_COLOR[traits.rarity] ?? "";

  return (
    <div
      className={`rounded-xl border-2 bg-[var(--surface)] overflow-hidden flex flex-col cursor-pointer transition-transform hover:scale-[1.02] ${rarityClass}`}
      onClick={onToggle}
    >
      {/* Card image */}
      <div className="relative w-full aspect-[3/4] bg-[var(--surface-2)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={traits.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {/* Token ID badge */}
        <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs font-mono text-[var(--foreground)]/70">
          #{tokenId.toString()}
        </div>
        {/* Rarity badge */}
        <div className={`absolute top-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs font-bold ${rarityColor}`}>
          {traits.rarity}
        </div>
      </div>

      {/* Card footer */}
      <div className="p-3 flex flex-col gap-1">
        <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--foreground)] leading-tight">
          {traits.name}
        </p>
        <p className="text-xs text-[var(--foreground)]/50 truncate">{traits.series}</p>

        {/* Core stats row */}
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--foreground)]/60">
          <span className="text-[var(--accent)] font-mono font-bold">{traits.hp} HP</span>
          <span className="truncate">{traits.primaryWeapon}</span>
          <span className="ml-auto font-mono">{traits.primaryDamage} DMG</span>
        </div>
      </div>

      {/* Expanded stats panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
      {isExpanded && (
        <div className="border-t border-[var(--border)] p-3 text-xs space-y-1.5 text-[var(--foreground)]/70">
          <div className="flex justify-between">
            <span>Faction</span><span className="text-[var(--foreground)]">{traits.faction}</span>
          </div>
          <div className="flex justify-between">
            <span>Pilot</span><span className="text-[var(--foreground)]">{traits.pilotName}</span>
          </div>
          <div className="flex justify-between">
            <span>Armor</span><span className="text-[var(--foreground)]">{traits.armorType}</span>
          </div>
          <div className="border-t border-[var(--border)] pt-1.5 space-y-1">
            {[
              [traits.primaryWeapon, traits.primaryDamage],
              [traits.secondaryWeapon, traits.secondaryDamage],
              [traits.tertiaryWeapon, traits.tertiaryDamage],
              [traits.specialAttack, traits.specialDamage],
            ].map(([weapon, dmg]) => (
              <div key={String(weapon)} className="flex justify-between">
                <span className="truncate pr-2">{weapon}</span>
                <span className="font-mono text-[var(--accent)] shrink-0">{dmg} DMG</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
