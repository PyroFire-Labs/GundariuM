"use client";

import { useEffect } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { useMintStore } from "@/store/useMintStore";
import { useMint } from "@/lib/contracts/hooks/useMint";

export function MintConfirm() {
  const {
    traits,
    generatedImageBase64,
    generatedImageMimeType,
    metadataUri,
    setMetadataUri,
    setImageIpfsHash,
    setMintedTokenId,
    setError,
    goTo,
    error: storeError,
  } = useMintStore();

  const { phase, error: mintError, mintPrice, approveMint, executeMint } =
    useMint();

  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const targetChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
  const wrongChain = chainId !== targetChainId;

  const error = storeError ?? mintError;

  // Upload to IPFS on mount (if not already done)
  useEffect(() => {
    if (!metadataUri && generatedImageBase64 && traits) {
      uploadToIPFS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadToIPFS = async () => {
    try {
      const res = await fetch("/api/mint-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: generatedImageBase64,
          imageMimeType: generatedImageMimeType,
          traits,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImageIpfsHash(data.imageHash);
      setMetadataUri(data.metadataUri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "IPFS upload failed");
    }
  };

  const handleMint = async () => {
    if (!metadataUri || !traits) return;
    const tokenId = await executeMint(metadataUri, traits);
    if (tokenId !== null) {
      setMintedTokenId(tokenId);
      goTo("success");
    }
  };

  const imageUrl = generatedImageBase64
    ? `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`
    : undefined;

  const usdcAmount = mintPrice ? Number(mintPrice) / 1_000_000 : 5;
  const isUploading = !metadataUri && !storeError;

  return (
    <div className="w-full max-w-md flex flex-col gap-5">
      {/* Card preview */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={traits?.name}
            className="w-full object-cover max-h-52"
          />
        )}
        <div className="p-4 space-y-1">
          <p className="font-[family-name:var(--font-orbitron)] font-bold text-[var(--foreground)]">
            {traits?.name}
          </p>
          <p className="text-sm text-[var(--foreground)]/60">{traits?.series}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[var(--foreground)]/50">
            <span>{traits?.rarity}</span>
            <span>·</span>
            <span>{traits?.armorType} Armor</span>
            <span>·</span>
            <span>{traits?.hp} HP</span>
          </div>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--foreground)]/60">Mint price</span>
          <span className="font-mono">${usdcAmount} USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--foreground)]/60">Network</span>
          <span className="font-mono text-[var(--foreground)]/80">
            Base Sepolia
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--foreground)]/60">Metadata</span>
          <span className={metadataUri ? "text-green-400" : "text-[var(--foreground)]/40"}>
            {metadataUri ? "IPFS ✓" : "Uploading…"}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm text-center px-2">{error}</p>
      )}

      {/* Step 1 — IPFS uploading */}
      {isUploading && (
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--accent)] text-sm font-[family-name:var(--font-orbitron)]">
            UPLOADING TO IPFS…
          </span>
        </div>
      )}

      {/* Step 2 — Switch network or Approve */}
      {!isUploading && phase === "idle" && (
        wrongChain ? (
          <button
            onClick={() => switchChain({ chainId: targetChainId })}
            className="w-full py-3 bg-yellow-500 text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
          >
            SWITCH TO BASE SEPOLIA
          </button>
        ) : (
          <button
            onClick={approveMint}
            className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
          >
            1 / 2 — APPROVE USDC
          </button>
        )
      )}

      {phase === "approving" && (
        <div className="flex items-center justify-center gap-3 py-3">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--accent)] text-sm font-[family-name:var(--font-orbitron)]">
            APPROVING…
          </span>
        </div>
      )}

      {/* Step 3 — Mint */}
      {phase === "approved" && (
        <button
          onClick={handleMint}
          className="w-full py-3 bg-[var(--accent-2)] text-white font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          2 / 2 — MINT CARD
        </button>
      )}

      {phase === "minting" && (
        <div className="flex items-center justify-center gap-3 py-3">
          <div className="w-5 h-5 border-2 border-[var(--accent-2)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--accent-2)] text-sm font-[family-name:var(--font-orbitron)]">
            MINTING…
          </span>
        </div>
      )}

      <button
        onClick={() => goTo("reveal")}
        className="text-[var(--foreground)]/40 text-sm hover:text-[var(--foreground)]/60 transition-colors"
      >
        ← Back to card
      </button>
    </div>
  );
}
