# Generative Kitbash Pivot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the photo-your-Gunpla mint flow with on-demand AI-generated kitbash Mobile Suits using Gemini, while preserving card frames, battle system, staking, and cosmetics.

**Architecture:** The mint page becomes a 5-step flow: idle → generating → reveal → confirming → success. When a user clicks "Mint", traits are randomly rolled from weighted tables, a prompt is assembled and sent to Gemini's image generation API (`gemini-2.5-flash-image`), the generated image is displayed inside the existing `CardFrame` component with derived battle stats, and the user approves USDC to mint on-chain. The existing `GunplaCard.sol` contract is unchanged — the `CardTraits` struct maps cleanly to generative output. Cosmetics (frames, color shifts, AI repaints) layer on top via the existing cosmetics system from `feature/card-frame-renderer`.

**Tech Stack:** Next.js 16, `@google/genai` (Gemini), Zustand, wagmi v3, Pinata SDK, existing Foundry contracts

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `src/lib/kitbash/traits.ts` | Trait tables with rarity weights, weighted random selection, `rollTraits()`, rarity derivation |
| `src/lib/kitbash/generate.ts` | Gemini prompt builder + image generation call |
| `src/app/api/generate-kitbash/route.ts` | POST API route: rolls traits → generates image → derives stats → returns everything |
| `src/components/mint/MintLanding.tsx` | "Mint Your Gunpla" landing with optional faction filter + mint button |
| `src/components/mint/GenerationReveal.tsx` | Animated card reveal after generation completes |

### Modified files

| File | Changes |
|---|---|
| `src/store/useMintStore.ts` | New state machine: `idle → generating → reveal → confirming → success`. New state fields for generated image blob, kitbash traits. Remove `selectedSuit`, `grade`, `imageFile` |
| `src/app/mint/page.tsx` | New step routing, new progress dots, new step labels |
| `src/types/nft.ts` | Add `KitbashTraits` interface (the rolled traits). Keep `TraitSet` compatible |
| `src/components/mint/TraitReview.tsx` | Adapt for generative traits — show rolled traits as read-only badges, allow name edit only |
| `src/components/mint/MintConfirm.tsx` | Accept generated image blob instead of user photo. Upload flow unchanged |
| `src/components/mint/MintSuccess.tsx` | Minor — works as-is, just verify |
| `src/app/api/mint-metadata/route.ts` | Accept image as base64 data URL or blob instead of only File upload |

### Merge from feature branch

| File | Source |
|---|---|
| `src/components/card/CardFrame.tsx` | `feature/card-frame-renderer` — CSS-based card renderer (no canvas) |
| `src/lib/card/frame-config.ts` | Rarity palettes + card dimensions |

### Files to remove/deprecate (not delete yet)

| File | Reason |
|---|---|
| `src/components/mint/SuitSearch.tsx` | No longer needed — no suit database lookup |
| `src/components/mint/GradePicker.tsx` | No longer needed — no grade selection |
| `src/components/mint/PhotoDropzone.tsx` | No longer needed — no photo upload |
| `src/lib/claude/analyzeGunpla.ts` | No longer needed for minting (keep for future RWA tier) |
| `src/app/api/analyze-gunpla/route.ts` | No longer needed for minting (keep for future RWA tier) |

---

## Rarity System

In the generative model, card rarity is derived from the rolled traits — not from kit grade.

Each trait value has a rarity tier based on its weight percentage:
- **COMMON** (>15% chance)
- **UNCOMMON** (10-15%)
- **RARE** (6-10%)
- **ULTRA RARE** (3-6%)
- **LEGENDARY** (≤3%)

Card-level rarity is determined by counting how many non-common traits were rolled:
- 0-1 non-common traits → **Common** card
- 2 non-common traits → **Uncommon** card
- 3 non-common traits → **Rare** card
- 4+ non-common traits → **Ultra Rare** card
- Any LEGENDARY trait → **Legendary** card

This creates natural scarcity: ~40% Common, ~30% Uncommon, ~18% Rare, ~9% Ultra Rare, ~3% Legendary.

---

## Tasks

### Task 1: Trait System Foundation

**Files:**
- Create: `src/lib/kitbash/traits.ts`
- Modify: `src/types/nft.ts`

- [ ] **Step 1: Add KitbashTraits type to nft.ts**

Add to the bottom of `src/types/nft.ts`:

```ts
/** Rolled traits for a generative kitbash mint */
export interface KitbashTraits {
  frameType: string;
  head: string;
  primaryWeapon: string;
  backpack: string;
  colorway: string;
  stance: string;
  background: string;
  special: string;
}

/** Rarity tier for individual traits */
export type TraitRarity = "Common" | "Uncommon" | "Rare" | "Ultra Rare" | "Legendary";
```

- [ ] **Step 2: Create the trait tables and roll function**

Create `src/lib/kitbash/traits.ts` with the full trait system. Port the tables and logic from `scripts/test-kitbash-gen.ts` (the working prototype), but export typed interfaces:

```ts
import type { KitbashTraits, Rarity, TraitRarity } from "@/types/nft";

interface WeightedTrait {
  name: string;
  weight: number;
}

// ─── Trait Tables ──────────────────────────────────────────────────

export const TRAIT_TABLES: Record<keyof KitbashTraits, WeightedTrait[]> = {
  frameType: [
    { name: "Standard", weight: 30 },
    { name: "Heavy Armor", weight: 15 },
    { name: "High Mobility", weight: 15 },
    { name: "Sniper", weight: 12 },
    { name: "Commander", weight: 10 },
    { name: "Berserker", weight: 8 },
    { name: "Stealth", weight: 6 },
    { name: "Full Armor", weight: 4 },
  ],
  head: [
    { name: "Classic V-Fin", weight: 25 },
    { name: "Mono-Eye", weight: 20 },
    { name: "Visor Type", weight: 15 },
    { name: "Twin Horn", weight: 12 },
    { name: "Antenna Array", weight: 10 },
    { name: "Crown Crest", weight: 8 },
    { name: "Blade Antenna", weight: 6 },
    { name: "Multi-Sensor", weight: 4 },
  ],
  primaryWeapon: [
    { name: "Beam Rifle", weight: 20 },
    { name: "Machine Gun", weight: 15 },
    { name: "Heat Hawk", weight: 12 },
    { name: "Beam Saber (dual)", weight: 12 },
    { name: "Bazooka", weight: 10 },
    { name: "Gatling Gun", weight: 8 },
    { name: "Beam Cannon", weight: 8 },
    { name: "Mega Launcher", weight: 5 },
    { name: "Twin Buster Rifle", weight: 4 },
    { name: "GN Sword", weight: 3 },
    { name: "Ship-Cutting Sword", weight: 3 },
  ],
  backpack: [
    { name: "Standard Thruster Pack", weight: 25 },
    { name: "Flight Unit", weight: 20 },
    { name: "Heavy Arms Rack", weight: 12 },
    { name: "Funnel System", weight: 8 },
    { name: "DRAGOON System", weight: 6 },
    { name: "Booster Pod", weight: 15 },
    { name: "Wing Binders", weight: 10 },
    { name: "Psychoframe Emitter", weight: 4 },
  ],
  colorway: [
    { name: "Federation White & Blue", weight: 15 },
    { name: "Zeon Army Green", weight: 12 },
    { name: "Char Red", weight: 10 },
    { name: "Titans Navy Blue", weight: 10 },
    { name: "AEUG Dark Blue & Red", weight: 8 },
    { name: "Neo Zeon Crimson", weight: 8 },
    { name: "Celestial Being Gunmetal & White", weight: 8 },
    { name: "OZ Royal Purple", weight: 6 },
    { name: "Desert Tan & Brown", weight: 5 },
    { name: "Arctic White & Silver", weight: 5 },
    { name: "Shadow Black & Gold", weight: 4 },
    { name: "Psychoframe Aurora (iridescent)", weight: 3 },
    { name: "Chrome Silver", weight: 3 },
    { name: "Phantom Midnight Blue", weight: 3 },
  ],
  stance: [
    { name: "Standing at attention, weapon held", weight: 20 },
    { name: "Combat ready, weapon aimed", weight: 20 },
    { name: "Dynamic action pose mid-attack", weight: 15 },
    { name: "Kneeling with rifle braced", weight: 12 },
    { name: "Aerial hover with thrusters firing", weight: 10 },
    { name: "Dramatic sword draw", weight: 8 },
    { name: "Walking forward menacingly", weight: 10 },
    { name: "Dual-wielding combat stance", weight: 5 },
  ],
  background: [
    { name: "Military hangar with dramatic lighting", weight: 18 },
    { name: "Deep space with stars and debris", weight: 15 },
    { name: "Space colony interior", weight: 12 },
    { name: "Desert battlefield", weight: 10 },
    { name: "Urban ruins", weight: 10 },
    { name: "Ocean platform at sunset", weight: 8 },
    { name: "Asteroid field", weight: 8 },
    { name: "Lunar surface", weight: 7 },
    { name: "Forest with mech tracks", weight: 6 },
    { name: "Volcanic terrain with lava", weight: 4 },
    { name: "Orbital elevator", weight: 2 },
  ],
  special: [
    { name: "None", weight: 50 },
    { name: "Battle damage (scratches, dents, scorch marks)", weight: 15 },
    { name: "Gold trim accents", weight: 8 },
    { name: "Psychoframe glow (pink/green energy lines)", weight: 6 },
    { name: "Trans-Am burst (red energy aura)", weight: 5 },
    { name: "Weathered veteran (rust, paint chips, mud)", weight: 8 },
    { name: "Full armor bolt-on plates", weight: 5 },
    { name: "Holographic camo pattern", weight: 3 },
  ],
};

// ─── Selection Logic ───────────────────────────────────────────────

function weightedRandom(items: WeightedTrait[]): string {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.name;
  }
  return items[items.length - 1].name;
}

export function rollTraits(factionHint?: string): KitbashTraits {
  const traits: KitbashTraits = {
    frameType: weightedRandom(TRAIT_TABLES.frameType),
    head: weightedRandom(TRAIT_TABLES.head),
    primaryWeapon: weightedRandom(TRAIT_TABLES.primaryWeapon),
    backpack: weightedRandom(TRAIT_TABLES.backpack),
    colorway: factionHint
      ? factionColorway(factionHint)
      : weightedRandom(TRAIT_TABLES.colorway),
    stance: weightedRandom(TRAIT_TABLES.stance),
    background: weightedRandom(TRAIT_TABLES.background),
    special: weightedRandom(TRAIT_TABLES.special),
  };
  return traits;
}

// ─── Rarity Derivation ────────────────────────────────────────────

export function getTraitRarity(
  traitKey: keyof KitbashTraits,
  traitValue: string
): TraitRarity {
  const table = TRAIT_TABLES[traitKey];
  const item = table.find((t) => t.name === traitValue);
  if (!item) return "Common";
  const total = table.reduce((sum, t) => sum + t.weight, 0);
  const pct = (item.weight / total) * 100;
  if (pct <= 3) return "Legendary";
  if (pct <= 6) return "Ultra Rare";
  if (pct <= 10) return "Rare";
  if (pct <= 15) return "Uncommon";
  return "Common";
}

export function deriveCardRarity(traits: KitbashTraits): Rarity {
  const keys = Object.keys(traits) as (keyof KitbashTraits)[];
  let hasLegendary = false;
  let nonCommonCount = 0;

  for (const key of keys) {
    const rarity = getTraitRarity(key, traits[key]);
    if (rarity === "Legendary") hasLegendary = true;
    if (rarity !== "Common") nonCommonCount++;
  }

  if (hasLegendary) return "Legendary";
  if (nonCommonCount >= 4) return "Ultra Rare";
  if (nonCommonCount >= 3) return "Rare";
  if (nonCommonCount >= 2) return "Uncommon";
  return "Common";
}

// ─── Faction Colorway Bias ─────────────────────────────────────────

const FACTION_COLORWAYS: Record<string, string[]> = {
  EFSF: ["Federation White & Blue"],
  ZEON: ["Zeon Army Green", "Char Red", "Neo Zeon Crimson"],
  ZAFT: ["Zeon Army Green", "Celestial Being Gunmetal & White"],
  ALLIANCE: ["Federation White & Blue", "Titans Navy Blue"],
  OZ: ["OZ Royal Purple", "Titans Navy Blue"],
  GUNDAM_WING_TEAM: ["Federation White & Blue", "Shadow Black & Gold"],
  CELESTIAL_BEING: ["Celestial Being Gunmetal & White"],
  HUMAN_REFORM_LEAGUE: ["Desert Tan & Brown", "Titans Navy Blue"],
  INNOVATION: ["Psychoframe Aurora (iridescent)", "OZ Royal Purple"],
};

function factionColorway(faction: string): string {
  const options = FACTION_COLORWAYS[faction];
  if (options && options.length > 0) {
    return options[Math.floor(Math.random() * options.length)];
  }
  return weightedRandom(TRAIT_TABLES.colorway);
}

// ─── Stats Derivation ──────────────────────────────────────────────

const HP_RANGES: Record<Rarity, [number, number]> = {
  Common: [150, 349],
  Uncommon: [350, 599],
  Rare: [600, 899],
  "Ultra Rare": [900, 1199],
  Legendary: [1200, 2000],
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function deriveStats(rarity: Rarity) {
  const [hpMin, hpMax] = HP_RANGES[rarity];
  const hp = randInt(hpMin, hpMax);
  return {
    hp,
    primaryDamage: randInt(Math.floor(hp * 0.15), Math.floor(hp * 0.25)),
    secondaryDamage: randInt(Math.floor(hp * 0.25), Math.floor(hp * 0.40)),
    tertiaryDamage: randInt(Math.floor(hp * 0.08), Math.floor(hp * 0.15)),
    specialDamage: randInt(Math.floor(hp * 0.50), Math.floor(hp * 0.80)),
  };
}

// ─── Name Generation ───────────────────────────────────────────────

export function generateSuitName(traits: KitbashTraits): string {
  const prefixes: Record<string, string[]> = {
    Standard: ["GN", "RX", "MSN", "GAT"],
    "Heavy Armor": ["FA", "RX-FA", "XXXG"],
    "High Mobility": ["MS", "RGZ", "GNY"],
    Sniper: ["RGM", "MSZ", "GN"],
    Commander: ["MSN", "RX", "CB"],
    Berserker: ["MRX", "NZ", "OZ"],
    Stealth: ["RGM-S", "GN-X", "ASW"],
    "Full Armor": ["FA", "FAZZ", "PF"],
  };
  const prefix =
    prefixes[traits.frameType]?.[
      Math.floor(Math.random() * (prefixes[traits.frameType]?.length ?? 1))
    ] ?? "MS";
  const num = randInt(10, 999);
  const suffix = traits.head === "Mono-Eye" ? "" : " Gundam";
  return `${prefix}-${num}${suffix}`;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/kitbash/traits.ts src/types/nft.ts
git commit -m "feat: add kitbash trait tables, weighted random roll, and rarity derivation"
```

---

### Task 2: Gemini Image Generation Module

**Files:**
- Create: `src/lib/kitbash/generate.ts`
- Create: `src/app/api/generate-kitbash/route.ts`

**Docs to check:** `@google/genai` SDK — the model name is `gemini-2.5-flash-image` and it uses `generateContent` with `responseModalities: ["TEXT", "IMAGE"]`. This was validated in the prototype at `scripts/test-kitbash-gen.ts`.

- [ ] **Step 1: Create the generation module**

Create `src/lib/kitbash/generate.ts`:

```ts
import { GoogleGenAI } from "@google/genai";
import type { KitbashTraits } from "@/types/nft";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

function buildPrompt(traits: KitbashTraits): string {
  const specialDesc =
    traits.special !== "None"
      ? `\nSpecial feature: ${traits.special}`
      : "";

  return `Generate a high-quality 3D-rendered image of a unique kitbashed Mobile Suit (mecha/Gundam-style robot) for an NFT collection called "GundariuM".

CRITICAL STYLE REQUIREMENTS:
- Clean, professional 3D render quality (like a high-end model kit product photo)
- Dramatic studio lighting with subtle rim light
- The mech should fill most of the frame
- Sharp details, metallic materials, panel lines visible
- NOT anime/cartoon style — this should look like a rendered 3D model or high-quality Gunpla photograph
- Consistent collection aesthetic — every card should feel like it belongs in the same set

MOBILE SUIT SPECIFICATIONS:
Frame type: ${traits.frameType}
Head design: ${traits.head}
Primary weapon: ${traits.primaryWeapon}
Backpack/thruster system: ${traits.backpack}
Color scheme: ${traits.colorway}
Pose: ${traits.stance}
Background: ${traits.background}${specialDesc}

IMPORTANT:
- This is a KITBASH — parts from different mecha designs combined into something new and unique
- The design should feel cohesive despite mixing parts from different sources
- No text, watermarks, or UI elements in the image
- Square aspect ratio (1:1)
- The mech should be the clear focal point`;
}

export interface GenerationResult {
  imageBase64: string;
  mimeType: string;
}

export async function generateKitbashImage(
  traits: KitbashTraits
): Promise<GenerationResult> {
  const prompt = buildPrompt(traits);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["TEXT", "IMAGE"] as unknown as undefined,
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error("No response from Gemini image generation");
  }

  for (const part of parts) {
    const inline = (part as Record<string, unknown>).inlineData as
      | { mimeType: string; data: string }
      | undefined;
    if (inline?.data) {
      return {
        imageBase64: inline.data,
        mimeType: inline.mimeType ?? "image/png",
      };
    }
  }

  throw new Error("No image returned from Gemini");
}
```

- [ ] **Step 2: Create the API route**

Create `src/app/api/generate-kitbash/route.ts`:

```ts
import { NextResponse } from "next/server";
import type { KitbashTraits, TraitSet } from "@/types/nft";
import {
  rollTraits,
  deriveCardRarity,
  deriveStats,
  generateSuitName,
  getTraitRarity,
} from "@/lib/kitbash/traits";
import { generateKitbashImage } from "@/lib/kitbash/generate";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const factionHint = body.faction as string | undefined;

    // Roll traits
    const kitbashTraits = rollTraits(factionHint);

    // Derive rarity from trait weights
    const rarity = deriveCardRarity(kitbashTraits);

    // Derive battle stats from rarity
    const stats = deriveStats(rarity);

    // Generate suit name
    const name = generateSuitName(kitbashTraits);

    // Determine faction and armor type from traits
    const faction = deriveFaction(kitbashTraits.colorway);
    const armorType = deriveArmorType(kitbashTraits);

    // Generate the image
    const { imageBase64, mimeType } =
      await generateKitbashImage(kitbashTraits);

    // Build the full TraitSet (compatible with existing contract)
    const traits: TraitSet = {
      name,
      series: "GundariuM Genesis",
      faction,
      rarity,
      ...stats,
      pilotName: "Autonomous AI",
      armorType,
      primaryWeapon: kitbashTraits.primaryWeapon,
      secondaryWeapon: deriveSecondaryWeapon(kitbashTraits),
      secondaryDamage: stats.secondaryDamage,
      tertiaryWeapon: deriveTertiaryWeapon(kitbashTraits),
      tertiaryDamage: stats.tertiaryDamage,
      specialAttack: deriveSpecialAttack(kitbashTraits),
      specialDamage: stats.specialDamage,
    };

    // Build per-trait rarity breakdown for the UI
    const traitRarities = Object.fromEntries(
      (Object.keys(kitbashTraits) as (keyof KitbashTraits)[]).map((key) => [
        key,
        getTraitRarity(key, kitbashTraits[key]),
      ])
    );

    return NextResponse.json({
      traits,
      kitbashTraits,
      traitRarities,
      imageBase64,
      imageMimeType: mimeType,
    });
  } catch (error) {
    console.error("Kitbash generation failed:", error);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}

// ─── Derivation Helpers ────────────────────────────────────────────

function deriveFaction(colorway: string): string {
  const map: Record<string, string> = {
    "Federation White & Blue": "EFSF",
    "Zeon Army Green": "ZEON",
    "Char Red": "ZEON",
    "Titans Navy Blue": "ALLIANCE",
    "AEUG Dark Blue & Red": "EFSF",
    "Neo Zeon Crimson": "ZEON",
    "Celestial Being Gunmetal & White": "CELESTIAL_BEING",
    "OZ Royal Purple": "OZ",
    "Desert Tan & Brown": "HUMAN_REFORM_LEAGUE",
    "Arctic White & Silver": "EFSF",
    "Shadow Black & Gold": "GUNDAM_WING_TEAM",
    "Psychoframe Aurora (iridescent)": "INNOVATION",
    "Chrome Silver": "UNKNOWN",
    "Phantom Midnight Blue": "UNKNOWN",
  };
  return map[colorway] ?? "UNKNOWN";
}

function deriveArmorType(
  traits: KitbashTraits
): TraitSet["armorType"] {
  if (traits.special.includes("Psychoframe")) return "GN Particle";
  if (traits.special.includes("Trans-Am")) return "GN Particle";
  if (traits.special.includes("Phase")) return "Phase Shift";
  if (traits.frameType === "Full Armor") return "Gundanium";
  if (traits.frameType === "Heavy Armor") return "Luna Titanium";
  if (traits.frameType === "Stealth") return "I-Field";
  if (traits.head === "Mono-Eye") return "Standard";
  return "Standard";
}

function deriveSecondaryWeapon(traits: KitbashTraits): string {
  const map: Record<string, string> = {
    "Beam Rifle": "Beam Saber",
    "Machine Gun": "Heat Hawk",
    "Heat Hawk": "Machine Gun",
    "Beam Saber (dual)": "Vulcan Pod",
    Bazooka: "Machine Gun",
    "Gatling Gun": "Missile Pod",
    "Beam Cannon": "Beam Saber",
    "Mega Launcher": "Beam Saber",
    "Twin Buster Rifle": "Beam Saber",
    "GN Sword": "GN Beam Pistol",
    "Ship-Cutting Sword": "Vulcan Pod",
  };
  return map[traits.primaryWeapon] ?? "Beam Saber";
}

function deriveTertiaryWeapon(traits: KitbashTraits): string {
  const map: Record<string, string> = {
    "Standard Thruster Pack": "Head Vulcan",
    "Flight Unit": "Wing Beam Cannon",
    "Heavy Arms Rack": "Micro-Missile Barrage",
    "Funnel System": "Funnel Beam",
    "DRAGOON System": "DRAGOON Volley",
    "Booster Pod": "Chest Vulcan",
    "Wing Binders": "Binder Beam Gun",
    "Psychoframe Emitter": "Psycho Wave",
  };
  return map[traits.backpack] ?? "Head Vulcan";
}

function deriveSpecialAttack(traits: KitbashTraits): string {
  if (traits.special === "Trans-Am burst (red energy aura)")
    return "Trans-Am Overdrive";
  if (traits.special === "Psychoframe glow (pink/green energy lines)")
    return "Psychoframe Resonance";
  if (traits.special === "Full armor bolt-on plates")
    return "Full Armor Purge Assault";
  if (traits.special === "Holographic camo pattern")
    return "Mirage Colloid Strike";

  const map: Record<string, string> = {
    "Funnel System": "All-Range Attack",
    "DRAGOON System": "Full Burst Mode",
    "Psychoframe Emitter": "Newtype Flash",
    "Heavy Arms Rack": "Full Payload Barrage",
  };
  return map[traits.backpack] ?? "Limit Break";
}
```

- [ ] **Step 3: Verify the API route works locally**

Run: `curl -s -X POST http://localhost:3000/api/generate-kitbash -H "Content-Type: application/json" -d '{}' | jq '.traits.name, .traits.rarity, .kitbashTraits.frameType'`

Expected: A suit name, rarity string, and frame type. Should complete in ~10-15s.

- [ ] **Step 4: Commit**

```bash
git add src/lib/kitbash/generate.ts src/app/api/generate-kitbash/route.ts
git commit -m "feat: add Gemini kitbash image generation API route"
```

---

### Task 3: Merge CardFrame from Feature Branch

**Files:**
- Cherry-pick: `src/components/card/CardFrame.tsx`, `src/lib/card/frame-config.ts`

The `CardFrame` component from `feature/card-frame-renderer` is the CSS-based card renderer that displays the suit image inside a HUD-style frame with rarity colors, stats, and weapon readouts. It works entirely in the browser — no `@napi-rs/canvas`.

- [ ] **Step 1: Cherry-pick the card rendering files**

```bash
git checkout feature/card-frame-renderer -- src/components/card/CardFrame.tsx src/lib/card/frame-config.ts
```

- [ ] **Step 2: Verify no missing imports**

Check that `CardFrame.tsx` imports only from paths that exist on main:
- `@/types/nft` (TraitSet, Rarity) — exists
- `@/lib/card/frame-config` — just cherry-picked
- `@/lib/utils` (cn helper) — exists

If it imports from `@/lib/card/cosmetics-data` or `@/lib/card/draw-frame`, remove those imports — we don't need the server-side canvas renderer or cosmetics data yet.

- [ ] **Step 3: Commit**

```bash
git add src/components/card/CardFrame.tsx src/lib/card/frame-config.ts
git commit -m "feat: bring CardFrame component from feature branch (CSS-based card renderer)"
```

---

### Task 4: Rewrite Mint Store

**Files:**
- Modify: `src/store/useMintStore.ts`

- [ ] **Step 1: Rewrite the store**

Replace the contents of `src/store/useMintStore.ts` with the new generative state machine:

```ts
import { create } from "zustand";
import type { TraitSet, KitbashTraits, TraitRarity } from "@/types/nft";

export type MintStep =
  | "idle"
  | "generating"
  | "reveal"
  | "confirming"
  | "success";

interface MintState {
  step: MintStep;
  faction: string | null;
  kitbashTraits: KitbashTraits | null;
  traitRarities: Record<string, TraitRarity> | null;
  traits: TraitSet | null;
  generatedImageBase64: string | null;
  generatedImageMimeType: string | null;
  imageIpfsHash: string | null;
  metadataUri: string | null;
  mintedTokenId: bigint | null;
  error: string | null;

  // Actions
  setFaction: (faction: string | null) => void;
  setGenerationResult: (result: {
    traits: TraitSet;
    kitbashTraits: KitbashTraits;
    traitRarities: Record<string, TraitRarity>;
    imageBase64: string;
    imageMimeType: string;
  }) => void;
  setTraits: (traits: TraitSet) => void;
  setImageIpfsHash: (hash: string) => void;
  setMetadataUri: (uri: string) => void;
  setMintedTokenId: (id: bigint) => void;
  setError: (error: string | null) => void;
  goTo: (step: MintStep) => void;
  reset: () => void;
}

const initialState = {
  step: "idle" as MintStep,
  faction: null,
  kitbashTraits: null,
  traitRarities: null,
  traits: null,
  generatedImageBase64: null,
  generatedImageMimeType: null,
  imageIpfsHash: null,
  metadataUri: null,
  mintedTokenId: null,
  error: null,
};

export const useMintStore = create<MintState>((set) => ({
  ...initialState,
  setFaction: (faction) => set({ faction }),
  setGenerationResult: (result) =>
    set({
      traits: result.traits,
      kitbashTraits: result.kitbashTraits,
      traitRarities: result.traitRarities,
      generatedImageBase64: result.imageBase64,
      generatedImageMimeType: result.imageMimeType,
      step: "reveal",
      error: null,
    }),
  setTraits: (traits) => set({ traits }),
  setImageIpfsHash: (hash) => set({ imageIpfsHash: hash }),
  setMetadataUri: (uri) => set({ metadataUri: uri }),
  setMintedTokenId: (id) => set({ mintedTokenId: id }),
  setError: (error) => set({ error }),
  goTo: (step) => set({ step, error: null }),
  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/useMintStore.ts
git commit -m "feat: rewrite mint store for generative kitbash flow (5-step state machine)"
```

---

### Task 5: MintLanding Component

**Files:**
- Create: `src/components/mint/MintLanding.tsx`

This replaces SuitSearch + GradePicker + PhotoDropzone with a single "Mint Your Gunpla" screen.

- [ ] **Step 1: Create MintLanding**

Create `src/components/mint/MintLanding.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMintStore } from "@/store/useMintStore";
import { FACTIONS, FACTION_KEYS } from "@/lib/constants/factions";
import type { FactionKey } from "@/lib/constants/factions";

export function MintLanding() {
  const { setFaction, setGenerationResult, goTo, setError } = useMintStore();
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleMint() {
    setGenerating(true);
    setFaction(selectedFaction);
    goTo("generating");

    try {
      const res = await fetch("/api/generate-kitbash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faction: selectedFaction,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }

      const data = await res.json();
      setGenerationResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      goTo("idle");
    } finally {
      setGenerating(false);
    }
  }

  const factionKeys = FACTION_KEYS.filter((k) => k !== "UNKNOWN");

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Faction selector (optional) */}
      <div className="w-full max-w-xl">
        <h3 className="text-sm font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/60 mb-3 text-center">
          CHOOSE FACTION (OPTIONAL)
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedFaction(null)}
            className={`px-3 py-2 rounded-lg text-xs font-[family-name:var(--font-orbitron)] border transition-all ${
              selectedFaction === null
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--foreground)]/40 hover:border-[var(--foreground)]/20"
            }`}
          >
            RANDOM
          </button>
          {factionKeys.map((key) => {
            const f = FACTIONS[key as FactionKey];
            return (
              <button
                key={key}
                onClick={() => setSelectedFaction(key)}
                className={`px-3 py-2 rounded-lg text-xs font-[family-name:var(--font-orbitron)] border transition-all ${
                  selectedFaction === key
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--foreground)]/40 hover:border-[var(--foreground)]/20"
                }`}
                title={f.description}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: f.color }}
                />
                {f.name.length > 20 ? key : f.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mint button */}
      <button
        onClick={handleMint}
        disabled={generating}
        className="px-8 py-4 bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] font-bold text-lg rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? "GENERATING..." : "MINT YOUR GUNPLA"}
      </button>

      <p className="text-xs text-[var(--foreground)]/40 text-center max-w-sm">
        A unique AI-generated kitbash Mobile Suit will be created just for you.
        Traits are randomly rolled with weighted rarity.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/mint/MintLanding.tsx
git commit -m "feat: add MintLanding component with faction selector and generate button"
```

---

### Task 6: GenerationReveal Component

**Files:**
- Create: `src/components/mint/GenerationReveal.tsx`

The "reveal" moment — shows the generated card with traits, rarity badges, and a "Mint This Card" button.

- [ ] **Step 1: Create GenerationReveal**

Create `src/components/mint/GenerationReveal.tsx`:

```tsx
"use client";

import { useMintStore } from "@/store/useMintStore";
import { CardFrame } from "@/components/card/CardFrame";
import type { KitbashTraits, TraitRarity } from "@/types/nft";

const RARITY_COLORS: Record<TraitRarity, string> = {
  Common: "text-gray-400",
  Uncommon: "text-green-400",
  Rare: "text-blue-400",
  "Ultra Rare": "text-yellow-400",
  Legendary: "text-purple-400",
};

const RARITY_BORDER: Record<TraitRarity, string> = {
  Common: "border-gray-600",
  Uncommon: "border-green-600",
  Rare: "border-blue-600",
  "Ultra Rare": "border-yellow-600",
  Legendary: "border-purple-600",
};

const TRAIT_LABELS: Record<keyof KitbashTraits, string> = {
  frameType: "FRAME",
  head: "HEAD",
  primaryWeapon: "WEAPON",
  backpack: "BACKPACK",
  colorway: "COLORWAY",
  stance: "STANCE",
  background: "BACKGROUND",
  special: "SPECIAL",
};

export function GenerationReveal() {
  const {
    traits,
    kitbashTraits,
    traitRarities,
    generatedImageBase64,
    generatedImageMimeType,
    goTo,
    reset,
  } = useMintStore();

  if (!traits || !kitbashTraits || !traitRarities || !generatedImageBase64) {
    return null;
  }

  const imageUrl = `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`;
  const traitKeys = Object.keys(kitbashTraits) as (keyof KitbashTraits)[];

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Card preview */}
      <div className="flex-shrink-0">
        <CardFrame imageUrl={imageUrl} traits={traits} />
      </div>

      {/* Trait breakdown */}
      <div className="flex-1 space-y-4">
        <h3 className="text-lg font-[family-name:var(--font-orbitron)] text-[var(--accent)]">
          {traits.name}
        </h3>
        <p className="text-sm text-[var(--foreground)]/60">
          {traits.series} — {traits.faction}
        </p>

        {/* Trait badges */}
        <div className="grid grid-cols-2 gap-2">
          {traitKeys
            .filter((k) => kitbashTraits[k] !== "None")
            .map((key) => {
              const rarity = traitRarities[key] as TraitRarity;
              return (
                <div
                  key={key}
                  className={`px-3 py-2 rounded-lg border ${RARITY_BORDER[rarity]} bg-[var(--surface)]`}
                >
                  <div className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">
                    {TRAIT_LABELS[key]}
                  </div>
                  <div className="text-sm text-[var(--foreground)]">
                    {kitbashTraits[key]}
                  </div>
                  <div
                    className={`text-[10px] font-[family-name:var(--font-orbitron)] ${RARITY_COLORS[rarity]}`}
                  >
                    {rarity.toUpperCase()}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Battle stats */}
        <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40 mb-2">
            BATTLE STATS
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-[var(--foreground)]/60">HP</span>
            <span className="text-right">{traits.hp}</span>
            <span className="text-[var(--foreground)]/60">
              {traits.primaryWeapon}
            </span>
            <span className="text-right">{traits.primaryDamage}</span>
            <span className="text-[var(--foreground)]/60">
              {traits.secondaryWeapon}
            </span>
            <span className="text-right">{traits.secondaryDamage}</span>
            <span className="text-[var(--foreground)]/60">
              {traits.tertiaryWeapon}
            </span>
            <span className="text-right">{traits.tertiaryDamage}</span>
            <span className="text-[var(--foreground)]/60">
              {traits.specialAttack}
            </span>
            <span className="text-right font-bold text-[var(--accent)]">
              {traits.specialDamage}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => goTo("confirming")}
            className="flex-1 px-6 py-3 bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] font-bold rounded-xl hover:brightness-110 transition-all"
          >
            MINT THIS CARD
          </button>
          <button
            onClick={reset}
            className="px-6 py-3 border border-[var(--border)] text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)] text-sm rounded-xl hover:border-[var(--foreground)]/20 transition-all"
          >
            REROLL
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/mint/GenerationReveal.tsx
git commit -m "feat: add GenerationReveal component with trait badges and card preview"
```

---

### Task 7: Update MintConfirm for Generative Flow

**Files:**
- Modify: `src/components/mint/MintConfirm.tsx`
- Modify: `src/app/api/mint-metadata/route.ts`

The existing `MintConfirm` uploads a `File` to the mint-metadata route. Now the image is a base64 string from Gemini, not a user-uploaded file. We need to adapt both the component and the API route.

- [ ] **Step 1: Read the current mint-metadata route**

Read `src/app/api/mint-metadata/route.ts` to understand the current upload shape.

- [ ] **Step 2: Update mint-metadata route to accept base64 image**

Add a second code path: if the request body contains `imageBase64` + `imageMimeType` instead of an `image` File, convert the base64 to a `File` object and proceed with the existing Pinata upload logic.

In the `POST` handler, before the existing `formData.get("image")` logic, add:

```ts
const contentType = req.headers.get("content-type") ?? "";

if (contentType.includes("application/json")) {
  // Generative flow: image is base64
  const body = await req.json();
  const { imageBase64, imageMimeType, traits } = body;

  if (!imageBase64 || !traits) {
    return NextResponse.json({ error: "Missing imageBase64 or traits" }, { status: 400 });
  }

  const buffer = Buffer.from(imageBase64, "base64");
  const ext = imageMimeType === "image/png" ? "png" : "jpg";
  const imageFile = new File([buffer], `kitbash.${ext}`, { type: imageMimeType ?? "image/png" });

  const imageHash = await uploadImage(imageFile);
  const metadataUri = await uploadMetadata(traits, imageHash);

  return NextResponse.json({ imageHash, metadataUri });
}

// Existing formData flow continues below...
```

- [ ] **Step 3: Update MintConfirm component**

In `MintConfirm.tsx`, modify the `uploadToIPFS` function to send JSON with `imageBase64` instead of `FormData` with a File. Replace the existing `uploadToIPFS`:

```ts
async function uploadToIPFS() {
  try {
    const res = await fetch("/api/mint-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: generatedImageBase64,
        imageMimeType: generatedImageMimeType,
        traits,
      }),
    });

    if (!res.ok) throw new Error("IPFS upload failed");

    const data = await res.json();
    setImageIpfsHash(data.imageHash);
    setMetadataUri(data.metadataUri);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Upload failed");
  }
}
```

Also update the store destructuring at the top to pull `generatedImageBase64` and `generatedImageMimeType` from `useMintStore`.

- [ ] **Step 4: Commit**

```bash
git add src/components/mint/MintConfirm.tsx src/app/api/mint-metadata/route.ts
git commit -m "feat: update mint-metadata route and MintConfirm for base64 image upload"
```

---

### Task 8: Rewrite Mint Page

**Files:**
- Modify: `src/app/mint/page.tsx`

- [ ] **Step 1: Rewrite the page with new step routing**

Replace the step routing logic in `src/app/mint/page.tsx`:

```tsx
import { MintLanding } from "@/components/mint/MintLanding";
import { GenerationReveal } from "@/components/mint/GenerationReveal";
import { MintConfirm } from "@/components/mint/MintConfirm";
import { MintSuccess } from "@/components/mint/MintSuccess";
```

New `STEP_LABELS`:
```ts
const STEP_LABELS: Record<string, string> = {
  idle: "Mint a unique kitbash Mobile Suit",
  generating: "AI is building your Mobile Suit...",
  reveal: "Your Gunpla has been forged",
  confirming: "Approve & mint on-chain",
  success: "Your card is live!",
};
```

New `PROGRESS_STEPS`:
```ts
const PROGRESS_STEPS = ["idle", "generating", "reveal", "confirming", "success"] as const;
```

Progress index mapping:
```ts
function getProgressIndex(step: string): number {
  const idx = PROGRESS_STEPS.indexOf(step as typeof PROGRESS_STEPS[number]);
  return idx >= 0 ? idx : 0;
}
```

Step-to-component routing:
```tsx
{step === "idle" && <MintLanding />}
{step === "generating" && (
  <div className="flex flex-col items-center gap-4 py-12">
    {/* Spinner animation */}
    <div className="w-16 h-16 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
    <p className="text-sm text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)]">
      FORGING YOUR MOBILE SUIT...
    </p>
  </div>
)}
{step === "reveal" && <GenerationReveal />}
{step === "confirming" && <MintConfirm />}
{step === "success" && <MintSuccess />}
```

Remove imports for `SuitSearch`, `GradePicker`, `PhotoDropzone`, `TraitReview`.

- [ ] **Step 2: Verify the page renders**

Start dev server (`npm run dev`) and navigate to `/mint`. With `NEXT_PUBLIC_MINT_ENABLED=true`, the page should show the MintLanding component with faction buttons and the "MINT YOUR GUNPLA" button.

- [ ] **Step 3: Commit**

```bash
git add src/app/mint/page.tsx
git commit -m "feat: rewrite mint page for generative kitbash flow"
```

---

### Task 9: Update MintSuccess for Generative Cards

**Files:**
- Modify: `src/components/mint/MintSuccess.tsx`

- [ ] **Step 1: Update image source**

The current `MintSuccess` renders `imagePreviewUrl` from the store. This field no longer exists. Update it to construct the image URL from `generatedImageBase64` and `generatedImageMimeType`:

```ts
const { traits, mintedTokenId, generatedImageBase64, generatedImageMimeType, reset } = useMintStore();

const imageUrl = generatedImageBase64
  ? `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`
  : "";
```

Replace references to `imagePreviewUrl` with `imageUrl`.

- [ ] **Step 2: Commit**

```bash
git add src/components/mint/MintSuccess.tsx
git commit -m "feat: update MintSuccess to use generated image from store"
```

---

### Task 10: Cleanup Old Mint Components

**Files:**
- Deprecate: `src/components/mint/SuitSearch.tsx`
- Deprecate: `src/components/mint/GradePicker.tsx`
- Deprecate: `src/components/mint/PhotoDropzone.tsx`
- Deprecate: `src/components/mint/TraitReview.tsx`

- [ ] **Step 1: Remove old imports from the codebase**

Search for any remaining imports of `SuitSearch`, `GradePicker`, `PhotoDropzone`, or `TraitReview` outside of `mint/page.tsx` (which was already updated in Task 8). Fix any found.

- [ ] **Step 2: Move deprecated components**

Don't delete — move to a `src/components/mint/_deprecated/` folder so they're available when the RWA tier is built:

```bash
mkdir -p src/components/mint/_deprecated
git mv src/components/mint/SuitSearch.tsx src/components/mint/_deprecated/
git mv src/components/mint/GradePicker.tsx src/components/mint/_deprecated/
git mv src/components/mint/PhotoDropzone.tsx src/components/mint/_deprecated/
git mv src/components/mint/TraitReview.tsx src/components/mint/_deprecated/
```

- [ ] **Step 3: Commit**

```bash
git add -A src/components/mint/
git commit -m "refactor: move photo-mint components to _deprecated (preserved for future RWA tier)"
```

---

### Task 11: End-to-End Smoke Test

**Files:** None (testing only)

- [ ] **Step 1: Start dev server and test the full flow**

```bash
npm run dev
```

Open `http://localhost:3000/mint` and walk through the entire flow:

1. Verify MintLanding renders with 9 faction buttons + RANDOM
2. Click a faction → click "MINT YOUR GUNPLA"
3. Verify generating spinner shows
4. Wait ~10-15s for Gemini generation
5. Verify GenerationReveal shows with card image, trait badges with rarity colors, battle stats
6. Click "MINT THIS CARD" → verify MintConfirm renders and begins IPFS upload
7. (Skip on-chain mint unless on testnet with USDC)
8. Click "REROLL" from reveal → verify it resets to idle

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: lint and smoke test fixes for generative mint flow"
```

---

### Task 12: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the mint flow section**

Replace the "Mint flow (state machine)" section in CLAUDE.md with:

```markdown
## Mint flow (state machine)

The mint page is a 5-step Zustand state machine in `useMintStore.ts`:

\`\`\`
idle → generating → reveal → confirming → success
\`\`\`

| Step | Component | What happens |
|---|---|---|
| `idle` | `MintLanding` | User optionally selects a faction, clicks "MINT YOUR GUNPLA" |
| `generating` | spinner | Traits are randomly rolled, `POST /api/generate-kitbash` calls Gemini to create unique kitbash image |
| `reveal` | `GenerationReveal` | User sees their generated card with trait badges, rarity breakdown, and battle stats |
| `confirming` | `MintConfirm` | Image + metadata uploaded to Pinata IPFS, user approves USDC + mints on-chain |
| `success` | `MintSuccess` | Shows minted NFT with animated reveal |
```

- [ ] **Step 2: Update the AI analysis pipeline section**

Replace with:

```markdown
## AI generation pipeline

**File:** `src/lib/kitbash/generate.ts`

- Model: Gemini `gemini-2.5-flash-image` with `responseModalities: ["TEXT", "IMAGE"]`
- Input: assembled prompt from rolled `KitbashTraits` (frame type, head, weapon, backpack, colorway, stance, background, special)
- Output: base64-encoded PNG image of a unique kitbashed Mobile Suit
- Generation time: ~8-15 seconds

**Trait system:** `src/lib/kitbash/traits.ts`

- 8 trait categories with weighted rarity tables (~69M+ unique combinations)
- Card rarity derived from number of non-common traits rolled
- Battle stats (HP, damage values) derived from card rarity using the same HP ranges as before
- Optional faction hint biases the colorway selection toward that faction's palette

**When updating the generation prompt:**
- Modify `buildPrompt()` in `src/lib/kitbash/generate.ts`
- The prompt must produce clean 3D-rendered mecha art — not anime/cartoon style
- Test changes using `scripts/test-kitbash-gen.ts` before deploying
```

- [ ] **Step 3: Update the "Feature flags" section**

Add a note that the photo-mint flow components are preserved in `src/components/mint/_deprecated/` for the future RWA tier.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for generative kitbash pivot"
```

---

## What's Preserved for Later

These are NOT in scope for this plan but are explicitly preserved:

| Feature | Status | Notes |
|---|---|---|
| **Photo-your-kit (RWA tier)** | Components in `_deprecated/`, Claude analysis pipeline intact | Future premium mint path |
| **Cosmetics system** | `feature/card-frame-renderer` has full UI + store | Task after this plan — wire CosmeticsMenu to post-mint edit flow |
| **AI Repaint** | Prompt templates in `cosmetics-data.ts` | Depends on cosmetics wiring |
| **Contract upgrade** | Phase 3 stash has frameId/colorShift/repaintStyle | Deploy after cosmetics is wired |
| **New token launch** | Clanker written but not deployed | Separate decision, can coincide with collection launch |
| **Battle system** | Fully functional, no changes needed | Works with generative cards as-is |
| **Staking** | Live on mainnet, no changes needed | Works independently |
