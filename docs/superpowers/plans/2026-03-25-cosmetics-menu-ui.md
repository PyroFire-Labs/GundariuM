# Cosmetics Menu UI — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cosmetics selection UI with 4 tabs (Frames, Decals, Colors, AI Repaint) that integrates into both the mint flow and the collection page, with live card preview updates and a running cost total.

**Architecture:** Zustand store tracks cosmetic selections. A tabbed `CosmeticsMenu` component shows available options with prices. The existing `CardFrame` component updates live as selections change. Cosmetics are available at mint time (between card preview and confirm) and post-mint (via "Customize" button on collection page). Frame skins and decals use placeholder data for now; real assets are swapped in later.

**Tech Stack:** React 19, Zustand, TailwindCSS v4, existing CardFrame component

**Note:** No test framework in this project. Verification is manual via browser.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/store/useCosmeticsStore.ts` | Zustand store for cosmetic selections, cost calculation |
| `src/lib/card/cosmetics-data.ts` | Static data: frame skins, decal options, AI repaint styles with metadata |
| `src/components/cosmetics/CosmeticsMenu.tsx` | Tabbed container with cost summary and navigation |
| `src/components/cosmetics/FrameTab.tsx` | Grid of frame skin options |
| `src/components/cosmetics/DecalTab.tsx` | Grid of decal sticker options |
| `src/components/cosmetics/ColorTab.tsx` | Hue shift slider + tint color picker |
| `src/components/cosmetics/RepaintTab.tsx` | AI repaint style gallery (12 styles) |
| `src/components/cosmetics/CostSummary.tsx` | Running total display + action button |

### Modified Files
| File | Change |
|------|--------|
| `src/store/useMintStore.ts` | Add `"cosmetics_select"` step to MintStep |
| `src/app/mint/page.tsx` | Add cosmetics_select step routing + import |
| `src/components/mint/CardPreview.tsx` | Add "ADD COSMETICS" button option alongside "CONFIRM & MINT" |
| `src/components/card/CardFrame.tsx` | Accept optional cosmetic overrides (frameId, colorShift, tint) for live preview |
| `src/app/collection/page.tsx` | Add "Customize" button per card that opens cosmetics menu |

---

## Task 1: Create cosmetics data (frame skins, decals, repaint styles)

**Files:**
- Create: `src/lib/card/cosmetics-data.ts`

- [ ] **Step 1: Create the static data file**

```typescript
export interface FrameSkin {
  id: string;
  name: string;
  description: string;
  category: "faction" | "elite";
  preview: string; // placeholder color or future asset path
}

export interface Decal {
  id: string;
  name: string;
  description: string;
  category: "faction" | "battle" | "custom";
  preview: string;
}

export interface RepaintStyle {
  id: number; // 1-12, matches on-chain repaintStyle uint8
  name: string;
  description: string;
  category: "weathering" | "tactical" | "fantasy";
  prompt: string; // AI prompt template (used later by /api/generate-repaint)
}

// ─── Frame Skins ───────────────────────────────────────────────────────
// id "base" is the free GundariuM frame, everything else is $0.50

export const FRAME_SKINS: FrameSkin[] = [
  { id: "base", name: "GundariuM Standard", description: "The default HUD frame", category: "faction", preview: "#00d4ff" },
  { id: "zeon", name: "Zeon Crimson", description: "Principality of Zeon red frame", category: "faction", preview: "#dc2626" },
  { id: "efsf", name: "EFSF Blue", description: "Earth Federation blue frame", category: "faction", preview: "#2563eb" },
  { id: "celestial", name: "Celestial Being", description: "GN particle green frame", category: "faction", preview: "#22c55e" },
  { id: "titans", name: "Titans Purple", description: "Titans elite purple frame", category: "faction", preview: "#7c3aed" },
  { id: "chrome", name: "Chrome Elite", description: "Polished chrome finish", category: "elite", preview: "#e5e7eb" },
  { id: "holo", name: "Holographic", description: "Holographic shimmer effect", category: "elite", preview: "#f59e0b" },
  { id: "damaged", name: "Battle Damaged", description: "War-torn frame with scratches", category: "elite", preview: "#78716c" },
];

// ─── Decals ────────────────────────────────────────────────────────────

export const DECALS: Decal[] = [
  { id: "zeon-crest", name: "Zeon Crest", description: "Principality emblem", category: "faction", preview: "#dc2626" },
  { id: "efsf-star", name: "EFSF Star", description: "Federation star insignia", category: "faction", preview: "#2563eb" },
  { id: "anaheim", name: "Anaheim Electronics", description: "AE corporate logo", category: "faction", preview: "#94a3b8" },
  { id: "ace-badge", name: "Ace Pilot", description: "5-kill ace badge", category: "battle", preview: "#f59e0b" },
  { id: "kill-tally", name: "Kill Tally", description: "Sortie count marks", category: "battle", preview: "#ef4444" },
  { id: "campaign", name: "Campaign Ribbon", description: "Operation veteran ribbon", category: "battle", preview: "#22c55e" },
];

// ─── AI Repaint Styles ─────────────────────────────────────────────────

export const REPAINT_STYLES: RepaintStyle[] = [
  { id: 1, name: "Desert Storm", description: "Sand-blasted, faded paint, dust accumulation", category: "weathering", prompt: "Apply a desert storm weathering effect to this Gunpla model. Sand-blasted, faded paint with dust accumulation on armor panels." },
  { id: 2, name: "Arctic Ops", description: "Frost/ice buildup, white-blue weathering", category: "weathering", prompt: "Apply arctic operations weathering. Frost and ice buildup, white-blue weathering, cracked paint from extreme cold." },
  { id: 3, name: "Battle Scarred", description: "Scorch marks, bullet holes, chipped armor", category: "weathering", prompt: "Apply heavy battle damage. Scorch marks, bullet impacts, chipped and peeling armor paint, exposed metal underneath." },
  { id: 4, name: "Deep Space Corroded", description: "Oxidation, pitting, vacuum damage", category: "weathering", prompt: "Apply deep space corrosion effects. Oxidation, micro-pitting from debris, vacuum exposure damage, faded markings." },
  { id: 5, name: "Urban Camo", description: "Grey/black/white geometric camo", category: "tactical", prompt: "Repaint with urban camouflage pattern. Grey, black, and white geometric digital camo across all armor panels." },
  { id: 6, name: "Forest Camo", description: "Green/brown/tan organic camo", category: "tactical", prompt: "Repaint with forest camouflage pattern. Green, brown, and tan organic woodland camo pattern." },
  { id: 7, name: "Stealth Black", description: "Matte black with subtle panel lines", category: "tactical", prompt: "Repaint in full stealth matte black. Subtle panel line contrast only, no reflections, radar-absorbing coating look." },
  { id: 8, name: "Titan Chrome", description: "Mirror chrome/polished metal finish", category: "tactical", prompt: "Repaint with mirror chrome finish. Polished reflective metal across all panels, like liquid mercury." },
  { id: 9, name: "Neon Cyberpunk", description: "Glowing neon accents, dark base", category: "fantasy", prompt: "Repaint in cyberpunk style. Dark matte base with glowing neon cyan and magenta edge accents, LED-like panel lines." },
  { id: 10, name: "Blood Red Ace", description: "Deep crimson, Char Aznable vibes", category: "fantasy", prompt: "Repaint in deep crimson red. Full Char Aznable red comet paint scheme, bold and aggressive." },
  { id: 11, name: "Ghost White", description: "Ethereal white with pale blue glow", category: "fantasy", prompt: "Repaint in ethereal ghost white. Pale luminous white with subtle blue-white glow effects on edges." },
  { id: 12, name: "Gold Plated", description: "Full gold/brass ornamental finish", category: "fantasy", prompt: "Repaint with gold plating. Full ornamental gold and brass finish, ceremonial royal look." },
];

// ─── Pricing ───────────────────────────────────────────────────────────

export const COSMETIC_PRICE = 0.5;  // $0.50 USDC for frames/decals/color
export const REPAINT_PRICE = 2.0;   // $2.00 USDC for AI repaint
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/card/cosmetics-data.ts
git commit -m "feat: add cosmetics data — frame skins, decals, AI repaint styles"
```

---

## Task 2: Create the cosmetics Zustand store

**Files:**
- Create: `src/store/useCosmeticsStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from "zustand";
import { COSMETIC_PRICE, REPAINT_PRICE } from "@/lib/card/cosmetics-data";

interface CosmeticsState {
  // Selections
  selectedFrame: string;        // frame skin id ("base" = free)
  selectedDecal: string | null; // decal id or null
  colorShift: number;           // hue rotation 0-360
  tintColor: string | null;     // hex color or null
  repaintStyle: number;         // 0 = none, 1-12 = style id

  // Computed
  totalCost: number;

  // For post-mint: which token is being customized
  editingTokenId: bigint | null;

  // Actions
  setFrame: (id: string) => void;
  setDecal: (id: string | null) => void;
  setColorShift: (degrees: number) => void;
  setTintColor: (hex: string | null) => void;
  setRepaintStyle: (id: number) => void;
  setEditingTokenId: (tokenId: bigint | null) => void;
  reset: () => void;
}

function calculateCost(state: {
  selectedFrame: string;
  selectedDecal: string | null;
  colorShift: number;
  tintColor: string | null;
  repaintStyle: number;
}): number {
  let cost = 0;
  if (state.selectedFrame !== "base") cost += COSMETIC_PRICE;
  if (state.selectedDecal) cost += COSMETIC_PRICE;
  if (state.colorShift !== 0 || state.tintColor) cost += COSMETIC_PRICE;
  if (state.repaintStyle > 0) cost += REPAINT_PRICE;
  return cost;
}

const initialState = {
  selectedFrame: "base",
  selectedDecal: null,
  colorShift: 0,
  tintColor: null,
  repaintStyle: 0,
  totalCost: 0,
  editingTokenId: null,
};

export const useCosmeticsStore = create<CosmeticsState>((set) => ({
  ...initialState,

  setFrame: (id) =>
    set((s) => {
      const next = { ...s, selectedFrame: id };
      return { ...next, totalCost: calculateCost(next) };
    }),

  setDecal: (id) =>
    set((s) => {
      const next = { ...s, selectedDecal: id };
      return { ...next, totalCost: calculateCost(next) };
    }),

  setColorShift: (degrees) =>
    set((s) => {
      const next = { ...s, colorShift: degrees };
      return { ...next, totalCost: calculateCost(next) };
    }),

  setTintColor: (hex) =>
    set((s) => {
      const next = { ...s, tintColor: hex };
      return { ...next, totalCost: calculateCost(next) };
    }),

  setRepaintStyle: (id) =>
    set((s) => {
      const next = { ...s, repaintStyle: id };
      return { ...next, totalCost: calculateCost(next) };
    }),

  setEditingTokenId: (tokenId) => set({ editingTokenId: tokenId }),

  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/store/useCosmeticsStore.ts
git commit -m "feat: add cosmetics Zustand store with cost calculation"
```

---

## Task 3: Build CostSummary component

**Files:**
- Create: `src/components/cosmetics/CostSummary.tsx`

- [ ] **Step 1: Create the component**

A compact bar showing the running total and an action button. Used at the bottom of the CosmeticsMenu.

```tsx
"use client";

import { useCosmeticsStore } from "@/store/useCosmeticsStore";

interface CostSummaryProps {
  onConfirm: () => void;
  onSkip: () => void;
  confirmLabel?: string;
  skipLabel?: string;
}

export function CostSummary({ onConfirm, onSkip, confirmLabel = "APPLY COSMETICS", skipLabel = "SKIP" }: CostSummaryProps) {
  const { totalCost } = useCosmeticsStore();

  return (
    <div className="flex flex-col gap-2 w-full">
      {totalCost > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <span className="text-[var(--foreground)]/60 text-xs font-[family-name:var(--font-orbitron)]">
            COSMETICS TOTAL
          </span>
          <span className="font-mono font-bold text-[var(--accent)]">
            ${totalCost.toFixed(2)} USDC
          </span>
        </div>
      )}
      <button
        onClick={onConfirm}
        className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
      >
        {totalCost > 0 ? confirmLabel : "CONTINUE →"}
      </button>
      <button
        onClick={onSkip}
        className="w-full py-2 text-[var(--foreground)]/40 text-sm hover:text-[var(--foreground)]/60 transition-colors"
      >
        {skipLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cosmetics/CostSummary.tsx
git commit -m "feat: add CostSummary component with running total display"
```

---

## Task 4: Build the 4 tab components

**Files:**
- Create: `src/components/cosmetics/FrameTab.tsx`
- Create: `src/components/cosmetics/DecalTab.tsx`
- Create: `src/components/cosmetics/ColorTab.tsx`
- Create: `src/components/cosmetics/RepaintTab.tsx`

Each tab is a grid of selectable options. Selected option gets a highlight ring. Clicking toggles selection (click again to deselect, except frame which always has a selection).

- [ ] **Step 1: Create FrameTab**

Grid of frame skins. "base" (free) is pre-selected. Others show $0.50 price badge.

```tsx
"use client";

import { useCosmeticsStore } from "@/store/useCosmeticsStore";
import { FRAME_SKINS } from "@/lib/card/cosmetics-data";

export function FrameTab() {
  const { selectedFrame, setFrame } = useCosmeticsStore();

  return (
    <div className="grid grid-cols-2 gap-3">
      {FRAME_SKINS.map((skin) => {
        const isSelected = selectedFrame === skin.id;
        const isFree = skin.id === "base";

        return (
          <button
            key={skin.id}
            onClick={() => setFrame(skin.id)}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
              isSelected
                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--foreground)]/30"
            }`}
          >
            {/* Color preview circle */}
            <div
              className="w-10 h-10 rounded-full border-2"
              style={{ backgroundColor: skin.preview, borderColor: skin.preview }}
            />
            <span className="text-xs font-bold text-[var(--foreground)] text-center leading-tight">
              {skin.name}
            </span>
            <span className="text-[8px] text-[var(--foreground)]/40 text-center">
              {skin.description}
            </span>
            {/* Price badge */}
            <span className={`font-mono text-[10px] font-bold ${isFree ? "text-green-400" : "text-[var(--accent)]"}`}>
              {isFree ? "FREE" : "$0.50"}
            </span>
            {isSelected && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--accent)] rounded-full flex items-center justify-center">
                <span className="text-black text-[10px]">✓</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create DecalTab**

Grid of decals. Null = no decal. Clicking a selected decal deselects it.

```tsx
"use client";

import { useCosmeticsStore } from "@/store/useCosmeticsStore";
import { DECALS } from "@/lib/card/cosmetics-data";

export function DecalTab() {
  const { selectedDecal, setDecal } = useCosmeticsStore();

  return (
    <div className="space-y-3">
      <p className="text-[var(--foreground)]/40 text-xs">
        Select a decal to overlay on your card. Tap again to remove.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {DECALS.map((decal) => {
          const isSelected = selectedDecal === decal.id;

          return (
            <button
              key={decal.id}
              onClick={() => setDecal(isSelected ? null : decal.id)}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--foreground)]/30"
              }`}
            >
              <div
                className="w-8 h-8 rounded border"
                style={{ backgroundColor: decal.preview + "33", borderColor: decal.preview }}
              />
              <span className="text-xs font-bold text-[var(--foreground)] text-center leading-tight">
                {decal.name}
              </span>
              <span className="text-[8px] text-[var(--foreground)]/40 text-center">
                {decal.description}
              </span>
              <span className="font-mono text-[10px] font-bold text-[var(--accent)]">$0.50</span>
              {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--accent)] rounded-full flex items-center justify-center">
                  <span className="text-black text-[10px]">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ColorTab**

Hue shift slider (0-360) + optional tint color input.

```tsx
"use client";

import { useCosmeticsStore } from "@/store/useCosmeticsStore";

const PRESET_TINTS = [
  { label: "None", value: null },
  { label: "Red", value: "#ef4444" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#22c55e" },
  { label: "Gold", value: "#f59e0b" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
  { label: "Cyan", value: "#06b6d4" },
];

export function ColorTab() {
  const { colorShift, tintColor, setColorShift, setTintColor } = useCosmeticsStore();
  const hasChanges = colorShift !== 0 || tintColor !== null;

  return (
    <div className="space-y-4">
      <p className="text-[var(--foreground)]/40 text-xs">
        Adjust the color of your card photo. {hasChanges ? "$0.50 USDC" : "Free while unchanged."}
      </p>

      {/* Hue shift slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)]">
            HUE SHIFT
          </span>
          <span className="font-mono text-xs text-[var(--foreground)]">
            {colorShift}°
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={colorShift}
          onChange={(e) => setColorShift(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          style={{
            background: `linear-gradient(to right,
              hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%),
              hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))`,
          }}
        />
      </div>

      {/* Tint presets */}
      <div className="space-y-2">
        <span className="text-xs text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)]">
          TINT COLOR
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESET_TINTS.map((t) => (
            <button
              key={t.label}
              onClick={() => setTintColor(t.value)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-all ${
                tintColor === t.value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] hover:border-[var(--foreground)]/30"
              }`}
            >
              {t.value && (
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.value }} />
              )}
              <span className="text-[var(--foreground)]/80">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {hasChanges && (
        <button
          onClick={() => { setColorShift(0); setTintColor(null); }}
          className="text-xs text-[var(--foreground)]/40 hover:text-[var(--foreground)]/60 transition-colors"
        >
          Reset colors
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create RepaintTab**

Gallery of 12 AI repaint styles grouped by category. Shows style name, description, and $2.00 price.

```tsx
"use client";

import { useCosmeticsStore } from "@/store/useCosmeticsStore";
import { REPAINT_STYLES } from "@/lib/card/cosmetics-data";

const CATEGORIES = [
  { key: "weathering", label: "WEATHERING" },
  { key: "tactical", label: "TACTICAL" },
  { key: "fantasy", label: "FANTASY" },
] as const;

export function RepaintTab() {
  const { repaintStyle, setRepaintStyle } = useCosmeticsStore();

  return (
    <div className="space-y-4">
      <p className="text-[var(--foreground)]/40 text-xs">
        AI will repaint your Gunpla photo in the selected style. $2.00 USDC per repaint.
      </p>

      {repaintStyle > 0 && (
        <button
          onClick={() => setRepaintStyle(0)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Remove repaint selection
        </button>
      )}

      {CATEGORIES.map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <span className="text-[10px] text-[var(--foreground)]/40 font-[family-name:var(--font-orbitron)] tracking-wider">
            {label}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {REPAINT_STYLES.filter((s) => s.category === key).map((style) => {
              const isSelected = repaintStyle === style.id;

              return (
                <button
                  key={style.id}
                  onClick={() => setRepaintStyle(isSelected ? 0 : style.id)}
                  className={`relative flex flex-col gap-1 p-3 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? "border-[var(--accent-2)] bg-[var(--accent-2)]/10"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--foreground)]/30"
                  }`}
                >
                  <span className="text-xs font-bold text-[var(--foreground)]">
                    {style.name}
                  </span>
                  <span className="text-[8px] text-[var(--foreground)]/40 leading-tight">
                    {style.description}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[var(--accent-2)]">$2.00</span>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-[var(--accent-2)] rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px]">✓</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/cosmetics/FrameTab.tsx src/components/cosmetics/DecalTab.tsx src/components/cosmetics/ColorTab.tsx src/components/cosmetics/RepaintTab.tsx
git commit -m "feat: add cosmetics tab components — frames, decals, colors, AI repaint"
```

---

## Task 5: Build CosmeticsMenu container

**Files:**
- Create: `src/components/cosmetics/CosmeticsMenu.tsx`

- [ ] **Step 1: Create the tabbed container**

```tsx
"use client";

import { useState } from "react";
import { FrameTab } from "./FrameTab";
import { DecalTab } from "./DecalTab";
import { ColorTab } from "./ColorTab";
import { RepaintTab } from "./RepaintTab";
import { CostSummary } from "./CostSummary";

const TABS = [
  { key: "frames", label: "FRAMES" },
  { key: "decals", label: "DECALS" },
  { key: "colors", label: "COLORS" },
  { key: "repaint", label: "AI REPAINT" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface CosmeticsMenuProps {
  onConfirm: () => void;
  onSkip: () => void;
  confirmLabel?: string;
  skipLabel?: string;
}

export function CosmeticsMenu({ onConfirm, onSkip, confirmLabel, skipLabel }: CosmeticsMenuProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("frames");

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-[10px] font-[family-name:var(--font-orbitron)] font-bold tracking-wider transition-all ${
              activeTab === tab.key
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                : "text-[var(--foreground)]/40 hover:text-[var(--foreground)]/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-h-[50vh] overflow-y-auto pr-1">
        {activeTab === "frames" && <FrameTab />}
        {activeTab === "decals" && <DecalTab />}
        {activeTab === "colors" && <ColorTab />}
        {activeTab === "repaint" && <RepaintTab />}
      </div>

      {/* Cost summary + actions */}
      <CostSummary
        onConfirm={onConfirm}
        onSkip={onSkip}
        confirmLabel={confirmLabel}
        skipLabel={skipLabel}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cosmetics/CosmeticsMenu.tsx
git commit -m "feat: add CosmeticsMenu tabbed container with cost summary"
```

---

## Task 6: Wire cosmetics into the mint flow

**Files:**
- Modify: `src/store/useMintStore.ts` — add `"cosmetics_select"` step
- Modify: `src/app/mint/page.tsx` — add step routing
- Modify: `src/components/mint/CardPreview.tsx` — add "ADD COSMETICS" button

- [ ] **Step 1: Add step to store**

In `src/store/useMintStore.ts`, add `"cosmetics_select"` to MintStep between `"card_preview"` and `"confirming"`:

```typescript
export type MintStep =
  | "suit_search"
  | "grade_select"
  | "idle"
  | "uploading"
  | "analyzing"
  | "reviewing"
  | "card_preview"
  | "cosmetics_select"
  | "confirming"
  | "success";
```

- [ ] **Step 2: Update mint page**

In `src/app/mint/page.tsx`:

Add import:
```typescript
import { CosmeticsMenu } from "@/components/cosmetics/CosmeticsMenu";
import { useCosmeticsStore } from "@/store/useCosmeticsStore";
```

Add to STEP_LABELS:
```typescript
cosmetics_select: "Customize your card",
```

Update PROGRESS_STEPS:
```typescript
const PROGRESS_STEPS = ["suit_search", "grade_select", "idle", "reviewing", "card_preview", "cosmetics_select", "confirming", "success"] as const;
```

Update currentProgressIndex — cosmetics_select = 5, confirming = 6, success = 7.

Add conditional render in step content. The cosmetics step needs a wrapper component since we need to call `useCosmeticsStore.reset()` and `goTo`:

```tsx
{step === "cosmetics_select" && (
  <CosmeticsMenu
    onConfirm={() => goTo("confirming")}
    onSkip={() => goTo("confirming")}
    confirmLabel="CONFIRM & MINT →"
    skipLabel="← Back to preview"
  />
)}
```

- [ ] **Step 3: Update CardPreview**

In `src/components/mint/CardPreview.tsx`, add a second button for cosmetics:

Replace the single "CONFIRM & MINT" button with two options:
```tsx
<button
  onClick={() => goTo("cosmetics_select")}
  className="w-full py-3 bg-[var(--accent-2)] text-white font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
>
  ADD COSMETICS
</button>
<button
  onClick={() => goTo("confirming")}
  className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
>
  MINT AS-IS →
</button>
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/store/useMintStore.ts src/app/mint/page.tsx src/components/mint/CardPreview.tsx
git commit -m "feat: wire cosmetics menu into mint flow with ADD COSMETICS option"
```

---

## Task 7: Add "Customize" button to collection page

**Files:**
- Modify: `src/app/collection/page.tsx`

- [ ] **Step 1: Add customize modal/panel to collection cards**

Update the `CollectionCard` component to show a "Customize" button that expands a `CosmeticsMenu` panel below the card. For now, the menu is display-only (on-chain cosmetics come in Phase 3).

Add imports:
```typescript
import { CosmeticsMenu } from "@/components/cosmetics/CosmeticsMenu";
import { useCosmeticsStore } from "@/store/useCosmeticsStore";
```

Add a `showCustomize` state to `CollectionCard`. When clicked, show the CosmeticsMenu below the card. The "confirm" action is a no-op alert for now ("Coming soon — on-chain cosmetics in next update").

- [ ] **Step 2: Verify build and test**

```bash
npm run build
```

Walk through collection page, click Customize on a card, verify the menu appears with all 4 tabs.

- [ ] **Step 3: Commit**

```bash
git add src/app/collection/page.tsx
git commit -m "feat: add Customize button to collection cards with cosmetics menu"
```

---

## Verification Checklist

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] Mint flow: trait review → card preview → "ADD COSMETICS" → 4-tab menu → cost total → "MINT AS-IS" or confirm
- [ ] Mint flow: can skip cosmetics entirely via "MINT AS-IS"
- [ ] Frame tab: selecting a non-base frame shows $0.50 in cost
- [ ] Decal tab: selecting/deselecting works, $0.50 added/removed
- [ ] Color tab: hue slider works, tint presets work, $0.50 when changed
- [ ] Repaint tab: 12 styles in 3 categories, $2.00 when selected
- [ ] Cost summary: shows correct running total across all tabs
- [ ] Collection page: "Customize" button opens cosmetics menu per card
- [ ] Back navigation works at every step
