"use client";

import { useState } from "react";
import Link from "next/link";
import { useCollection } from "@/lib/contracts/hooks/useCollection";
import { GunplaCardItem } from "@/components/collection/GunplaCardItem";

export default function CollectionPage() {
  const { cards, isLoading, isConnected, count } = useCollection();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
            YOUR COLLECTION
          </h1>
          <p className="text-[var(--foreground)]/60">Connect your wallet to view your cards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
            YOUR COLLECTION
          </h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-[var(--foreground)]/50">
              {count === 0 ? "No cards yet" : `${count} card${count !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>
        <Link
          href="/mint"
          className="rounded-full bg-[var(--accent)] px-5 py-2 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_16px_var(--accent)]"
        >
          + MINT NEW
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-24">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--accent)] font-[family-name:var(--font-orbitron)] text-sm">
            LOADING CARDS…
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && count === 0 && (
        <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
          <div className="text-5xl">📷</div>
          <div>
            <p className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-[var(--foreground)]/60">
              No cards in your hangar
            </p>
            <p className="mt-1 text-sm text-[var(--foreground)]/40">
              Photograph your Gunpla and mint your first card.
            </p>
          </div>
          <Link
            href="/mint"
            className="rounded-full bg-[var(--accent)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_24px_var(--accent)]"
          >
            MINT YOUR FIRST CARD
          </Link>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && cards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 items-start sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cards.map((card) => {
            const id = card.tokenId.toString();
            return (
              <GunplaCardItem
                key={id}
                card={card}
                isExpanded={selectedId === id}
                onToggle={() => handleSelect(id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
