// src/components/collection/CollectionCard.tsx
"use client";

import { useEffect, useState } from "react";
import { CardFrame } from "@/components/card/CardFrame";
import { CardBack } from "@/components/card/CardBack";
import { FlippableCard } from "@/components/card/FlippableCard";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { ipfsToHttp } from "@/lib/ipfs";
import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";

interface CollectionCardProps {
  card: OwnedCard;
  /**
   * Wallet that owns this collection. Used by CardFrame to resolve the
   * Runner identity from Farcaster / custom profile. The collection page
   * passes its connected-wallet address down to every card.
   */
  ownerAddress?: string | null;
}

export function CollectionCard({ card, ownerAddress }: CollectionCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(ipfsToHttp(card.tokenUri))
      .then((r) => r.json())
      .then((meta) => {
        if (!cancelled && meta?.image) setImageUrl(ipfsToHttp(meta.image));
      })
      .catch(() => {
        // Metadata fetch failed — leave imageUrl null so we render a placeholder
      });
    return () => {
      cancelled = true;
    };
  }, [card.tokenUri]);

  return (
    <div className="flex flex-col items-center gap-2">
      {imageUrl ? (
        <FlippableCard
          front={
            <CardFrame
              imageUrl={imageUrl}
              traits={card.traits}
              ownerAddress={ownerAddress}
            />
          }
          back={<CardBack traits={card.traits} tokenId={card.tokenId} />}
        />
      ) : (
        <div
          className="w-full max-w-[300px] aspect-[3/4] rounded-sm border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center"
        >
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-[var(--foreground)]/40">
          #{card.tokenId.toString()}
        </span>
        <ShareButtons
          compact
          card={{ name: card.traits.name, rarity: card.traits.rarity, tokenId: card.tokenId }}
        />
      </div>
    </div>
  );
}
