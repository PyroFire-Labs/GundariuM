"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useMintStore } from "@/store/useMintStore";
import { displayRarity, type Rarity } from "@/types/nft";
import { ShareButtons } from "@/components/ui/ShareButtons";

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

// Aligned with --color-rarity-* in globals.css so the back glow matches the
// front border that's set by the .rarity-* CSS class. Previously these were
// swapped — Legendary read as purple on flip instead of gold.
const RARITY_GLOW: Record<Rarity, string> = {
  Common: "#9ca3af",
  Uncommon: "#22c55e",
  Rare: "#3b82f6",
  "Ultra Rare": "#a855f7",
  Legendary: "#f59e0b",
};

export function MintSuccess() {
  const { traits, generatedImageBase64, generatedImageMimeType, mintedTokenId, reset } = useMintStore();
  const [flipped, setFlipped] = useState(false);

  const imageUrl = generatedImageBase64
    ? `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`
    : undefined;
  const rarityClass = traits ? RARITY_CLASS[traits.rarity] : "rarity-common";
  const glowColor = traits ? RARITY_GLOW[traits.rarity] : "#6b7280";

  const weapons = traits
    ? [
        { label: "PRI", name: traits.primaryWeapon, dmg: traits.primaryDamage },
        { label: "SEC", name: traits.secondaryWeapon, dmg: traits.secondaryDamage },
        { label: "TER", name: traits.tertiaryWeapon, dmg: traits.tertiaryDamage },
        { label: "SPL", name: traits.specialAttack, dmg: traits.specialDamage },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", duration: 0.5 }}
      className="flex flex-col items-center gap-8 text-center"
    >
      {/* Flippable card */}
      <motion.div
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.7, type: "spring" }}
        className="cursor-pointer"
        style={{ perspective: 1200 }}
        onClick={() => setFlipped(!flipped)}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 80 }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative w-64"
        >
          {/* Front — card image */}
          <div
            className={`rounded-xl border-2 overflow-hidden beam-scan ${rarityClass}`}
            style={{ backfaceVisibility: "hidden" }}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt={traits?.name}
                className="w-full object-cover"
              />
            )}
            <div className="p-4 bg-[var(--surface)]">
              <p className="font-[family-name:var(--font-orbitron)] font-bold text-sm leading-tight">
                {traits?.name}
              </p>
              <p className="text-xs text-[var(--foreground)]/60 mt-1">
                {traits ? displayRarity(traits.rarity) : ""}
              </p>
              {mintedTokenId !== null && (
                <p className="text-xs text-[var(--foreground)]/40 mt-1 font-mono">
                  #{mintedTokenId.toString()}
                </p>
              )}
            </div>
            <p className="text-[10px] text-[var(--foreground)]/30 pb-2 font-[family-name:var(--font-orbitron)]">
              TAP TO FLIP
            </p>
          </div>

          {/* Back — stats */}
          <div
            className="absolute inset-0 rounded-xl border-2 overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              borderColor: glowColor,
              boxShadow: `0 0 20px ${glowColor}40`,
            }}
          >
            <div className="h-full bg-[var(--surface)] p-5 flex flex-col">
              {/* Header */}
              <div className="border-b border-[var(--border)] pb-3 mb-3">
                <p className="font-[family-name:var(--font-orbitron)] font-bold text-sm" style={{ color: glowColor }}>
                  {traits?.name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">
                    {traits?.series}
                  </span>
                  {mintedTokenId !== null && (
                    <span className="text-[10px] font-mono text-[var(--foreground)]/40">
                      #{mintedTokenId.toString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Core stats */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
                <div className="flex justify-between">
                  <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">FACTION</span>
                </div>
                <span className="text-right text-[var(--foreground)]/80">{traits?.faction}</span>

                <div className="flex justify-between">
                  <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">ARMOR</span>
                </div>
                <span className="text-right text-[var(--foreground)]/80">{traits?.armorType}</span>

                <div className="flex justify-between">
                  <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">RARITY</span>
                </div>
                <span className="text-right" style={{ color: glowColor }}>{traits ? displayRarity(traits.rarity) : ""}</span>
              </div>

              {/* HP bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">HP</span>
                  <span className="font-mono font-bold" style={{ color: glowColor }}>{traits?.hp}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(((traits?.hp ?? 0) / 2000) * 100, 100)}%`,
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
                    <span className={`font-mono font-bold ${w.label === "SPL" ? "" : "text-[var(--foreground)]/80"}`} style={w.label === "SPL" ? { color: glowColor } : {}}>
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
        </motion.div>
      </motion.div>

      {/* Title + description */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="space-y-2"
      >
        <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          GUNDAR-FRAME FORGED
        </h2>
        <p className="text-[var(--foreground)]/60 text-sm max-w-xs">
          {traits?.name} has been permanently recorded on Base and added to
          your collection.
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="flex gap-3 flex-wrap justify-center"
      >
        <a
          href="/collection"
          className="px-6 py-2.5 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          VIEW COLLECTION
        </a>
        <button
          onClick={reset}
          className="px-6 py-2.5 border border-[var(--border)] text-[var(--foreground)]/60 text-sm rounded-lg hover:border-[var(--accent)]/60 hover:text-[var(--foreground)] transition-all"
        >
          Mint Another
        </button>
      </motion.div>

      {/* Share */}
      {traits && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="flex flex-col items-center gap-3"
        >
          <p className="text-[10px] font-[family-name:var(--font-orbitron)] tracking-widest text-[var(--foreground)]/40">
            SHARE YOUR FORGE
          </p>
          <ShareButtons
            card={{
              name: traits.name,
              rarity: traits.rarity,
              tokenId: mintedTokenId,
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
