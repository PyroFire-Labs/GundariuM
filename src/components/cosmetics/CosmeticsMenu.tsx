"use client";

import { useState } from "react";
import { ColorTab } from "./ColorTab";
import { CostSummary } from "./CostSummary";
import { DecalTab } from "./DecalTab";
import { FrameTab } from "./FrameTab";
import { RepaintTab } from "./RepaintTab";

type Tab = "frames" | "decals" | "colors" | "repaint";

const TABS: { id: Tab; label: string }[] = [
  { id: "frames", label: "FRAMES" },
  { id: "decals", label: "DECALS" },
  { id: "colors", label: "COLORS" },
  { id: "repaint", label: "AI REPAINT" },
];

interface CosmeticsMenuProps {
  onConfirm: () => void;
  onSkip: () => void;
  confirmLabel?: string;
  skipLabel?: string;
}

export function CosmeticsMenu({
  onConfirm,
  onSkip,
  confirmLabel,
  skipLabel,
}: CosmeticsMenuProps) {
  const [activeTab, setActiveTab] = useState<Tab>("frames");

  return (
    <div className="flex flex-col" style={{ backgroundColor: "var(--surface)" }}>
      {/* Tab bar */}
      <div
        className="flex border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-3 text-xs font-[family-name:var(--font-orbitron)] font-bold tracking-wider transition-colors relative"
              style={{
                color: isActive ? "var(--accent)" : "color-mix(in srgb, var(--foreground) 40%, transparent)",
              }}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="max-h-[50vh] overflow-y-auto">
        {activeTab === "frames" && <FrameTab />}
        {activeTab === "decals" && <DecalTab />}
        {activeTab === "colors" && <ColorTab />}
        {activeTab === "repaint" && <RepaintTab />}
      </div>

      {/* Cost summary */}
      <div className="px-3 pb-3">
        <CostSummary
          onConfirm={onConfirm}
          onSkip={onSkip}
          confirmLabel={confirmLabel}
          skipLabel={skipLabel}
        />
      </div>
    </div>
  );
}
