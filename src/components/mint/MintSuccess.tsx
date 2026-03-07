"use client";

import { motion } from "framer-motion";
import { useMintStore } from "@/store/useMintStore";
import type { Rarity } from "@/types/nft";

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

export function MintSuccess() {
  const { traits, imagePreviewUrl, mintedTokenId, reset } = useMintStore();
  const rarityClass = traits ? RARITY_CLASS[traits.rarity] : "rarity-common";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", duration: 0.5 }}
      className="flex flex-col items-center gap-8 text-center"
    >
      {/* Animated card */}
      <motion.div
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.7, type: "spring" }}
        className={`w-56 rounded-xl border-2 overflow-hidden beam-scan ${rarityClass}`}
        style={{ perspective: 1000 }}
      >
        {imagePreviewUrl && (
          <img
            src={imagePreviewUrl}
            alt={traits?.name}
            className="w-full object-cover"
          />
        )}
        <div className="p-4 bg-[var(--surface)]">
          <p className="font-[family-name:var(--font-orbitron)] font-bold text-sm leading-tight">
            {traits?.name}
          </p>
          <p className="text-xs text-[var(--foreground)]/60 mt-1">
            {traits?.rarity}
          </p>
          {mintedTokenId !== null && (
            <p className="text-xs text-[var(--foreground)]/40 mt-1 font-mono">
              #{mintedTokenId.toString()}
            </p>
          )}
        </div>
      </motion.div>

      {/* Title + description */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="space-y-2"
      >
        <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          CARD MINTED!
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
    </motion.div>
  );
}
