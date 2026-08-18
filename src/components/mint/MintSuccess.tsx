"use client";

import { motion } from "framer-motion";
import { useChainId } from "wagmi";
import { useMintStore } from "@/store/useMintStore";
import { displayRarity, type Rarity } from "@/types/nft";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { FlippableCard } from "@/components/card/FlippableCard";
import { CardBack } from "@/components/card/CardBack";
import { ipfsToHttp } from "@/lib/ipfs";
import { useModelStatus } from "@/lib/hooks/useModelStatus";

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

export function MintSuccess() {
  const {
    traits,
    generatedImageBase64,
    generatedImageMimeType,
    imageIpfsHash,
    mintedTokenId,
    reset,
  } = useMintStore();

  // Prefer the in-memory base64; fall back to the IPFS gateway after a
  // rehydrated session (wallet-reload mid-flow). See useMintStore for why
  // we don't persist the base64 itself.
  const imageUrl = generatedImageBase64
    ? `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`
    : imageIpfsHash
      ? ipfsToHttp(`ipfs://${imageIpfsHash}`)
      : undefined;
  const rarityClass = traits ? RARITY_CLASS[traits.rarity] : "rarity-common";
  // The wallet's active chain at success time is still the chain the mint
  // was just submitted to — same assumption MintConfirm's queueModelGeneration
  // call makes, a few seconds earlier in the same flow.
  const chainId = useChainId();
  const { status: modelStatus } = useModelStatus(mintedTokenId, chainId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", duration: 0.5 }}
      className="flex flex-col items-center gap-8 text-center"
    >
      {/* Flippable card */}
      {traits && (
        <motion.div
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.7, type: "spring" }}
        >
          <FlippableCard
            className="w-64"
            front={
              <div className={`rounded-xl border-2 overflow-hidden beam-scan ${rarityClass}`}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={traits.name}
                    className="w-full object-cover"
                  />
                )}
                <div className="p-4 bg-[var(--surface)]">
                  <p className="font-[family-name:var(--font-orbitron)] font-bold text-sm leading-tight">
                    {traits.name}
                  </p>
                  <p className="text-xs text-[var(--foreground)]/60 mt-1">
                    {displayRarity(traits.rarity)}
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
            }
            back={<CardBack traits={traits} tokenId={mintedTokenId} />}
          />
        </motion.div>
      )}

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
        {(modelStatus === "pending" || modelStatus === "processing") && (
          <p className="flex items-center justify-center gap-2 text-[10px] font-[family-name:var(--font-orbitron)] tracking-widest text-[var(--foreground)]/40 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Forging 3D model…
          </p>
        )}
        {modelStatus === "ready" && mintedTokenId !== null && (
          <a
            href={`/card/${mintedTokenId.toString()}`}
            className="inline-block text-[10px] font-[family-name:var(--font-orbitron)] tracking-widest text-[var(--accent)] uppercase hover:underline"
          >
            3D model ready — view it →
          </a>
        )}
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
