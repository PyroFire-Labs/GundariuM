import type { WorkshopFrame } from "@/lib/workshop/catalog";

interface FrameGalleryProps {
  frames: readonly WorkshopFrame[];
  selectedFrameId: number;
  onSelectFrame(id: number): void;
}

export function FrameGallery({ frames, selectedFrameId, onSelectFrame }: FrameGalleryProps) {
  return (
    <section aria-labelledby="gallery-heading" className="workshop-gallery" id="gallery">
      <div className="workshop-section-heading">
        <div>
          <p className="workshop-eyebrow">Local / public catalog</p>
          <h2 id="gallery-heading">Kit gallery</h2>
        </div>
        <span>SELECT A FRAME</span>
      </div>
      <div className="workshop-frame-grid">
        {frames.map((frame) => (
          <button
            aria-pressed={frame.id === selectedFrameId}
            className="workshop-frame-card"
            key={frame.id}
            onClick={() => onSelectFrame(frame.id)}
            type="button"
          >
            {/* The static public gallery is the fallback, not a claim of ownership. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${frame.name} catalog art`} src={frame.image} />
            <span className="workshop-frame-token">FRAME {String(frame.id).padStart(3, "0")}</span>
            <strong>{frame.name}</strong>
            <small>{frame.rarity} / {frame.faction}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
