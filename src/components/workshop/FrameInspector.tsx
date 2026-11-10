import type { WorkshopAssembly, WorkshopFrame } from "@/lib/workshop/catalog";

interface FrameInspectorProps {
  frame: WorkshopFrame;
  selectedAssembly: WorkshopAssembly;
  isSaved: boolean;
  savedCount: number;
  onToggleSaved(): void;
}

export function FrameInspector({ frame, selectedAssembly, isSaved, savedCount, onToggleSaved }: FrameInspectorProps) {
  return <aside aria-label="Selected frame simulated specifications" className="workshop-inspector">
    <p className="workshop-eyebrow">Simulated specs</p><h2>{frame.name}</h2>
    <dl className="workshop-stats">{frame.stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
    <section className="workshop-selected-assembly" aria-live="polite"><p className="workshop-eyebrow">Selected assembly {selectedAssembly.index}</p><h3>{selectedAssembly.title}</h3><p>{selectedAssembly.detail}</p><span>{selectedAssembly.status}</span></section>
    <button className="workshop-save-button" onClick={onToggleSaved} type="button">{isSaved ? "REMOVE LOCAL KIT" : "SAVE KIT LOCALLY"}</button>
    <p className="workshop-local-note">Local saved kits ({savedCount}). This changes only this open screen—no wallet, server, or on-chain record is created.</p>
    <div className="workshop-operation-placeholders"><button disabled type="button">REPAIR WITH GNRM — CONTRACT PENDING</button><button disabled type="button">UPGRADE WITH GNRM — CONTRACT PENDING</button></div>
  </aside>;
}
