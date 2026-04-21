"use client";

import { useEffect, useState } from "react";
import { CardFrame } from "@/components/card/CardFrame";
import { ipfsToHttp } from "@/lib/ipfs";
import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";

interface CollectionCardProps {
  card: OwnedCard;
}

export function CollectionCard({ card }: CollectionCardProps) {
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
        <CardFrame imageUrl={imageUrl} traits={card.traits} />
      ) : (
        <div
          className="w-full max-w-[300px] aspect-[3/4] rounded-sm border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center"
        >
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <span className="font-mono text-xs text-[var(--foreground)]/40">
        #{card.tokenId.toString()}
      </span>
    </div>
  );
}
