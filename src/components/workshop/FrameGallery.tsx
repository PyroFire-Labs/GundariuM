import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";
import { OwnedNftArtwork } from "@/components/collection/OwnedNftArtwork";

interface FrameGalleryProps {
  cards: readonly OwnedCard[];
  connected: boolean;
  count: number;
  loading: boolean;
  selectedTokenId: bigint | null;
  onSelectToken(tokenId: bigint): void;
}

export function FrameGallery({ cards, connected, count, loading, selectedTokenId, onSelectToken }: FrameGalleryProps) {
  return (
    <section aria-labelledby="gallery-heading" className="workshop-gallery" id="gallery">
      <div className="workshop-section-heading">
        <div>
          <p className="workshop-eyebrow">Connected wallet / on-chain NFTs</p>
          <h2 id="gallery-heading">Your Gundar-Frames</h2>
        </div>
        <span>{connected ? `${count} DETECTED` : "WALLET REQUIRED"}</span>
      </div>
      {!connected && <p className="workshop-disclosure">Connect the wallet that owns your Gundar-Frame NFTs to load them here.</p>}
      {connected && loading && <p className="workshop-disclosure">Reading NFT ownership and on-chain traits…</p>}
      {connected && !loading && cards.length === 0 && <p className="workshop-disclosure">No Gundar-Frame NFTs were found in this wallet on the connected network.</p>}
      {cards.length > 0 && <div className="workshop-frame-grid">
        {cards.map((card) => (
          <button
            aria-pressed={card.tokenId === selectedTokenId}
            className="workshop-frame-card"
            key={card.tokenId.toString()}
            onClick={() => onSelectToken(card.tokenId)}
            type="button"
          >
            <OwnedNftArtwork alt={`${card.traits.name} NFT artwork`} className="workshop-owned-thumbnail" imageClassName="workshop-owned-thumbnail-image" tokenUri={card.tokenUri} />
            <span className="workshop-frame-token">TOKEN #{card.tokenId.toString()}</span>
            <strong>{card.traits.name}</strong>
            <small>{card.traits.rarity} / {card.traits.faction}</small>
          </button>
        ))}
      </div>}
    </section>
  );
}
