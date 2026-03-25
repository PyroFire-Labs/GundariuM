"use client";

import { useCosmeticsStore } from "@/store/useCosmeticsStore";

const TINT_PRESETS = [
  { label: "None", value: null, dot: "transparent", border: true },
  { label: "Red", value: "#ef4444", dot: "#ef4444" },
  { label: "Blue", value: "#3b82f6", dot: "#3b82f6" },
  { label: "Green", value: "#22c55e", dot: "#22c55e" },
  { label: "Gold", value: "#f59e0b", dot: "#f59e0b" },
  { label: "Purple", value: "#a855f7", dot: "#a855f7" },
  { label: "Pink", value: "#ec4899", dot: "#ec4899" },
  { label: "Cyan", value: "#06b6d4", dot: "#06b6d4" },
] as const;

export function ColorTab() {
  const colorShift = useCosmeticsStore((s) => s.colorShift);
  const tintColor = useCosmeticsStore((s) => s.tintColor);
  const setColorShift = useCosmeticsStore((s) => s.setColorShift);
  const setTintColor = useCosmeticsStore((s) => s.setTintColor);

  const hasChanges = colorShift !== 0 || tintColor !== null;

  function handleReset() {
    setColorShift(0);
    setTintColor(null);
  }

  return (
    <div className="flex flex-col gap-5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-[family-name:var(--font-orbitron)] font-bold tracking-widest" style={{ color: "var(--foreground)" }}>
          COLOR ADJUSTMENTS
        </span>
        {hasChanges && (
          <span className="text-xs font-bold font-mono" style={{ color: "var(--accent)" }}>
            $0.50
          </span>
        )}
      </div>

      {/* Hue Shift */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-[family-name:var(--font-orbitron)] tracking-wider" style={{ color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
            HUE SHIFT
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>
            {colorShift}°
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={colorShift}
          onChange={(e) => setColorShift(Number(e.target.value))}
          className="w-full h-3 rounded-full appearance-none cursor-pointer"
          style={{
            background:
              "linear-gradient(to right, #ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)",
          }}
        />
      </div>

      {/* Tint Color */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-[family-name:var(--font-orbitron)] tracking-wider" style={{ color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
          TINT COLOR
        </span>
        <div className="flex flex-wrap gap-2">
          {TINT_PRESETS.map((preset) => {
            const isSelected = tintColor === preset.value;

            return (
              <button
                key={preset.label}
                onClick={() => setTintColor(preset.value)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-[family-name:var(--font-orbitron)] transition-colors"
                style={{
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  backgroundColor: isSelected ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface)",
                  color: "var(--foreground)",
                }}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-white/30"
                  style={{ backgroundColor: preset.dot }}
                />
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {hasChanges && (
        <button
          onClick={handleReset}
          className="text-xs self-start transition-opacity hover:opacity-80"
          style={{ color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
        >
          Reset colors
        </button>
      )}
    </div>
  );
}
