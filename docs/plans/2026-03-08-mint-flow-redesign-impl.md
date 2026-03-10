# Mint Flow Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace AI suit recognition with user-driven suit search, add RNG stats with paid re-rolls, cosmetics, and upgrades — all protected by Cloudflare Turnstile + KV anti-abuse.

**Architecture:** Static `suits.json` database powers fuse.js autocomplete and canonical trait lookup. Cloudflare KV tracks re-rolls/failures/lockouts server-side. Each mint step (Trait Review, Cosmetics, Upgrades, Mint) validates lockout state before proceeding.

**Tech Stack:** Next.js App Router, fuse.js, Cloudflare KV (via REST API), Cloudflare Turnstile, GNDM token (ERC20), wagmi v3, Zustand, Pinata/IPFS

**Design doc:** `docs/plans/2026-03-08-mint-flow-redesign.md`

---

## Phase 1 — Suits Database

### Task 1: Create suits.json schema and seed file

**Files:**
- Create: `src/data/suits.json`
- Create: `src/types/suits.ts`

**Step 1: Create the TypeScript types**

```ts
// src/types/suits.ts
export type KitGrade = "SD" | "HG" | "RG" | "MG" | "MG_VERKA" | "HIRM" | "PG";

export interface SuitStatRange {
  min: number;
  max: number;
}

export interface SuitEntry {
  id: string;                    // kebab-case unique ID
  name: string;                  // "RX-78-2 Gundam"
  series: string;                // "Mobile Suit Gundam [Universal Century]"
  faction: string;               // "Earth Federation Forces"
  pilot: string;                 // "Amuro Ray"
  armorType: "Standard" | "Gundanium" | "Phase Shift" | "I-Field" | "GN Particle" | "Luna Titanium";
  weapons: {
    primary: string;
    secondary: string;
    tertiary: string;
    special: string;
  };
  grades: KitGrade[];            // grades Bandai actually produced
  stats: {
    hp: SuitStatRange;
    primaryDamage: SuitStatRange;
    secondaryDamage: SuitStatRange;
    tertiaryDamage: SuitStatRange;
    specialDamage: SuitStatRange;
  };
}
```

**Step 2: Seed suits.json with first 20 suits**

Populate with these suits as the initial seed (expand to ~300 over time):
- RX-78-2 Gundam, MS-06S Zaku II (Char's), ZGMF-X10A Freedom, ZGMF-X20A Strike Freedom, XXXG-01W Wing Gundam, XXXG-00W0 Wing Gundam Zero, GN-001 Exia, GN-0000 00 Gundam, RX-93 Nu Gundam, MSN-04 Sazabi, MSN-06S Sinanju, MBF-P02 Astray Red Frame, MBF-02VV Astray Turn Red, GAT-X105 Strike Gundam, RX-0 Unicorn Gundam, RX-9/C Narrative Gundam C-Packs, ASW-G-08 Barbatos, SYSTEM∀-99 Turn A Gundam, MS-09 Dom, RGM-79 GM

Stat ranges scale with grade: HG base, RG +10%, MG +20%, MG_VERKA +30%, HIRM +35%, PG +50%

**Step 3: Commit**
```bash
git add src/data/suits.json src/types/suits.ts
git commit -m "feat: add suits database schema and initial 20-suit seed"
```

---

## Phase 2 — Store Updates

### Task 2: Update useMintStore for new flow

**Files:**
- Modify: `src/store/useMintStore.ts`

**Step 1: Read current store, then replace step type**

New steps:
```ts
export type MintStep =
  | "idle"           // Step 1: Suit Search
  | "grade_select"   // Step 2: Grade Select
  | "photo_upload"   // Step 3: Photo Upload
  | "trait_review"   // Step 4: Trait Review (RNG)
  | "cosmetics"      // Step 5: Cosmetics
  | "upgrades"       // Step 6: Upgrades
  | "confirming"     // Step 7: Confirm & Mint
  | "success";       // Step 8: Success
```

**Step 2: Add new state fields**

```ts
interface MintStore {
  // existing
  step: MintStep;
  imageFile: File | null;
  imagePreviewUrl: string;
  traits: TraitSet | null;
  metadataUri: string | null;
  imageIpfsHash: string | null;
  mintedTokenId: bigint | null;
  error: string | null;

  // new
  selectedSuit: SuitEntry | null;
  selectedGrade: KitGrade | null;
  rerollsUsed: number;           // 0-2
  turnstileToken: string | null; // Cloudflare Turnstile token
  cosmeticRoll: CosmeticRoll | null;
  selectedCosmeticPackage: CosmeticPackage | null;
  upgrades: UpgradeSelections | null;

  // actions
  setSuit: (suit: SuitEntry) => void;
  setGrade: (grade: KitGrade) => void;
  setRerollsUsed: (n: number) => void;
  setTurnstileToken: (token: string) => void;
  setCosmeticRoll: (roll: CosmeticRoll) => void;
  setUpgrades: (upgrades: UpgradeSelections) => void;
  // existing actions remain
}
```

**Step 3: Commit**
```bash
git add src/store/useMintStore.ts
git commit -m "feat: update mint store for redesigned 8-step flow"
```

---

## Phase 3 — Suit Search Component

### Task 3: Install fuse.js and build SuitSearch

**Files:**
- Create: `src/components/mint/SuitSearch.tsx`

**Step 1: Install fuse.js**
```bash
npm install fuse.js
```

**Step 2: Build the component**

```tsx
"use client";
import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import suits from "@/data/suits.json";
import type { SuitEntry } from "@/types/suits";
import { useMintStore } from "@/store/useMintStore";

export function SuitSearch() {
  const { setSuit, goTo } = useMintStore();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const fuse = useMemo(() => new Fuse(suits as SuitEntry[], {
    keys: ["name", "series", "pilot"],
    threshold: 0.3,
  }), []);

  const results = query.length > 1
    ? fuse.search(query).slice(0, 8).map(r => r.item)
    : [];

  const handleSelect = (suit: SuitEntry) => {
    setSuit(suit);
    goTo("grade_select");
  };

  return (
    <div className="w-full max-w-lg relative">
      <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest mb-2 block">
        Search your Gunpla suit
      </label>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder="e.g. Unicorn, Zaku, Wing Zero..."
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-colors"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden z-50 shadow-xl">
          {results.map(suit => (
            <button
              key={suit.id}
              onClick={() => { handleSelect(suit); setIsOpen(false); }}
              className="w-full text-left px-4 py-3 hover:bg-[var(--accent)]/10 transition-colors border-b border-[var(--border)] last:border-0"
            >
              <p className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--foreground)]">
                {suit.name}
              </p>
              <p className="text-xs text-[var(--foreground)]/50">{suit.series}</p>
            </button>
          ))}
        </div>
      )}
      {query.length > 1 && results.length === 0 && (
        <p className="mt-2 text-sm text-[var(--foreground)]/40 text-center">
          No suits found — try a different name
        </p>
      )}
    </div>
  );
}
```

**Step 3: Commit**
```bash
git add src/components/mint/SuitSearch.tsx
git commit -m "feat: add SuitSearch autocomplete component with fuse.js"
```

---

## Phase 4 — Grade Select (Simplified)

### Task 4: Rebuild GradePicker to use suit's grade list

**Files:**
- Modify: `src/components/mint/GradePicker.tsx`

The new GradePicker no longer calls the AI API. It reads `selectedSuit.grades` from the store and shows only those options. Remove all `analyzeGunpla` imports and fetch calls. The "ANALYZE WITH AI" button becomes "CONFIRM GRADE →".

**Step 1: Rewrite GradePicker**

Key changes:
- Import `SuitEntry` from `@/types/suits`
- Get `selectedSuit` from store
- Filter GRADES constant to only those in `selectedSuit.grades`
- On confirm: call `setGrade(selected)` then `goTo("photo_upload")`
- Remove `analyzing` state, `setError` for API, all fetch logic

**Step 2: Commit**
```bash
git add src/components/mint/GradePicker.tsx
git commit -m "feat: rebuild GradePicker to use suit database grades, remove AI call"
```

---

## Phase 5 — Cloudflare KV + Turnstile Setup

### Task 5: Create Cloudflare KV namespace

**Step 1: Create KV namespace via Cloudflare MCP or dashboard**

Name: `gundarium-mint-abuse`

Note the namespace ID — add to Vercel env vars:
```
CLOUDFLARE_KV_NAMESPACE_ID=<id>
CLOUDFLARE_ACCOUNT_ID=<id>
CLOUDFLARE_KV_API_TOKEN=<token>
```

**Step 2: Create KV utility**

```ts
// src/lib/kv.ts
const BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`;
const HEADERS = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_KV_API_TOKEN}`,
  "Content-Type": "application/json",
};

export async function kvGet(key: string): Promise<string | null> {
  const res = await fetch(`${BASE}/values/${encodeURIComponent(key)}`, { headers: HEADERS });
  if (res.status === 404) return null;
  return res.text();
}

export async function kvPut(key: string, value: string, ttlSeconds: number): Promise<void> {
  await fetch(`${BASE}/values/${encodeURIComponent(key)}?expiration_ttl=${ttlSeconds}`, {
    method: "PUT",
    headers: HEADERS,
    body: value,
  });
}

export async function kvIncrement(key: string, ttlSeconds: number): Promise<number> {
  const current = await kvGet(key);
  const next = (parseInt(current ?? "0") + 1);
  await kvPut(key, String(next), ttlSeconds);
  return next;
}
```

**Step 3: Create anti-abuse middleware**

```ts
// src/lib/abuse.ts
import { kvGet, kvPut, kvIncrement } from "./kv";

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
  lockoutMinutes?: number;
}

export async function checkLockout(wallet: string, fid?: string): Promise<AbuseCheckResult> {
  const walletLock = await kvGet(`lockout:${wallet.toLowerCase()}`);
  if (walletLock) return { allowed: false, reason: walletLock, lockoutMinutes: walletLock === "24h" ? 1440 : 20 };
  if (fid) {
    const fidLock = await kvGet(`lockout:fid:${fid}`);
    if (fidLock) return { allowed: false, reason: fidLock, lockoutMinutes: fidLock === "24h" ? 1440 : 20 };
  }
  return { allowed: true };
}

export async function recordFailure(wallet: string, fid?: string): Promise<void> {
  const hour = Math.floor(Date.now() / 3_600_000);
  const count = await kvIncrement(`failures:${wallet.toLowerCase()}:${hour}`, 3600);

  if (count >= 14) {
    await kvPut(`lockout:${wallet.toLowerCase()}`, "24h", 86400);
    if (fid) await kvPut(`lockout:fid:${fid}`, "24h", 86400);
  } else if (count >= 7) {
    await kvPut(`lockout:${wallet.toLowerCase()}`, "20min", 1200);
    if (fid) await kvPut(`lockout:fid:${fid}`, "20min", 1200);
  }
}
```

**Step 4: Add Turnstile env var**
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<from Cloudflare dashboard>
TURNSTILE_SECRET_KEY=<from Cloudflare dashboard>
```

**Step 5: Create Turnstile verify utility**

```ts
// src/lib/turnstile.ts
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    }),
  });
  const data = await res.json();
  return data.success === true;
}
```

**Step 6: Commit**
```bash
git add src/lib/kv.ts src/lib/abuse.ts src/lib/turnstile.ts
git commit -m "feat: add Cloudflare KV utility, anti-abuse middleware, Turnstile verify"
```

---

## Phase 6 — Trait Review (RNG + Re-rolls)

### Task 6: Build new TraitReview with RNG and re-roll flow

**Files:**
- Modify: `src/components/mint/TraitReview.tsx`
- Create: `src/app/api/reroll/route.ts`
- Create: `src/lib/rng.ts`

**Step 1: Create RNG utility**

```ts
// src/lib/rng.ts
import type { SuitEntry, KitGrade } from "@/types/suits";
import type { TraitSet } from "@/types/nft";

const GRADE_MULTIPLIER: Record<KitGrade, number> = {
  SD: 0.7, HG: 1.0, RG: 1.1, MG: 1.2, MG_VERKA: 1.3, HIRM: 1.35, PG: 1.5,
};

function roll(min: number, max: number, multiplier: number): number {
  const scaledMin = Math.round(min * multiplier);
  const scaledMax = Math.round(max * multiplier);
  return Math.floor(Math.random() * (scaledMax - scaledMin + 1)) + scaledMin;
}

export function rollTraits(suit: SuitEntry, grade: KitGrade): TraitSet {
  const m = GRADE_MULTIPLIER[grade];
  const { stats, weapons } = suit;
  return {
    name: suit.name,
    series: suit.series,
    faction: suit.faction,
    pilotName: suit.pilot,
    armorType: suit.armorType,
    rarity: gradeToRarity(grade),
    hp: roll(stats.hp.min, stats.hp.max, m),
    primaryWeapon: weapons.primary,
    primaryDamage: roll(stats.primaryDamage.min, stats.primaryDamage.max, m),
    secondaryWeapon: weapons.secondary,
    secondaryDamage: roll(stats.secondaryDamage.min, stats.secondaryDamage.max, m),
    tertiaryWeapon: weapons.tertiary,
    tertiaryDamage: roll(stats.tertiaryDamage.min, stats.tertiaryDamage.max, m),
    specialAttack: weapons.special,
    specialDamage: roll(stats.specialDamage.min, stats.specialDamage.max, m),
    repaintColor: "",
    decalId: "",
  };
}
```

**Step 2: Create reroll API route**

```ts
// src/app/api/reroll/route.ts
// Validates wallet is not locked out, increments reroll count in KV,
// returns new RNG traits. Does NOT charge USDC — that's handled on-chain
// before calling this endpoint.
import { NextRequest, NextResponse } from "next/server";
import { checkLockout, recordFailure } from "@/lib/abuse";
import { verifyTurnstile } from "@/lib/turnstile";
import { kvGet, kvPut, kvIncrement } from "@/lib/kv";
import suits from "@/data/suits.json";
import { rollTraits } from "@/lib/rng";

export async function POST(req: NextRequest) {
  const { wallet, fid, suitId, grade, turnstileToken } = await req.json();

  // 1. Verify Turnstile
  const human = await verifyTurnstile(turnstileToken, req.headers.get("x-forwarded-for") ?? undefined);
  if (!human) return NextResponse.json({ error: "Turnstile failed" }, { status: 403 });

  // 2. Check lockout
  const lockCheck = await checkLockout(wallet, fid);
  if (!lockCheck.allowed) return NextResponse.json({ error: "Locked out", lockoutMinutes: lockCheck.lockoutMinutes }, { status: 429 });

  // 3. Check reroll count
  const key = `rerolls:${wallet.toLowerCase()}`;
  const current = parseInt((await kvGet(key)) ?? "0");
  if (current >= 2) {
    await kvPut(`lockout:${wallet.toLowerCase()}`, "20min", 1200);
    return NextResponse.json({ error: "Re-rolls exhausted", lockoutMinutes: 20 }, { status: 429 });
  }

  // 4. Increment reroll count
  await kvIncrement(key, 86400);

  // 5. Generate new traits
  const suit = (suits as any[]).find(s => s.id === suitId);
  if (!suit) return NextResponse.json({ error: "Suit not found" }, { status: 404 });
  const traits = rollTraits(suit, grade);

  return NextResponse.json({ traits, rerollsUsed: current + 1 });
}
```

**Step 3: Rebuild TraitReview UI**

Key behaviors:
- Shows traits from store (set on arrival via `rollTraits`)
- Shows re-roll count (`rerollsUsed / 2 paid re-rolls`)
- "RE-ROLL ($0.50 USDC)" button triggers USDC transfer then calls `/api/reroll`
- On failure: calls `recordFailure`, shows error
- On lockout response: shows countdown timer
- "LOOKS GOOD — NEXT" proceeds to cosmetics

**Step 4: Commit**
```bash
git add src/lib/rng.ts src/app/api/reroll/route.ts src/components/mint/TraitReview.tsx
git commit -m "feat: add RNG trait system, re-roll API, updated TraitReview with lockout"
```

---

## Phase 7 — Cosmetics Step

### Task 7: Build Cosmetics component

**Files:**
- Create: `src/components/mint/CosmeticsStep.tsx`
- Create: `src/app/api/cosmetic-roll/route.ts`
- Create: `src/types/cosmetics.ts`

**Step 1: Define cosmetic types**

```ts
// src/types/cosmetics.ts
export interface CosmeticRoll {
  borderStyle: string;    // e.g. "holographic", "carbon-fiber", "gold-trim"
  accentColor: string;    // hex color
  decalSet: string;       // e.g. "federation-markings", "zeon-skull", "celestial-being"
  backgroundFx: string;   // e.g. "particle-burst", "space-grid", "flame"
}

export type CosmeticPackage = "free" | "basic" | "standard" | "premium";

export interface CosmeticPackageOption {
  id: CosmeticPackage;
  label: string;
  priceUsd: number;   // in USD, paid in GNDM equivalent
  rerolls: number;    // number of re-rolls included
  features: string[];
}
```

**Step 2: Create cosmetic-roll API route**

Generates random cosmetic roll, validates lockout same as reroll route.

**Step 3: Build CosmeticsStep UI**

Key behaviors:
- On mount: auto-generate free cosmetic roll, display preview overlay on card image
- "OPT OUT — SKIP COSMETICS" button visible at all times
- Package selector: Free / Basic ($2 GNDM) / Standard ($5 GNDM) / Premium ($10 GNDM)
- Package contents TBD — placeholder UI with "Coming Soon" for paid tiers
- Failure detector wraps GNDM payment calls
- "NEXT — UPGRADES" proceeds to step 6

**Step 4: Commit**
```bash
git add src/types/cosmetics.ts src/components/mint/CosmeticsStep.tsx src/app/api/cosmetic-roll/route.ts
git commit -m "feat: add cosmetics step with free roll, opt-out, and package placeholders"
```

---

## Phase 8 — Upgrades Step

### Task 8: Build Upgrades component

**Files:**
- Create: `src/components/mint/UpgradesStep.tsx`
- Create: `src/types/upgrades.ts`

**Step 1: Define upgrade types**

```ts
// src/types/upgrades.ts
export interface UpgradeSelections {
  hpBoost: number;           // GNDM spent on HP
  primaryDmgBoost: number;
  secondaryDmgBoost: number;
  armorResistance: number;   // 0-3 levels
}
```

**Step 2: Build UpgradesStep UI**

Key behaviors:
- Shows current stats from trait review
- Each stat has +/- buttons to spend GNDM for incremental upgrades
- Running GNDM total shown
- "OPT OUT — DEPLOY MY SUIT" skips upgrades and goes to confirming
- "UPGRADE & DEPLOY" pays GNDM and proceeds
- Failure detector on GNDM payment
- Pricing TBD — placeholder with "Coming Soon" amounts

**Step 3: Commit**
```bash
git add src/types/upgrades.ts src/components/mint/UpgradesStep.tsx
git commit -m "feat: add upgrades step with GNDM payments and opt-out"
```

---

## Phase 9 — Mint Confirm ($2 USDC)

### Task 9: Update MintConfirm price and add failure detector

**Files:**
- Modify: `src/components/mint/MintConfirm.tsx`
- Modify: `src/lib/contracts/hooks/useMint.ts`

**Step 1: Update mint price display**

The contract's `mintPriceUsdc` is set at deploy time. Update the display and the Sepolia test value to `2_000_000` ($2).

**Step 2: Wrap writeContractAsync calls with failure detector**

In `useMint.ts`, wrap `approveMint` and `executeMint` with:
```ts
import { recordFailure } from "@/lib/abuse";

// In catch blocks — distinguish user rejection from contract failure
const isUserRejection = msg.includes("User rejected") || msg.includes("rejected_by_user");
if (!isUserRejection && wallet && fid) {
  await recordFailure(wallet, fid);
}
```

**Step 3: Commit**
```bash
git add src/components/mint/MintConfirm.tsx src/lib/contracts/hooks/useMint.ts
git commit -m "feat: update mint price to $2, add failure detector to mint flow"
```

---

## Phase 10 — Update Mint Page & Cleanup

### Task 10: Wire all steps into mint/page.tsx, remove AI code

**Files:**
- Modify: `src/app/mint/page.tsx`
- Delete: `src/lib/claude/analyzeGunpla.ts` (or keep for possible future use — comment out)
- Modify: `src/app/api/analyze-gunpla/route.ts` (disable, return 410 Gone)

**Step 1: Update STEP_LABELS and PROGRESS_STEPS**

```ts
const STEP_LABELS: Record<MintStep, string> = {
  idle: "Search for your mobile suit",
  grade_select: "Select your kit's grade",
  photo_upload: "Upload your Gunpla photo",
  trait_review: "Review your card stats",
  cosmetics: "Customize your card",
  upgrades: "Upgrade your suit",
  confirming: "Approve & mint on-chain",
  success: "Your card is live!",
};
```

**Step 2: Wire step rendering**

```tsx
{step === "idle" && <SuitSearch />}
{step === "grade_select" && <GradePicker />}
{step === "photo_upload" && <PhotoDropzone />}
{step === "trait_review" && <TraitReview />}
{step === "cosmetics" && <CosmeticsStep />}
{step === "upgrades" && <UpgradesStep />}
{step === "confirming" && <MintConfirm />}
{step === "success" && <MintSuccess />}
```

**Step 3: Disable analyze-gunpla API route**

```ts
// src/app/api/analyze-gunpla/route.ts
export async function POST() {
  return Response.json({ error: "AI analysis has been retired" }, { status: 410 });
}
```

**Step 4: Commit**
```bash
git add src/app/mint/page.tsx src/app/api/analyze-gunpla/route.ts
git commit -m "feat: wire all 8 mint steps, retire AI analysis endpoint"
```

---

## Phase 11 — Suits Database Expansion

### Task 11: Expand suits.json to ~300 entries

This is a content task, not a code task. Build out the database using:
- Newtype.org for community-verified kit data
- Gundam Wiki for canonical pilot/faction/weapon names
- Focus on: UC era, SEED/Destiny, Wing, 00, IBO, Build series
- Every entry must have at least 3 kit grades listed
- Validate JSON schema matches `SuitEntry` type

**Commit after each batch of 50 suits:**
```bash
git add src/data/suits.json
git commit -m "data: add [series name] suits to database (total: N)"
```

---

## Phase 12 — Deploy & Verify

### Task 12: Deploy preview, verify end-to-end flow

**Step 1: Add new env vars to Vercel preview**
```bash
npx vercel env add CLOUDFLARE_KV_NAMESPACE_ID preview
npx vercel env add CLOUDFLARE_ACCOUNT_ID preview
npx vercel env add CLOUDFLARE_KV_API_TOKEN preview
npx vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY preview
npx vercel env add TURNSTILE_SECRET_KEY preview
```

**Step 2: Deploy preview**
```bash
npx vercel --force
```

**Step 3: Test full flow**
- [ ] Suit search returns results for "unicorn", "zaku", "wing"
- [ ] Grade select shows only correct grades for selected suit
- [ ] Photo upload works, compression fires
- [ ] Trait review shows RNG stats
- [ ] Re-roll deducts $0.50 USDC and returns new stats
- [ ] 3rd re-roll attempt triggers lockout message
- [ ] Cosmetic free roll displays on card
- [ ] Opt-out skips cosmetics
- [ ] Upgrades opt-out goes to confirm
- [ ] Mint completes for $2 USDC
- [ ] Success screen shows

**Step 4: Push to production when verified**
```bash
git push
npx vercel --prod
```

---

## Open Items (Implement Later)
- Cosmetic package contents ($2/$5/$10 tiers) — TBD with Josh
- Ala carte cosmetic pricing — TBD
- Upgrade increment amounts and GNDM pricing — TBD
- fal.ai cosmetic image generation integration
- Turnstile widget in SuitSearch component (Step 1 UI)
- GNDM payment contract function for cosmetics/upgrades
