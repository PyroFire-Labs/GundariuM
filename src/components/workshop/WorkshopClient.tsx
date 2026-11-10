"use client";

import { useState } from "react";
import { OwnedNftArtwork } from "@/components/collection/OwnedNftArtwork";
import { useCollection } from "@/lib/contracts/hooks/useCollection";
import { buildWorkshopFrame, toggleSavedFrame, type GalleryCard, type WorkshopAssemblyId, type WorkshopFrame } from "@/lib/workshop/catalog";
import { AssemblyDeck } from "./AssemblyDeck";
import { FrameGallery } from "./FrameGallery";
import { FrameInspector } from "./FrameInspector";
import { WorkshopHeader } from "./WorkshopHeader";
import "./workshop.css";

export function WorkshopClient() {
  const { cards: ownedCards, count, isConnected, isLoading } = useCollection();
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<WorkshopAssemblyId>("head-optics");
  const [savedFrameIds, setSavedFrameIds] = useState<Set<number>>(new Set());
  const selectedCard = ownedCards.find((card) => card.tokenId === selectedTokenId) ?? ownedCards[0];
  const selectedFrame: WorkshopFrame | undefined = selectedCard ? buildWorkshopFrame({
    id: Number(selectedCard.tokenId),
    image: "",
    name: selectedCard.traits.name,
    series: selectedCard.traits.series,
    faction: selectedCard.traits.faction,
    rarity: selectedCard.traits.rarity,
    hp: selectedCard.traits.hp,
    armorType: selectedCard.traits.armorType,
    primaryWeapon: selectedCard.traits.primaryWeapon,
    primaryDamage: selectedCard.traits.primaryDamage,
    secondaryWeapon: selectedCard.traits.secondaryWeapon,
    secondaryDamage: selectedCard.traits.secondaryDamage,
    tertiaryWeapon: selectedCard.traits.tertiaryWeapon,
    tertiaryDamage: selectedCard.traits.tertiaryDamage,
    specialAttack: selectedCard.traits.specialAttack,
    specialDamage: selectedCard.traits.specialDamage,
  } satisfies GalleryCard) : undefined;
  const selectedAssembly = selectedFrame?.assemblies.find((assembly) => assembly.id === selectedAssemblyId) ?? selectedFrame?.assemblies[0];

  return (
    <main className="workshop-page">
      <WorkshopHeader />
      <div className="workshop-layout">
        <FrameGallery cards={ownedCards} connected={isConnected} count={count} loading={isLoading} onSelectToken={setSelectedTokenId} selectedTokenId={selectedCard?.tokenId ?? null} />
        <section aria-labelledby="viewport-heading" className="workshop-viewport">
          {selectedCard && selectedFrame ? <>
            <div className="workshop-section-heading">
              <div>
                <p className="workshop-eyebrow">Selected owned NFT / read only</p>
                <h2 id="viewport-heading">{selectedCard.traits.name}</h2>
              </div>
              <span>TOKEN #{selectedCard.tokenId.toString()}</span>
            </div>
            <OwnedNftArtwork alt={`${selectedCard.traits.name} NFT artwork`} className="workshop-image-frame workshop-selected-artwork" imageClassName="workshop-selected-artwork-image" tokenUri={selectedCard.tokenUri} />
            <p className="workshop-disclosure">Live NFT artwork and on-chain traits for the selected token. Repair and Upgrade remain unavailable until their contracts are implemented.</p>
            <div className="workshop-owned-actions">
              <button disabled type="button">REPAIR / GNRM — CONTRACT PENDING</button>
              <button disabled type="button">UPGRADE / GNRM — CONTRACT PENDING</button>
            </div>
          </> : <>
            <div className="workshop-section-heading"><div><p className="workshop-eyebrow">Your Gundar-Frame workshop</p><h2 id="viewport-heading">Select an owned NFT</h2></div></div>
            <p className="workshop-disclosure">Connect the wallet that owns your Gundar-Frame NFTs. The workshop will load your actual tokens here; it does not substitute catalog showcase art.</p>
          </>}
        </section>
        {selectedFrame && <>
          <AssemblyDeck assemblies={selectedFrame.assemblies} onSelectAssembly={setSelectedAssemblyId} selectedAssemblyId={selectedAssembly?.id ?? selectedAssemblyId} />
          {selectedAssembly && <FrameInspector frame={selectedFrame} isSaved={savedFrameIds.has(selectedFrame.id)} onToggleSaved={() => setSavedFrameIds((saved) => toggleSavedFrame(saved, selectedFrame.id))} savedCount={savedFrameIds.size} selectedAssembly={selectedAssembly} />}
        </>}
      </div>
      {isConnected && !isLoading && count > 0 && ownedCards.length === 0 && <p className="workshop-disclosure workshop-inventory-warning">The wallet reports {count} NFT(s), but their on-chain traits could not be loaded. Check that the selected network matches the Gundar-Frame contract.</p>}
    </main>
  );
}
