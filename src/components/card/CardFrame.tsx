"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { displayRarity, type Rarity, type TraitSet } from "@/types/nft";
import {
  useRunnerProfile,
  resolveRunnerDisplayName,
} from "@/lib/hooks/useRunnerProfile";

export interface CosmeticOverrides {
  frameColor?: string;    // override frame color (from selected frame skin)
  colorShift?: number;    // hue-rotate degrees (0-360)
  tintColor?: string;     // tint overlay hex color
  decalName?: string;     // decal name to show as badge
  repaintName?: string;   // repaint style name to show as badge
}

interface CardFrameProps {
  imageUrl: string;
  traits: TraitSet;
  cosmetics?: CosmeticOverrides;
  /**
   * Address of the card's current owner (or, during the mint flow, the
   * connected wallet that's about to mint). When provided, the card's
   * RUNNER label resolves to that wallet's Farcaster identity (Phase 1)
   * or custom profile (future phases). Falls back to traits.pilotName.
   */
  ownerAddress?: string | null;
}

const RARITY_COLOR: Record<Rarity, string> = {
  Common: "#9ca3af",
  Uncommon: "#22c55e",
  Rare: "#3b82f6",
  "Ultra Rare": "#a855f7",
  Legendary: "#f59e0b",
};

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

function hexGridSvg(color: string): string {
  const hex = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='100'>
    <polygon points='28,2 54,17 54,47 28,62 2,47 2,17' fill='none' stroke='${color}' stroke-width='1' opacity='0.12'/>
    <polygon points='28,52 54,67 54,97 28,112 2,97 2,67' fill='none' stroke='${color}' stroke-width='1' opacity='0.12'/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(hex)}")`;
}

export function CardFrame({
  imageUrl,
  traits,
  cosmetics,
  ownerAddress,
}: CardFrameProps) {
  // Phase 1 Runner Dossier: resolve the display name from Farcaster identity
  // (or future custom profile) when an owner address is available. Falls
  // back to the on-chain pilotName trait if no owner is known or the lookup
  // returns no identity.
  const { profile: runnerProfile } = useRunnerProfile(ownerAddress);
  const runnerDisplayName = resolveRunnerDisplayName(
    runnerProfile,
    traits.pilotName,
    ownerAddress
  );

  // Frame color: use cosmetic override if provided, otherwise rarity default
  const color = cosmetics?.frameColor ?? RARITY_COLOR[traits.rarity];
  const rarityClass = cosmetics?.frameColor ? undefined : RARITY_CLASS[traits.rarity];

  // Photo filters from cosmetic selections
  const photoFilter = cosmetics?.colorShift ? `hue-rotate(${cosmetics.colorShift}deg)` : undefined;

  const weapons = [
    { label: "PRI", name: traits.primaryWeapon, dmg: traits.primaryDamage },
    { label: "SEC", name: traits.secondaryWeapon, dmg: traits.secondaryDamage },
    { label: "TER", name: traits.tertiaryWeapon, dmg: traits.tertiaryDamage },
    { label: "SPL", name: traits.specialAttack, dmg: traits.specialDamage },
  ];

  return (
    <div
      className={cn(
        "relative w-full max-w-[300px] border-2 rounded-sm overflow-hidden select-none flex flex-col",
        rarityClass
      )}
      style={{
        background: "rgba(8,12,20,0.98)",
        ...(cosmetics?.frameColor ? {
          borderColor: color,
          boxShadow: `0 0 20px ${color}50, 0 0 40px ${color}30`,
        } : {}),
      }}
    >
      {/* Hex grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: hexGridSvg(color),
          backgroundSize: "56px 100px",
        }}
      />

      {/* Header bar */}
      <div
        className="relative z-10 flex items-center justify-between px-2 py-1.5 shrink-0"
        style={{
          background: "rgba(15,25,41,0.95)",
          borderBottom: `1px solid ${color}`,
        }}
      >
        <span
          className="font-[family-name:var(--font-orbitron)] text-[8px] font-bold tracking-widest uppercase"
          style={{ color }}
        >
          GundariuM
        </span>
        <span
          className="font-mono text-[7px] tracking-wider"
          style={{ color, opacity: 0.7 }}
        >
          NFT CARD
        </span>
      </div>

      {/* Photo area — fixed aspect ratio */}
      <div className="relative z-0 w-full shrink-0" style={{ aspectRatio: "4/3" }}>
        <Image
          src={imageUrl}
          alt={traits.name}
          fill
          className="object-cover"
          sizes="300px"
          unoptimized
          style={photoFilter ? { filter: photoFilter } : undefined}
        />

        {/* Tint color overlay */}
        {cosmetics?.tintColor && (
          <div
            className="absolute inset-0 pointer-events-none z-[5]"
            style={{ background: cosmetics.tintColor, mixBlendMode: "color", opacity: 0.4 }}
          />
        )}

        {/* Scan line */}
        <div
          className="absolute left-0 right-0 h-[3%] pointer-events-none z-10"
          style={{
            background: `linear-gradient(to bottom, transparent, ${color}22, ${color}44, ${color}22, transparent)`,
            animation: "scan 3s ease-in-out infinite",
          }}
        />

        {/* Targeting reticle */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          style={{ opacity: 0.15 }}
        >
          <div
            className="absolute rounded-full"
            style={{ width: "40%", height: "60%", border: `1px solid ${color}` }}
          />
          <div className="absolute" style={{ width: "70%", height: "1px", background: color }} />
          <div className="absolute" style={{ width: "1px", height: "70%", background: color }} />
        </div>

        {/* HUD readouts */}
        <div
          className="absolute inset-0 pointer-events-none z-20 font-mono"
          style={{ fontSize: "7px", color, lineHeight: 1.4 }}
        >
          <div className="absolute top-1 left-1 flex flex-col">
            <span style={{ opacity: 0.6 }}>SYS ONLINE</span>
            <span style={{ opacity: 0.6 }}>TGT LOCK</span>
          </div>
          <div className="absolute top-1 right-1 flex flex-col items-end">
            <span style={{ opacity: 0.6 }}>FRAME 00</span>
            <span style={{ opacity: 0.6 }}>SCAN OK</span>
          </div>
        </div>

        {/* Corner brackets */}
        <div className="absolute top-1 left-1 w-4 h-4 pointer-events-none z-20"
          style={{ borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}`, opacity: 0.7 }} />
        <div className="absolute top-1 right-1 w-4 h-4 pointer-events-none z-20"
          style={{ borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}`, opacity: 0.7 }} />
        <div className="absolute bottom-1 left-1 w-4 h-4 pointer-events-none z-20"
          style={{ borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}`, opacity: 0.7 }} />
        <div className="absolute bottom-1 right-1 w-4 h-4 pointer-events-none z-20"
          style={{ borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}`, opacity: 0.7 }} />

        {/* Decal badge */}
        {cosmetics?.decalName && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded"
            style={{ background: `${color}cc`, backdropFilter: "blur(4px)" }}>
            <span className="font-mono text-[7px] font-bold text-white">
              {cosmetics.decalName.toUpperCase()}
            </span>
          </div>
        )}

        {/* Repaint badge */}
        {cosmetics?.repaintName && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded"
            style={{ background: "#7c3aedcc", backdropFilter: "blur(4px)" }}>
            <span className="font-mono text-[7px] font-bold text-white">
              AI: {cosmetics.repaintName.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Stats panel — sizes to content */}
      <div
        className="relative z-10 flex flex-col px-3 py-2 gap-1 shrink-0"
        style={{
          background: "rgba(15,25,41,0.97)",
          borderTop: `1px solid ${color}`,
        }}
      >
        {/* Suit name */}
        <p
          className="font-[family-name:var(--font-orbitron)] font-bold leading-tight truncate"
          style={{ color: "#ffffff", fontSize: "11px" }}
        >
          {traits.name}
        </p>

        {/* Runner + Armor */}
        <div className="flex items-center justify-between">
          <span className="font-mono truncate" style={{ color: "#94a3b8", fontSize: "7px" }}>
            RUNNER: {runnerDisplayName.toUpperCase()}
          </span>
          <span className="font-mono" style={{ color, fontSize: "7px", opacity: 0.8 }}>
            {traits.armorType.toUpperCase()}
          </span>
        </div>

        {/* Rarity + HP */}
        <div
          className="flex items-center justify-between py-0.5"
          style={{ borderTop: `1px solid ${color}33`, borderBottom: `1px solid ${color}33` }}
        >
          <span
            className="font-[family-name:var(--font-orbitron)] font-bold uppercase tracking-wider"
            style={{ color, fontSize: "8px" }}
          >
            {displayRarity(traits.rarity)}
          </span>
          <span className="font-mono font-bold" style={{ color: "#ffffff", fontSize: "10px" }}>
            HP {traits.hp}
          </span>
        </div>

        {/* Weapons grid */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {weapons.map((w) => (
            <div key={w.label} className="flex items-center justify-between">
              <span className="font-mono truncate" style={{ color: "#94a3b8", fontSize: "6.5px", maxWidth: "75%" }}>
                <span style={{ color, opacity: 0.7 }}>{w.label}</span>{" "}
                {w.name}
              </span>
              <span className="font-mono font-bold" style={{ color: "#ffffff", fontSize: "7px" }}>
                {w.dmg}
              </span>
            </div>
          ))}
        </div>

        {/* GundariuM seal */}
        <div className="flex justify-center">
          <span
            className="font-[family-name:var(--font-orbitron)] tracking-widest"
            style={{ color, fontSize: "5px", opacity: 0.5 }}
          >
            &#x25C6; GUNDARIUM &#x25C6;
          </span>
        </div>
      </div>
    </div>
  );
}
