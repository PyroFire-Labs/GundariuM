"use client";

import { FRAME_SKINS } from "@/lib/card/cosmetics-data";
import { useCosmeticsStore } from "@/store/useCosmeticsStore";

export function FrameTab() {
  const selectedFrame = useCosmeticsStore((s) => s.selectedFrame);
  const setFrame = useCosmeticsStore((s) => s.setFrame);

  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {FRAME_SKINS.map((skin) => {
        const isSelected = selectedFrame === skin.id;
        const isFree = skin.id === "base";

        return (
          <button
            key={skin.id}
            onClick={() => setFrame(skin.id)}
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
              <span
                className="w-6 h-6 rounded-full flex-shrink-0 border border-white/20"
                style={{ backgroundColor: skin.preview }}
              />
              <span
                className="text-xs font-[family-name:var(--font-orbitron)] font-bold leading-tight"
                style={{ color: "var(--foreground)" }}
              >
                {skin.name}
              </span>
            </div>

            <p className="text-xs leading-snug" style={{ color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
              {skin.description}
            </p>

            <span
              className="text-xs font-bold font-mono"
              style={{ color: isFree ? "#22c55e" : "var(--accent)" }}
            >
              {isFree ? "FREE" : "$0.50"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
