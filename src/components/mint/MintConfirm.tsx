"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useMintStore } from "@/store/useMintStore";
import { useMint } from "@/lib/contracts/hooks/useMint";
import { CardFrame } from "@/components/card/CardFrame";
import { ipfsToHttp } from "@/lib/ipfs";

export function MintConfirm() {
  const {
    traits,
    generatedImageBase64,
    generatedImageMimeType,
    imageIpfsHash,
    metadataUri,
    setMetadataUri,
    setImageIpfsHash,
    setMintedTokenId,
    setError,
    goTo,
    error: storeError,
  } = useMintStore();

  const {
    phase,
    error: mintError,
    mintPrice,
    approveMint,
    executeMint,
    executeWhitelistMint,
    currentPhase,
    whitelistMintCount,
    whitelistMintCap,
    vipPrice,
    wlPrice,
  } = useMint();

  const account = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const targetChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
  const wrongChain = chainId !== targetChainId;

  const networkLabel =
    targetChainId === 8453
      ? "Base"
      : targetChainId === 84532
        ? "Base Sepolia"
        : `Chain ${targetChainId}`;
  const proofsFile =
    targetChainId === 8453
      ? "/whitelist-proofs.mainnet.json"
      : "/whitelist-proofs.sepolia.json";

  const error = storeError ?? mintError;

  // Whitelist proof loading
  const [proofData, setProofData] = useState<{ tier: number; proof: string[] } | null>(null);

  // Load whitelist proof for the connected wallet regardless of mint phase.
  // After the contract upgrade in feat/wl-mint-during-public-phase, VIPs can
  // continue using mintCardWhitelist during PUBLIC phase to retain their
  // tier discount. Pre-upgrade, mintCardWhitelist would revert in PUBLIC
  // phase — but loading the proof eagerly is harmless either way; the
  // executeWhitelistMint() call at handleMint() is what would fail, and it's
  // gated below.
  useEffect(() => {
    if (!account.address) return;
    fetch(proofsFile)
      .then((r) => r.json())
      .then((data) => {
        const entry = data.proofs?.[account.address!.toLowerCase()];
        if (entry) setProofData(entry);
      })
      .catch(() => {});
  }, [account.address, proofsFile]);

  // VIP/WL tier price applies whenever the wallet has a valid proof and the
  // contract isn't paused — i.e. WHITELIST or PUBLIC phase post-upgrade.
  const effectivePrice = proofData && currentPhase !== 0
    ? (proofData.tier === 1 ? vipPrice : wlPrice) ?? mintPrice
    : mintPrice;

  const tierLabel = proofData && currentPhase !== 0
    ? proofData.tier === 1 ? "VIP (50% off)" : "Whitelist (25% off)"
    : "Public";

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
    let tokenId: bigint | null = null;
    // Use the whitelist mint path whenever the wallet has a valid proof and
    // the contract isn't paused. Post-upgrade, this works in both WHITELIST
    // and PUBLIC phases (VIPs keep their tier discount even after public mint
    // opens). Public mintCard() is the fallback for non-whitelisted wallets
    // and only succeeds in PUBLIC phase.
    if (proofData && currentPhase !== 0) {
      tokenId = await executeWhitelistMint(
        metadataUri,
        traits,
        proofData.tier,
        proofData.proof as `0x${string}`[]
      );
    } else {
      tokenId = await executeMint(metadataUri, traits);
    }
    if (tokenId !== null) {
      setMintedTokenId(tokenId);
      goTo("success");
    }
  };

  // Prefer the in-memory base64 (instant), but fall back to the IPFS gateway
  // when state was rehydrated from localStorage after a wallet-induced reload
  // (we don't persist the base64 — see useMintStore for the size rationale).
  const imageUrl = generatedImageBase64
    ? `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`
    : imageIpfsHash
      ? ipfsToHttp(`ipfs://${imageIpfsHash}`)
      : undefined;

  const usdcAmount = effectivePrice ? Number(effectivePrice) / 1_000_000 : 5;
  const isUploading = !metadataUri && !storeError;

  return (
    <div className="w-full max-w-lg flex flex-col gap-5 items-center">
      {/* Card preview with frame */}
      {imageUrl && traits && (
        <div className="w-full max-w-xs">
          <CardFrame imageUrl={imageUrl} traits={traits} />
        </div>
      )}

      {/* Cost breakdown */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--foreground)]/60">Mint price</span>
          <span className="font-mono">${usdcAmount} USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--foreground)]/60">Tier</span>
          <span className="font-mono text-[var(--accent)]">{tierLabel}</span>
        </div>
        {proofData && whitelistMintCap !== undefined && (
          <div className="flex justify-between">
            <span className="text-[var(--foreground)]/60">WL mints</span>
            <span className="font-mono">
              {whitelistMintCount?.toString() ?? "0"} / {whitelistMintCap.toString()}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--foreground)]/60">Network</span>
          <span className="font-mono text-[var(--foreground)]/80">
            {networkLabel}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--foreground)]/60">Metadata</span>
          <span className={metadataUri ? "text-green-400" : "text-[var(--foreground)]/40"}>
            {metadataUri ? "IPFS ✓" : "Uploading…"}
          </span>
        </div>
      </div>

      {/* Not on whitelist */}
      {currentPhase === 1 && !proofData && (
        <p className="text-center text-red-400 font-[family-name:var(--font-orbitron)]">
          Your wallet is not on the whitelist.
        </p>
      )}

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
          <div className="flex flex-col gap-2">
            <button
              onClick={async () => {
                try {
                  await switchChain({ chainId: targetChainId });
                } catch {
                  setError(`Please switch to ${networkLabel} manually in your wallet, then reload this page.`);
                }
              }}
              className="w-full py-3 bg-yellow-500 text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
            >
              SWITCH TO {networkLabel.toUpperCase()}
            </button>
            <p className="text-xs text-[var(--foreground)]/40 text-center">
              If switching fails, manually select {networkLabel} (chainId {targetChainId}) in your wallet
            </p>
          </div>
        ) : (
          <button
            onClick={() => approveMint(effectivePrice)}
            disabled={currentPhase === 1 && !proofData}
            className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
