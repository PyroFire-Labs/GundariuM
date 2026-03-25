"use client";

import { REPAINT_STYLES, type RepaintStyle } from "@/lib/card/cosmetics-data";
import { useCosmeticsStore } from "@/store/useCosmeticsStore";

const CATEGORY_LABELS: Record<RepaintStyle["category"], string> = {
  weathering: "WEATHERING",
  tactical: "TACTICAL",
  fantasy: "FANTASY",
};

const CATEGORIES: RepaintStyle["category"][] = ["weathering", "tactical", "fantasy"];

export function RepaintTab() {
  const repaintStyle = useCosmeticsStore((s) => s.repaintStyle);
  const setRepaintStyle = useCosmeticsStore((s) => s.setRepaintStyle);

  function handleSelect(id: number) {
    setRepaintStyle(repaintStyle === id ? 0 : id);
  }

  return (
    <div className="flex flex-col gap-5 p-3">
      <p className="text-xs" style={{ color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
        Choose an AI repaint style. Claude will regenerate your card art with the selected look for $2.00 USDC.
      </p>

      {repaintStyle > 0 && (
        <button
          onClick={() => setRepaintStyle(0)}
          className="text-xs self-start transition-opacity hover:opacity-80"
          style={{ color: "#ef4444" }}
        >
          Remove repaint selection
        </button>
      )}

      {CATEGORIES.map((category) => {
        const styles = REPAINT_STYLES.filter((s) => s.category === category);

        return (
          <div key={category} className="flex flex-col gap-2">
            <span
              className="text-xs font-[family-name:var(--font-orbitron)] font-bold tracking-widest"
              style={{ color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
            >
              {CATEGORY_LABELS[category]}
            </span>

            <div className="grid grid-cols-2 gap-3">
              {styles.map((style) => {
                const isSelected = repaintStyle === style.id;

                return (
                  <button
                    key={style.id}
                    onClick={() => handleSelect(style.id)}
                    className="relative flex flex-col gap-2 p-3 rounded text-left transition-colors"
                    style={{
                      border: `1px solid ${isSelected ? "var(--accent-2)" : "var(--border)"}`,
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--accent-2) 10%, transparent)"
                        : "var(--surface)",
                    }}
                  >
                    {isSelected && (
                      <span
                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: "var(--accent-2)" }}
                      >
                        ✓
                      </span>
                    )}

                    <span
                      className="text-xs font-[family-name:var(--font-orbitron)] font-bold leading-tight pr-6"
                      style={{ color: "var(--foreground)" }}
                    >
                      {style.name}
                    </span>

                    <p
                      className="text-xs leading-snug"
                      style={{ color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
                    >
                      {style.description}
                    </p>

                    <span className="text-xs font-bold font-mono" style={{ color: "var(--accent-2)" }}>
                      $2.00
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
