"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { CollectionCard } from "@/components/collection/CollectionCard";
import { useCollection } from "@/lib/contracts/hooks/useCollection";
import { toggleSavedFrame, type WorkshopAssemblyId, type WorkshopFrame } from "@/lib/workshop/catalog";
import { AssemblyDeck } from "./AssemblyDeck";
import { FrameGallery } from "./FrameGallery";
import { FrameInspector } from "./FrameInspector";
import { WorkshopHeader } from "./WorkshopHeader";
import "./workshop.css";

interface WorkshopClientProps {
  frames: readonly WorkshopFrame[];
}

export function WorkshopClient({ frames }: WorkshopClientProps) {
  const { address } = useAccount();
  const { cards: ownedCards, count, isConnected, isLoading } = useCollection();
  const [selectedFrameId, setSelectedFrameId] = useState(frames[0]?.id ?? 0);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<WorkshopAssemblyId>("head-optics");
  const [savedFrameIds, setSavedFrameIds] = useState<Set<number>>(new Set());
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0];

  if (!selectedFrame) return null;

  return (
    <main className="workshop-page">
      <WorkshopHeader />
      <div className="workshop-layout">
        <FrameGallery frames={frames} onSelectFrame={setSelectedFrameId} selectedFrameId={selectedFrame.id} />
        <section aria-labelledby="viewport-heading" className="workshop-viewport">
          <div className="workshop-section-heading">
            <div>
              <p className="workshop-eyebrow">Assembly deck / simulated</p>
              <h2 id="viewport-heading">{selectedFrame.name}</h2>
            </div>
            <span>PUBLIC CATALOG</span>
          </div>
          <div className="workshop-image-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${selectedFrame.name} selected catalog frame`} src={selectedFrame.image} />
          </div>
          <p className="workshop-disclosure">Virtual concept view. This screen makes no wallet, on-chain, server, or model-generation request.</p>
        </section>
        <AssemblyDeck assemblies={selectedFrame.assemblies} onSelectAssembly={setSelectedAssemblyId} selectedAssemblyId={selectedAssemblyId} />
        <FrameInspector frame={selectedFrame} isSaved={savedFrameIds.has(selectedFrame.id)} onToggleSaved={() => setSavedFrameIds((saved) => toggleSavedFrame(saved, selectedFrame.id))} savedCount={savedFrameIds.size} selectedAssembly={selectedFrame.assemblies.find((assembly) => assembly.id === selectedAssemblyId) ?? selectedFrame.assemblies[0]} />
      </div>
      <section aria-labelledby="owned-frames-heading" className="workshop-owned-frames">
        <div className="workshop-section-heading"><div><p className="workshop-eyebrow">Wallet inventory / read only</p><h2 id="owned-frames-heading">Your Gundar-Frames</h2></div><span>{isConnected ? `${count} DETECTED` : "CONNECT WALLET"}</span></div>
        {!isConnected && <p className="workshop-disclosure">Connect the wallet that owns your Gundar-Frames to inspect their live on-chain traits and NFT art here.</p>}
        {isConnected && isLoading && <p className="workshop-disclosure">Reading your owned frames from Base…</p>}
        {isConnected && !isLoading && ownedCards.length === 0 && <p className="workshop-disclosure">No Gundar-Frames were found for this connected wallet.</p>}
        {ownedCards.length > 0 && <div className="workshop-owned-grid">{ownedCards.map((card) => <article className="workshop-owned-card" key={card.tokenId.toString()}><CollectionCard card={card} ownerAddress={address} /><div className="workshop-owned-actions"><button disabled type="button">REPAIR / GNRM — CONTRACT PENDING</button><button disabled type="button">UPGRADE / GNRM — CONTRACT PENDING</button></div></article>)}</div>}
        <p className="workshop-disclosure">Repair and Upgrade pricing in GNRM will be added only after their on-chain contract, costs, and battle effects are approved. These controls cannot approve, transfer, or burn tokens today.</p>
      </section>
    </main>
  );
}
