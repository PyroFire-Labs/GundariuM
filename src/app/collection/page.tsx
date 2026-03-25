"use client";

import { useEffect, useState } from "react";
import { useCollection, type OwnedCard } from "@/lib/contracts/hooks/useCollection";
import { CardFrame } from "@/components/card/CardFrame";
import { ipfsToHttp } from "@/lib/ipfs";
import { CosmeticsMenu } from "@/components/cosmetics/CosmeticsMenu";
import { useCosmeticsStore } from "@/store/useCosmeticsStore";

function CollectionCard({ card }: { card: OwnedCard }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const reset = useCosmeticsStore((s) => s.reset);

  useEffect(() => {
    if (!card.tokenUri) return;

    const metadataUrl = ipfsToHttp(card.tokenUri);
    fetch(metadataUrl)
      .then((res) => res.json())
      .then((metadata) => {
        if (metadata.image) {
          setImageUrl(ipfsToHttp(metadata.image));
        }
      })
      .catch(() => {
        // Fallback: metadata fetch failed
      });
  }, [card.tokenUri]);

  return (
    <div className="flex flex-col items-center gap-2">
      <CardFrame
        imageUrl={imageUrl ?? ""}
        traits={card.traits}
      />
      <span className="font-mono text-xs text-[var(--foreground)]/40">
        #{String(card.tokenId)}
      </span>
      <button
        onClick={() => setShowCustomize(true)}
        className="py-2 px-6 bg-[var(--accent-2)] text-white font-bold font-[family-name:var(--font-orbitron)] text-xs rounded-lg hover:brightness-110 transition-all"
      >
        CUSTOMIZE
      </button>
      {showCustomize && (
        <CosmeticsMenu
          onConfirm={() => {
            alert("Coming soon — on-chain cosmetics in next update");
            reset();
          }}
          onSkip={() => {
            setShowCustomize(false);
            reset();
          }}
          confirmLabel="CONFIRM & MINT →"
          skipLabel="← Back to preview"
        />
      )}
    </div>
  );
}

export default function CollectionPage() {
  const { cards, isLoading, isConnected, count } = useCollection();

  if (!isConnected) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 gap-4">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          COLLECTION
        </h1>
        <p className="text-[var(--foreground)]/60 text-sm">
          Connect your wallet to view your Gunpla cards.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 gap-4">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          COLLECTION
        </h1>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--accent)] text-sm font-[family-name:var(--font-orbitron)]">
            LOADING CARDS…
          </span>
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 gap-4">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          COLLECTION
        </h1>
        <p className="text-[var(--foreground)]/60 text-sm">
          No cards yet. Mint your first Gunpla card to get started.
        </p>
        <a
          href="/mint"
          className="py-3 px-8 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          MINT NOW
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center px-4 py-12 gap-8">
      <div className="text-center space-y-2">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          COLLECTION
        </h1>
        <p className="text-[var(--foreground)]/60 text-sm">
          {count} card{count !== 1 ? "s" : ""} in your hangar
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-4xl">
        {cards.map((card) => (
          <CollectionCard key={String(card.tokenId)} card={card} />
        ))}
      </div>
    </div>
  );
}
