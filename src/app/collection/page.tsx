"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChainId, useSwitchChain } from "wagmi";
import { CountdownPage } from "@/components/ui/CountdownTimer";
import { CollectionCard } from "@/components/collection/CollectionCard";
import { useCollection } from "@/lib/contracts/hooks/useCollection";

const MINT_ENABLED = process.env.NEXT_PUBLIC_MINT_ENABLED === "true";
const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);

export default function CollectionPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { cards, isLoading, isConnected, count } = useCollection();
  const walletReady = mounted && isConnected;

  if (!MINT_ENABLED) {
    return (
      <CountdownPage
        pageTitle="COLLECTION"
        missionLabel="COLLECTION UNLOCKS"
        description="View and manage your Gunpla NFT card collection."
      />
    );
  }

  const wrongChain = walletReady && chainId !== TARGET_CHAIN_ID;

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center px-4 py-12 gap-8">
      <div className="text-center space-y-2">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl md:text-4xl font-bold text-[var(--accent)] tracking-wider">
          YOUR COLLECTION
        </h1>
        <p className="text-[var(--foreground)]/60 text-sm">
          {walletReady && !wrongChain
            ? `${count} ${count === 1 ? "Gundar-Frame" : "Gundar-Frames"} owned`
            : "Connect your wallet to view your Gundar-Frames"}
        </p>
      </div>

      {mounted && !isConnected && (
        <p className="text-[var(--foreground)]/40 text-sm font-[family-name:var(--font-orbitron)] tracking-widest">
          WALLET NOT CONNECTED
        </p>
      )}

      {wrongChain && (
        <button
          onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
          className="px-6 py-3 bg-yellow-500 text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          SWITCH TO {TARGET_CHAIN_ID === 8453 ? "BASE" : "BASE SEPOLIA"}
        </button>
      )}

      {walletReady && !wrongChain && isLoading && (
        <div className="flex items-center gap-3 py-12">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[var(--accent)] text-sm font-[family-name:var(--font-orbitron)] tracking-wider">
            LOADING CARDS…
          </span>
        </div>
      )}

      {walletReady && !wrongChain && !isLoading && count === 0 && (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-[var(--foreground)]/60 text-sm">
            You don&apos;t own any Gundar-Frames yet.
          </p>
          <Link
            href="/mint"
            className="px-6 py-2.5 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
          >
            MINT YOUR FIRST
          </Link>
        </div>
      )}

      {walletReady && !wrongChain && cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
          {cards.map((card) => (
            <CollectionCard key={card.tokenId.toString()} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
