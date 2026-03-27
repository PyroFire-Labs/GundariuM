"use client";

import { DECALS } from "@/lib/card/cosmetics-data";
import { useCosmeticsStore } from "@/store/useCosmeticsStore";

export function DecalTab() {
  const selectedDecal = useCosmeticsStore((s) => s.selectedDecal);
  const setDecal = useCosmeticsStore((s) => s.setDecal);

  function handleSelect(id: string) {
    setDecal(selectedDecal === id ? null : id);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-xs" style={{ color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
        Select a decal to overlay on your card. Tap again to remove.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {DECALS.map((decal) => {
          const isSelected = selectedDecal === decal.id;

          return (
            <button
              key={decal.id}
              onClick={() => handleSelect(decal.id)}
              className="relative flex flex-col gap-2 p-3 rounded text-left transition-colors"
              style={{
                border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                backgroundColor: isSelected ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface)",
              }}
            >
              {isSelected && (
                <span
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-black"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  ✓
                </span>
              )}

              <div className="flex items-center gap-2">
                <img
                  src={`/data/decals/${decal.id}.png`}
                  alt={decal.name}
                  className="w-10 h-10 rounded flex-shrink-0 object-cover"
                />
                <span
                  className="text-xs font-[family-name:var(--font-orbitron)] font-bold leading-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  {decal.name}
                </span>
              </div>

              <p className="text-xs leading-snug" style={{ color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
                {decal.description}
              </p>

              <span className="text-xs font-bold font-mono" style={{ color: "var(--accent)" }}>
                $0.50
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
