# Collection Card Flip & Per-Card Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the mint-success screen's card-flip mechanism to `/collection`'s cards, plus a compact per-card share action.

**Architecture:** Extract the flip mechanics and back-face stat panel out of `MintSuccess.tsx` into two new shared components (`FlippableCard`, `CardBack`), consumed by both the refactored mint-success screen and the collection grid, so there is one canonical implementation instead of a second copy.

**Tech Stack:** Next.js 16 (App Router), React 19, TailwindCSS v4, framer-motion (already a dependency, already used for the exact flip pattern being extracted), Zustand (`useMintStore`).

## Global Constraints

- No new data fetching anywhere in this feature — `useCollection()` and `useMintStore()` already provide everything `CardBack` needs (full `TraitSet` + `tokenId`).
- `CardFrame.tsx`, `GenerationReveal.tsx`, and `MintConfirm.tsx` are explicitly out of scope — none of them change. Only `/collection`'s cards and the mint-success flip mechanism change.
- `CardBack` uses `RARITY_PALETTES` from `src/lib/card/frame-config.ts` (`.primary` field) for its color — the single canonical rarity-color source for this component. Do not add a new local rarity-color map.
- This project has no frontend test framework (per `CLAUDE.md`) — verification is manual via the dev server, plus `npx tsc --noEmit` and `npx eslint` (project convention throughout this codebase).
- `ShareButtons`'s new `compact` prop only affects the plain (non-`verified`) button row. It has no effect on the `verified` branch — that's a separate, unrelated flow and is not used together with `compact` anywhere in this plan.

---

### Task 1: Extract FlippableCard + CardBack, refactor MintSuccess to use them

**Files:**
- Create: `src/components/card/FlippableCard.tsx`
- Create: `src/components/card/CardBack.tsx`
- Modify: `src/components/mint/MintSuccess.tsx`

**Interfaces:**
- Produces: `FlippableCard({ front: ReactNode, back: ReactNode, className?: string })` — generic 3D-flip wrapper, click anywhere to toggle. `className` sizes the outer wrapper (defaults to `"w-full max-w-[300px]"` if omitted).
- Produces: `CardBack({ traits: TraitSet, tokenId: bigint | null })` — the stat-panel back face. Renders `#tokenId` only when `tokenId !== null`.
- Consumes (Task 2 will use these): both of the above, unchanged.

- [ ] **Step 1: Create `FlippableCard`**

```tsx
// src/components/card/FlippableCard.tsx
"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";

interface FlippableCardProps {
  front: ReactNode;
  back: ReactNode;
  /** Sizes the outer wrapper. Defaults to the collection card's width. */
  className?: string;
}

/**
 * Generic 3D flip wrapper — click anywhere to toggle between front and back.
 * Extracted from the mint-success screen so the flip mechanics (and, via
 * CardBack, the back-face content) are shared instead of duplicated.
 */
export function FlippableCard({ front, back, className }: FlippableCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`cursor-pointer ${className ?? "w-full max-w-[300px]"}`}
      style={{ perspective: 1200 }}
      onClick={() => setFlipped(!flipped)}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 80 }}
        style={{ transformStyle: "preserve-3d" }}
        className="relative"
      >
        <div style={{ backfaceVisibility: "hidden" }}>{front}</div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Create `CardBack`**

```tsx
// src/components/card/CardBack.tsx
"use client";

import { displayRarity, type TraitSet } from "@/types/nft";
import { RARITY_PALETTES } from "@/lib/card/frame-config";

interface CardBackProps {
  traits: TraitSet;
  tokenId: bigint | null;
}

/**
 * The flip-card back face — stats panel shared between the mint-success
 * screen and the collection grid. Uses frame-config's RARITY_PALETTES so
 * there's one canonical rarity-color source instead of a per-component copy
 * (this codebase has already had two real bugs from that kind of drift).
 */
export function CardBack({ traits, tokenId }: CardBackProps) {
  const glowColor = RARITY_PALETTES[traits.rarity].primary;

  const weapons = [
    { label: "PRI", name: traits.primaryWeapon, dmg: traits.primaryDamage },
    { label: "SEC", name: traits.secondaryWeapon, dmg: traits.secondaryDamage },
    { label: "TER", name: traits.tertiaryWeapon, dmg: traits.tertiaryDamage },
    { label: "SPL", name: traits.specialAttack, dmg: traits.specialDamage },
  ];

  return (
    <div
      className="h-full rounded-xl border-2 overflow-hidden"
      style={{
        borderColor: glowColor,
        boxShadow: `0 0 20px ${glowColor}40`,
      }}
    >
      <div className="h-full bg-[var(--surface)] p-5 flex flex-col">
        {/* Header */}
        <div className="border-b border-[var(--border)] pb-3 mb-3">
          <p
            className="font-[family-name:var(--font-orbitron)] font-bold text-sm"
            style={{ color: glowColor }}
          >
            {traits.name}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">
              {traits.series}
            </span>
            {tokenId !== null && (
              <span className="text-[10px] font-mono text-[var(--foreground)]/40">
                #{tokenId.toString()}
              </span>
            )}
          </div>
        </div>

        {/* Core stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
          <div className="flex justify-between">
            <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">FACTION</span>
          </div>
          <span className="text-right text-[var(--foreground)]/80">{traits.faction}</span>

          <div className="flex justify-between">
            <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">ARMOR</span>
          </div>
          <span className="text-right text-[var(--foreground)]/80">{traits.armorType}</span>

          <div className="flex justify-between">
            <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">RARITY</span>
          </div>
          <span className="text-right" style={{ color: glowColor }}>{displayRarity(traits.rarity)}</span>
        </div>

        {/* HP bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40">HP</span>
            <span className="font-mono font-bold" style={{ color: glowColor }}>{traits.hp}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((traits.hp / 2000) * 100, 100)}%`,
                backgroundColor: glowColor,
              }}
            />
          </div>
        </div>

        {/* Weapons */}
        <div className="flex-1 space-y-1.5">
          <p className="text-[10px] font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/40 mb-1">
            ARMAMENT
          </p>
          {weapons.map((w) => (
            <div key={w.label} className="flex items-center gap-2 text-xs">
              <span
                className="font-[family-name:var(--font-orbitron)] text-[10px] w-7 flex-shrink-0"
                style={{ color: w.label === "SPL" ? glowColor : "var(--foreground)", opacity: w.label === "SPL" ? 1 : 0.4 }}
              >
                {w.label}
              </span>
              <span className="flex-1 text-[var(--foreground)]/70 truncate">{w.name}</span>
              <span
                className={`font-mono font-bold ${w.label === "SPL" ? "" : "text-[var(--foreground)]/80"}`}
                style={w.label === "SPL" ? { color: glowColor } : {}}
              >
                {w.dmg}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-[var(--foreground)]/30 font-[family-name:var(--font-orbitron)] mt-3 pt-2 border-t border-[var(--border)]">
          TAP TO FLIP BACK
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Refactor `MintSuccess.tsx` to use both**

Replace the entire file with:

```tsx
// src/components/mint/MintSuccess.tsx
"use client";

import { motion } from "framer-motion";
import { useMintStore } from "@/store/useMintStore";
import { displayRarity, type Rarity } from "@/types/nft";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { FlippableCard } from "@/components/card/FlippableCard";
import { CardBack } from "@/components/card/CardBack";
import { ipfsToHttp } from "@/lib/ipfs";

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

export function MintSuccess() {
  const {
    traits,
    generatedImageBase64,
    generatedImageMimeType,
    imageIpfsHash,
    mintedTokenId,
    reset,
  } = useMintStore();

  // Prefer the in-memory base64; fall back to the IPFS gateway after a
  // rehydrated session (wallet-reload mid-flow). See useMintStore for why
  // we don't persist the base64 itself.
  const imageUrl = generatedImageBase64
    ? `data:${generatedImageMimeType ?? "image/png"};base64,${generatedImageBase64}`
    : imageIpfsHash
      ? ipfsToHttp(`ipfs://${imageIpfsHash}`)
      : undefined;
  const rarityClass = traits ? RARITY_CLASS[traits.rarity] : "rarity-common";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", duration: 0.5 }}
      className="flex flex-col items-center gap-8 text-center"
    >
      {/* Flippable card */}
      {traits && (
        <motion.div
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.7, type: "spring" }}
        >
          <FlippableCard
            className="w-64"
            front={
              <div className={`rounded-xl border-2 overflow-hidden beam-scan ${rarityClass}`}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={traits.name}
                    className="w-full object-cover"
                  />
                )}
                <div className="p-4 bg-[var(--surface)]">
                  <p className="font-[family-name:var(--font-orbitron)] font-bold text-sm leading-tight">
                    {traits.name}
                  </p>
                  <p className="text-xs text-[var(--foreground)]/60 mt-1">
                    {displayRarity(traits.rarity)}
                  </p>
                  {mintedTokenId !== null && (
                    <p className="text-xs text-[var(--foreground)]/40 mt-1 font-mono">
                      #{mintedTokenId.toString()}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-[var(--foreground)]/30 pb-2 font-[family-name:var(--font-orbitron)]">
                  TAP TO FLIP
                </p>
              </div>
            }
            back={<CardBack traits={traits} tokenId={mintedTokenId} />}
          />
        </motion.div>
      )}

      {/* Title + description */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="space-y-2"
      >
        <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          GUNDAR-FRAME FORGED
        </h2>
        <p className="text-[var(--foreground)]/60 text-sm max-w-xs">
          {traits?.name} has been permanently recorded on Base and added to
          your collection.
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="flex gap-3 flex-wrap justify-center"
      >
        <a
          href="/collection"
          className="px-6 py-2.5 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          VIEW COLLECTION
        </a>
        <button
          onClick={reset}
          className="px-6 py-2.5 border border-[var(--border)] text-[var(--foreground)]/60 text-sm rounded-lg hover:border-[var(--accent)]/60 hover:text-[var(--foreground)] transition-all"
        >
          Mint Another
        </button>
      </motion.div>

      {/* Share */}
      {traits && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="flex flex-col items-center gap-3"
        >
          <p className="text-[10px] font-[family-name:var(--font-orbitron)] tracking-widest text-[var(--foreground)]/40">
            SHARE YOUR FORGE
          </p>
          <ShareButtons
            card={{
              name: traits.name,
              rarity: traits.rarity,
              tokenId: mintedTokenId,
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
```

Note what changed from the original: the local `RARITY_GLOW` map and manual `useState`-driven flip markup are gone (replaced by `FlippableCard`/`CardBack`); `RARITY_CLASS` stays (still used for the front's border CSS class, which `CardBack` doesn't touch); the whole flippable-card block is now guarded by `{traits && (...)}` instead of relying on `traits?.` optional chaining inside — this only changes behavior during the vanishingly brief render tick before `traits` populates (nothing renders there instead of a blank card), which is a strict improvement, not a regression.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/card/FlippableCard.tsx src/components/card/CardBack.tsx src/components/mint/MintSuccess.tsx`
Expected: no errors or warnings.

- [ ] **Step 5: Manually verify the mint-success flip still works, with zero cost**

A real mint costs USDC — instead, simulate a completed mint via localStorage, which is exactly the mechanism `useMintStore`'s own `persist` config already uses for real mobile-wallet-reload resumption (see the comment above `export const useMintStore` in `src/store/useMintStore.ts`), so this is testing through the app's real rehydration path, not a hack.

1. Run `npm run dev`, open `http://localhost:3000/mint` in a browser.
2. Open devtools → Application (Chrome) / Storage (Firefox) → Local Storage → `http://localhost:3000`.
3. Find the `gundarium-mint-state` key and set its value to exactly:

```json
{"state":{"step":"success","faction":null,"kitbashTraits":null,"traitRarities":null,"traits":{"name":"Test Zoro","series":"GundariuM Genesis","faction":"G_NATIONS","rarity":"Rare","hp":652,"pilotName":"TestPilot","armorType":"Luna Titanium","primaryWeapon":"Beam Saber (dual)","primaryDamage":128,"secondaryWeapon":"Vulcan Pod","secondaryDamage":253,"tertiaryWeapon":"Binder Beam Gun","tertiaryDamage":56,"specialAttack":"Limit Break","specialDamage":332},"fallbackName":"Test Zoro","customName":"","imageIpfsHash":null,"metadataUri":null,"mintedTokenId":"42"},"version":1}
```

4. Reload `http://localhost:3000/mint`.
5. Expected: the success screen renders with a card showing "Test Zoro" and "TAP TO FLIP" (no image loads since `imageIpfsHash` is `null` here — expected, image loading isn't part of this change).
6. Click the card. Expected: it flips to the back, showing FACTION `G_NATIONS`, ARMOR `Luna Titanium`, RARITY `Apex` in blue (matching Rare's real color), an HP bar at 652/2000, and all four weapons with their damage numbers. Click again: flips back to the front.
7. Clear the `gundarium-mint-state` localStorage key afterward so it doesn't linger and confuse a real mint test later.

- [ ] **Step 6: Commit**

```bash
git add src/components/card/FlippableCard.tsx src/components/card/CardBack.tsx src/components/mint/MintSuccess.tsx
git commit -m "refactor(card): extract FlippableCard + CardBack from MintSuccess"
```

---

### Task 2: Add compact ShareButtons + wire flip/share into CollectionCard

**Files:**
- Modify: `src/components/ui/ShareButtons.tsx`
- Modify: `src/components/collection/CollectionCard.tsx`

**Interfaces:**
- Consumes: `FlippableCard`, `CardBack` (from Task 1, unchanged).
- Produces: `ShareButtons({ ..., compact?: boolean })` — new optional prop, icon-only rendering with tighter spacing when `true`. No effect on the `verified` branch.

- [ ] **Step 1: Add `compact` to `ShareButtonsProps` and destructure it**

In `src/components/ui/ShareButtons.tsx`, change the interface:

```tsx
interface ShareButtonsProps {
  /** Optional minted card context — when provided, the share line is personalized. */
  card?: {
    name: string;
    rarity: Rarity;
    tokenId: bigint | null;
  };
  /** Optional Arena battle context — shown after any battle, win or loss. */
  battle?: {
    playerName: string;
    enemyName: string;
    hpPct: number;
    won: boolean;
  };
  /** Optional Frame-Runner dossier context. */
  dossier?: {
    address: `0x${string}`;
    streak: number;
    exp: number;
  };
  /** Called when any share action is triggered — e.g. to mark a daily task done. */
  onShare?: () => void;
  /** Opt-in verified flow — only ever passed from EXP-earning task rows. */
  verified?: ReturnType<typeof useVerifiedShare>;
  /** Icon-only, tighter-spaced rendering for dense placements like the collection grid. Has no effect on the `verified` branch. */
  compact?: boolean;
}
```

And change the function signature:

```tsx
export function ShareButtons({ card, battle, dossier, onShare, verified, compact }: ShareButtonsProps = {}) {
```

- [ ] **Step 2: Make the plain button row compact-aware**

Replace the final `return` statement (the plain, non-`verified` button row) with:

```tsx
  const padding = compact ? "p-1.5" : "px-3 py-2";
  const gap = compact ? "gap-1" : "gap-1.5";

  return (
    <div className={compact ? "flex items-center gap-1" : "flex flex-wrap items-center justify-center gap-2"}>
      <button
        onClick={shareOnFarcaster}
        title="Share on Farcaster"
        className={`flex items-center ${gap} rounded-lg border border-purple-500/30 bg-purple-500/10 ${padding} text-xs font-bold text-purple-400 transition-all hover:bg-purple-500/20 hover:border-purple-500/50`}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.24 1.2H5.76A4.56 4.56 0 001.2 5.76v12.48a4.56 4.56 0 004.56 4.56h12.48a4.56 4.56 0 004.56-4.56V5.76a4.56 4.56 0 00-4.56-4.56zm.72 16.08h-.96l-.24-3.36h-.01c-.48 1.92-1.68 3.6-3.84 3.6-2.04 0-3.36-1.56-3.36-3.84 0-3.24 2.16-6.48 5.52-6.48.84 0 1.56.12 2.04.36l-.6 2.64c-.36-.12-.72-.24-1.2-.24-1.8 0-3.12 2.04-3.12 3.96 0 1.08.48 1.8 1.32 1.8 1.08 0 2.04-1.32 2.28-2.76l.48-2.52h-1.8l.36-1.68h4.68l-1.44 8.52z" /></svg>
        {!compact && "Farcaster"}
      </button>
      <button
        onClick={shareOnX}
        title="Share on X"
        className={`flex items-center ${gap} rounded-lg border border-[var(--foreground)]/20 bg-[var(--foreground)]/5 ${padding} text-xs font-bold text-[var(--foreground)]/70 transition-all hover:bg-[var(--foreground)]/10 hover:border-[var(--foreground)]/30`}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
        {!compact && "X"}
      </button>
      <button
        onClick={shareOnFacebook}
        title="Share on Facebook"
        className={`flex items-center ${gap} rounded-lg border border-blue-500/30 bg-blue-500/10 ${padding} text-xs font-bold text-blue-400 transition-all hover:bg-blue-500/20 hover:border-blue-500/50`}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
        {!compact && "Facebook"}
      </button>
      <button
        onClick={shareGeneric}
        title="Share"
        className={`flex items-center ${gap} rounded-lg border border-[var(--border)] bg-[var(--surface)] ${padding} text-xs font-bold text-[var(--foreground)]/50 transition-all hover:border-[var(--accent)]/30 hover:text-[var(--accent)]`}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" /></svg>
        {!compact && "Share"}
      </button>
    </div>
  );
}
```

(The `card`/`battle`/`dossier`/`verified` branches above this return, and everything else in the file, are unchanged.)

- [ ] **Step 3: Wire `FlippableCard` + `CardBack` + compact `ShareButtons` into `CollectionCard`**

Replace `src/components/collection/CollectionCard.tsx` with:

```tsx
// src/components/collection/CollectionCard.tsx
"use client";

import { useEffect, useState } from "react";
import { CardFrame } from "@/components/card/CardFrame";
import { CardBack } from "@/components/card/CardBack";
import { FlippableCard } from "@/components/card/FlippableCard";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { ipfsToHttp } from "@/lib/ipfs";
import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";

interface CollectionCardProps {
  card: OwnedCard;
  /**
   * Wallet that owns this collection. Used by CardFrame to resolve the
   * Runner identity from Farcaster / custom profile. The collection page
   * passes its connected-wallet address down to every card.
   */
  ownerAddress?: string | null;
}

export function CollectionCard({ card, ownerAddress }: CollectionCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(ipfsToHttp(card.tokenUri))
      .then((r) => r.json())
      .then((meta) => {
        if (!cancelled && meta?.image) setImageUrl(ipfsToHttp(meta.image));
      })
      .catch(() => {
        // Metadata fetch failed — leave imageUrl null so we render a placeholder
      });
    return () => {
      cancelled = true;
    };
  }, [card.tokenUri]);

  return (
    <div className="flex flex-col items-center gap-2">
      {imageUrl ? (
        <FlippableCard
          front={
            <CardFrame
              imageUrl={imageUrl}
              traits={card.traits}
              ownerAddress={ownerAddress}
            />
          }
          back={<CardBack traits={card.traits} tokenId={card.tokenId} />}
        />
      ) : (
        <div
          className="w-full max-w-[300px] aspect-[3/4] rounded-sm border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center"
        >
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-[var(--foreground)]/40">
          #{card.tokenId.toString()}
        </span>
        <ShareButtons
          compact
          card={{ name: card.traits.name, rarity: card.traits.rarity, tokenId: card.tokenId }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/ui/ShareButtons.tsx src/components/collection/CollectionCard.tsx`
Expected: no errors or warnings.

- [ ] **Step 5: Manually verify on `/collection` with a real connected wallet**

1. Run `npm run dev`, connect a wallet that owns at least two Gundar-Frames of different rarities, open `http://localhost:3000/collection`.
2. Expected: every card's front renders exactly as it did before this change (no visual regression — `CardFrame` itself wasn't touched).
3. Click one card. Expected: it flips to the back, showing that card's real on-chain faction/armor/rarity/HP/weapons, correctly colored for its actual rarity. Click a different card in the grid — expected: only that card flips; the first card's flipped state is unaffected.
4. Confirm the compact share row (small icon-only buttons, no text labels) appears below every card next to its `#tokenId`, regardless of whether that card is currently showing its front or back.
5. Click the Farcaster icon on one card. Expected: it opens the compose flow (in-app if inside a Farcaster client, else `warpcast.com/~/compose` in a new tab) with that card's name/rarity in the text and `/card/{tokenId}` as the embed. Click the generic Share icon on another card — expected: native share sheet (or clipboard copy, if unsupported).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ShareButtons.tsx src/components/collection/CollectionCard.tsx
git commit -m "feat(collection): add card flip and per-card share"
```
