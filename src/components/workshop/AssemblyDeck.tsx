import type { WorkshopAssembly, WorkshopAssemblyId, WorkshopFrame } from "@/lib/workshop/catalog";

interface AssemblyDeckProps {
  assemblies: WorkshopFrame["assemblies"];
  selectedAssemblyId: WorkshopAssemblyId;
  onSelectAssembly(id: WorkshopAssemblyId): void;
}

export function AssemblyDeck({ assemblies, selectedAssemblyId, onSelectAssembly }: AssemblyDeckProps) {
  return (
    <section aria-labelledby="assembly-heading" className="workshop-assembly-deck">
      <div className="workshop-section-heading">
        <div><p className="workshop-eyebrow">Virtual construction</p><h2 id="assembly-heading">Assembly deck</h2></div>
        <span>{assemblies.length} / {assemblies.length}</span>
      </div>
      <div className="workshop-assembly-list">
        {assemblies.map((assembly) => <AssemblyButton assembly={assembly} key={assembly.id} onSelect={onSelectAssembly} selected={assembly.id === selectedAssemblyId} />)}
      </div>
      <p className="workshop-disclosure">Assembly records are simulated display data; selecting one does not edit geometry or create a 3D model.</p>
    </section>
  );
}

function AssemblyButton({ assembly, selected, onSelect }: { assembly: WorkshopAssembly; selected: boolean; onSelect(id: WorkshopAssemblyId): void }) {
  return <button aria-pressed={selected} className="workshop-assembly-button" onClick={() => onSelect(assembly.id)} type="button"><span>{assembly.index}</span><strong>{assembly.title}</strong><small>{assembly.status}</small></button>;
}
