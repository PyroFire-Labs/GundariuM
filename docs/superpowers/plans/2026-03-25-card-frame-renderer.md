# Card Frame Renderer — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every minted GundariuM card gets a HUD/Holo Hex branded frame with rarity coloring composited onto the photo, producing a trading-card-style NFT image on IPFS.

**Architecture:** Client-side `CardFrame` React component renders the live preview (HTML/CSS). Server-side `/api/render-card` uses `@napi-rs/canvas` to composite the final PNG (photo + frame overlay) before IPFS upload. A new `card_preview` mint step shows the preview between trait review and confirming.

**Tech Stack:** React 19, @napi-rs/canvas, Next.js 16 API routes, Pinata IPFS, Zustand, TailwindCSS v4

**Note:** This project has no frontend test framework. Verification steps are manual (browser + API testing) with clear expected outcomes.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/card/frame-config.ts` | Rarity color palettes, card dimensions, frame layout constants |
| `src/lib/card/draw-frame.ts` | Server-side Canvas drawing functions (hex grid, brackets, reticle, nameplate) |
| `src/components/card/CardFrame.tsx` | Client-side React component — HUD/Holo Hex frame preview (HTML/CSS) |
| `src/components/mint/CardPreview.tsx` | Mint step component — shows framed card + "CONFIRM" / "Back" buttons |
| `src/app/api/render-card/route.ts` | API route — receives photo + traits, composites card PNG, returns image buffer |

### Modified Files
| File | Change |
|------|--------|
| `src/store/useMintStore.ts` | Add `"card_preview"` to `MintStep` union |
| `src/app/mint/page.tsx` | Add `card_preview` step to progress bar + render `<CardPreview />` |
| `src/components/mint/TraitReview.tsx` | Change button to advance to `card_preview` instead of `confirming` |
| `src/components/mint/MintConfirm.tsx` | Upload rendered card image (from store) instead of raw photo |
| `src/app/globals.css` | Add `@keyframes scan` for card frame scan line animation |
| `package.json` | Add `@napi-rs/canvas` dependency |

**Note:** `src/app/api/mint-metadata/route.ts` does NOT need changes — it already accepts any `File` via FormData, so the rendered PNG works as-is.

---

## Task 1: Install `@napi-rs/canvas` and verify it works on the project

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install @napi-rs/canvas
```

- [ ] **Step 2: Verify it imports correctly**

Create a quick test script to confirm the binary works:

```bash
node -e "const { createCanvas } = require('@napi-rs/canvas'); const c = createCanvas(100, 100); console.log('Canvas OK:', c.width, c.height);"
```

Expected: `Canvas OK: 100 100`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @napi-rs/canvas for card frame rendering"
```

---

## Task 2: Create frame configuration constants

**Files:**
- Create: `src/lib/card/frame-config.ts`

- [ ] **Step 1: Create the constants file**

```typescript
import type { Rarity } from "@/types/nft";

// ─── Card Dimensions ───────────────────────────────────────────────────
// 2:3 aspect ratio (standard trading card)
export const CARD_WIDTH = 600;
export const CARD_HEIGHT = 900;
export const PHOTO_PADDING = 24;
export const NAMEPLATE_HEIGHT = 120;
export const HEADER_HEIGHT = 40;

// Photo area (inside the frame)
export const PHOTO_X = PHOTO_PADDING;
export const PHOTO_Y = HEADER_HEIGHT;
export const PHOTO_WIDTH = CARD_WIDTH - PHOTO_PADDING * 2;
export const PHOTO_HEIGHT = CARD_HEIGHT - HEADER_HEIGHT - NAMEPLATE_HEIGHT - PHOTO_PADDING;

// ─── Rarity Color Palettes ─────────────────────────────────────────────
export interface RarityPalette {
  primary: string;      // border + glow
  secondary: string;    // accent lines
  glow: string;         // outer glow (with alpha)
  text: string;         // nameplate text
  background: string;   // nameplate bg
}

export const RARITY_PALETTES: Record<Rarity, RarityPalette> = {
  Common: {
    primary: "#9ca3af",
    secondary: "#6b7280",
    glow: "rgba(156,163,175,0.3)",
    text: "#9ca3af",
    background: "rgba(15,25,41,0.95)",
  },
  Uncommon: {
    primary: "#22c55e",
    secondary: "#16a34a",
    glow: "rgba(34,197,94,0.3)",
    text: "#22c55e",
    background: "rgba(15,25,41,0.95)",
  },
  Rare: {
    primary: "#3b82f6",
    secondary: "#2563eb",
    glow: "rgba(59,130,246,0.3)",
    text: "#3b82f6",
    background: "rgba(15,25,41,0.95)",
  },
  "Ultra Rare": {
    primary: "#a855f7",
    secondary: "#9333ea",
    glow: "rgba(168,85,247,0.3)",
    text: "#a855f7",
    background: "rgba(15,25,41,0.95)",
  },
  Legendary: {
    primary: "#f59e0b",
    secondary: "#d97706",
    glow: "rgba(245,158,11,0.4)",
    text: "#f59e0b",
    background: "rgba(15,25,41,0.95)",
  },
};

// ─── Frame Element Config ──────────────────────────────────────────────
export const BRACKET_SIZE = 30;        // corner bracket arm length
export const BRACKET_THICKNESS = 2;    // bracket line width
export const RETICLE_RADIUS = 40;      // targeting reticle circle
export const HEX_SIZE = 16;            // hex grid cell size
export const BORDER_WIDTH = 3;         // outer frame border
export const SCAN_LINE_HEIGHT = 2;     // static scan line
```

- [ ] **Step 2: Verify file compiles**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/card/frame-config.ts
git commit -m "feat: add card frame rarity palettes and dimension constants"
```

---

## Task 3: Build server-side Canvas drawing functions

**Files:**
- Create: `src/lib/card/draw-frame.ts`

This file contains pure drawing functions that take a Canvas context and draw frame elements. Each function is isolated so it can be composed.

- [ ] **Step 1: Create the drawing module**

```typescript
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { Rarity } from "@/types/nft";
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  PHOTO_X,
  PHOTO_Y,
  PHOTO_WIDTH,
  PHOTO_HEIGHT,
  NAMEPLATE_HEIGHT,
  HEADER_HEIGHT,
  BRACKET_SIZE,
  BRACKET_THICKNESS,
  RETICLE_RADIUS,
  HEX_SIZE,
  BORDER_WIDTH,
  SCAN_LINE_HEIGHT,
  type RarityPalette,
} from "./frame-config";

/** Canvas 2D context type derived from @napi-rs/canvas */
type Ctx = ReturnType<Canvas["getContext"]>;

// ─── Background ────────────────────────────────────────────────────────

export function drawBackground(ctx: Ctx) {
  ctx.fillStyle = "#080c14";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

// ─── Hex Grid Overlay ──────────────────────────────────────────────────

export function drawHexGrid(ctx: Ctx, palette: RarityPalette) {
  ctx.strokeStyle = palette.primary;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 0.5;

  const h = HEX_SIZE;
  const w = Math.sqrt(3) * h;
  const rows = Math.ceil(CARD_HEIGHT / (h * 1.5)) + 1;
  const cols = Math.ceil(CARD_WIDTH / w) + 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * w + (row % 2 === 1 ? w / 2 : 0);
      const y = row * h * 1.5;
      drawHexagon(ctx, x, y, h);
    }
  }
  ctx.globalAlpha = 1;
}

function drawHexagon(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

// ─── Outer Border ──────────────────────────────────────────────────────

export function drawBorder(ctx: Ctx, palette: RarityPalette) {
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = BORDER_WIDTH;
  ctx.strokeRect(
    BORDER_WIDTH / 2,
    BORDER_WIDTH / 2,
    CARD_WIDTH - BORDER_WIDTH,
    CARD_HEIGHT - BORDER_WIDTH
  );
}

// ─── Corner Brackets ───────────────────────────────────────────────────

export function drawCornerBrackets(ctx: Ctx, palette: RarityPalette) {
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = BRACKET_THICKNESS;
  const inset = BORDER_WIDTH + 6;
  const s = BRACKET_SIZE;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(inset, inset + s);
  ctx.lineTo(inset, inset);
  ctx.lineTo(inset + s, inset);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH - inset - s, inset);
  ctx.lineTo(CARD_WIDTH - inset, inset);
  ctx.lineTo(CARD_WIDTH - inset, inset + s);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(inset, CARD_HEIGHT - inset - s);
  ctx.lineTo(inset, CARD_HEIGHT - inset);
  ctx.lineTo(inset + s, CARD_HEIGHT - inset);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH - inset - s, CARD_HEIGHT - inset);
  ctx.lineTo(CARD_WIDTH - inset, CARD_HEIGHT - inset);
  ctx.lineTo(CARD_WIDTH - inset, CARD_HEIGHT - inset - s);
  ctx.stroke();
}

// ─── Targeting Reticle ─────────────────────────────────────────────────

export function drawReticle(ctx: Ctx, palette: RarityPalette) {
  const cx = CARD_WIDTH / 2;
  const cy = PHOTO_Y + PHOTO_HEIGHT / 2;
  const r = RETICLE_RADIUS;

  ctx.strokeStyle = palette.secondary;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;

  // Circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs
  const gap = 8;
  ctx.beginPath();
  ctx.moveTo(cx - r - 10, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(cx + r + 10, cy);
  ctx.moveTo(cx, cy - r - 10);
  ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap);
  ctx.lineTo(cx, cy + r + 10);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// ─── Scan Line ─────────────────────────────────────────────────────────

export function drawScanLine(ctx: Ctx, palette: RarityPalette) {
  // Static scan line at ~40% of photo height (for the captured image)
  const y = PHOTO_Y + PHOTO_HEIGHT * 0.4;
  const gradient = ctx.createLinearGradient(0, y, 0, y + 20);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.5, palette.glow);
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(PHOTO_X, y, PHOTO_WIDTH, 20);
}

// ─── HUD Data Readouts ─────────────────────────────────────────────────

export function drawHudReadouts(ctx: Ctx, palette: RarityPalette) {
  ctx.font = "10px monospace";
  ctx.fillStyle = palette.primary;
  ctx.globalAlpha = 0.4;

  // Left side readouts
  ctx.fillText("SYS ONLINE", BORDER_WIDTH + 10, PHOTO_Y + 20);
  ctx.fillText("TGT LOCK", BORDER_WIDTH + 10, PHOTO_Y + 35);

  // Right side readouts
  ctx.textAlign = "right";
  ctx.fillText("FRAME 00", CARD_WIDTH - BORDER_WIDTH - 10, PHOTO_Y + 20);
  ctx.fillText("SCAN OK", CARD_WIDTH - BORDER_WIDTH - 10, PHOTO_Y + 35);
  ctx.textAlign = "left";

  ctx.globalAlpha = 1;
}

// ─── Nameplate Bar ─────────────────────────────────────────────────────

export function drawNameplate(
  ctx: Ctx,
  palette: RarityPalette,
  suitName: string,
  rarity: string,
  pilotName: string,
  hp: number
) {
  const y = CARD_HEIGHT - NAMEPLATE_HEIGHT;

  // Background
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, y, CARD_WIDTH, NAMEPLATE_HEIGHT);

  // Top divider line
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(BORDER_WIDTH, y);
  ctx.lineTo(CARD_WIDTH - BORDER_WIDTH, y);
  ctx.stroke();

  // Suit name
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(suitName, PHOTO_X, y + 30, PHOTO_WIDTH);

  // Pilot name
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px sans-serif";
  ctx.fillText(`PILOT: ${pilotName}`, PHOTO_X, y + 50);

  // Rarity badge
  ctx.fillStyle = palette.primary;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "right";
  ctx.fillText(rarity.toUpperCase(), CARD_WIDTH - PHOTO_X, y + 30);

  // HP
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 14px monospace";
  ctx.fillText(`HP ${hp}`, CARD_WIDTH - PHOTO_X, y + 50);

  // GundariuM seal
  ctx.fillStyle = palette.secondary;
  ctx.globalAlpha = 0.6;
  ctx.font = "bold 9px monospace";
  ctx.fillText("GundariuM", CARD_WIDTH - PHOTO_X, y + NAMEPLATE_HEIGHT - 15);
  ctx.globalAlpha = 1;

  ctx.textAlign = "left";
}

// ─── Header Bar ────────────────────────────────────────────────────────

export function drawHeader(ctx: Ctx, palette: RarityPalette) {
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, CARD_WIDTH, HEADER_HEIGHT);

  // "GundariuM" top-left
  ctx.fillStyle = palette.primary;
  ctx.globalAlpha = 0.5;
  ctx.font = "bold 11px monospace";
  ctx.fillText("GundariuM", PHOTO_X, HEADER_HEIGHT - 12);

  // Decorative line
  ctx.strokeStyle = palette.primary;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(BORDER_WIDTH, HEADER_HEIGHT);
  ctx.lineTo(CARD_WIDTH - BORDER_WIDTH, HEADER_HEIGHT);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// ─── Full Frame Composite ──────────────────────────────────────────────

export interface RenderCardInput {
  /** Raw photo as Buffer (JPEG/PNG) */
  photoBuffer: Buffer;
  suitName: string;
  rarity: Rarity;
  pilotName: string;
  hp: number;
  palette: RarityPalette;
}

export async function renderCard(input: RenderCardInput): Promise<Buffer> {
  const { Image } = await import("@napi-rs/canvas");
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");

  // 1. Dark background
  drawBackground(ctx);

  // 2. Hex grid overlay
  drawHexGrid(ctx, input.palette);

  // 3. Place user's photo
  const photo = new Image();
  photo.src = input.photoBuffer;

  // Cover-fit the photo into the photo area
  const scale = Math.max(
    PHOTO_WIDTH / photo.width,
    PHOTO_HEIGHT / photo.height
  );
  const sw = PHOTO_WIDTH / scale;
  const sh = PHOTO_HEIGHT / scale;
  const sx = (photo.width - sw) / 2;
  const sy = (photo.height - sh) / 2;

  ctx.drawImage(photo, sx, sy, sw, sh, PHOTO_X, PHOTO_Y, PHOTO_WIDTH, PHOTO_HEIGHT);

  // 4. Frame overlays (on top of photo)
  drawReticle(ctx, input.palette);
  drawScanLine(ctx, input.palette);
  drawHudReadouts(ctx, input.palette);
  drawCornerBrackets(ctx, input.palette);
  drawBorder(ctx, input.palette);
  drawHeader(ctx, input.palette);
  drawNameplate(ctx, input.palette, input.suitName, input.rarity, input.pilotName, input.hp);

  return Buffer.from(canvas.toBuffer("image/png"));
}
```

- [ ] **Step 2: Verify file compiles**

```bash
npm run build
```

Expected: Build succeeds (the canvas import is server-only, so no client bundling issues).

- [ ] **Step 3: Commit**

```bash
git add src/lib/card/draw-frame.ts
git commit -m "feat: add server-side card frame drawing functions"
```

---

## Task 4: Build the `/api/render-card` API route

**Files:**
- Create: `src/app/api/render-card/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { renderCard } from "@/lib/card/draw-frame";
import { RARITY_PALETTES } from "@/lib/card/frame-config";
import type { Rarity } from "@/types/nft";

export const maxDuration = 10; // seconds — canvas rendering can be slow with large photos

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("image") as File | null;
    const suitName = form.get("suitName") as string | null;
    const rarity = form.get("rarity") as Rarity | null;
    const pilotName = form.get("pilotName") as string | null;
    const hp = Number(form.get("hp") ?? 0);

    if (!file || !suitName || !rarity || !pilotName) {
      return NextResponse.json(
        { error: "Missing required fields: image, suitName, rarity, pilotName, hp" },
        { status: 400 }
      );
    }

    const palette = RARITY_PALETTES[rarity];
    if (!palette) {
      return NextResponse.json(
        { error: `Invalid rarity: ${rarity}` },
        { status: 400 }
      );
    }

    const photoBuffer = Buffer.from(await file.arrayBuffer());

    const cardPng = await renderCard({
      photoBuffer,
      suitName,
      rarity,
      pilotName,
      hp,
      palette,
    });

    return new NextResponse(cardPng, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(cardPng.length),
      },
    });
  } catch (err) {
    console.error("[render-card]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Render failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test manually with curl**

Start the dev server (`npm run dev`), then test with a sample image:

```bash
curl -X POST http://localhost:3000/api/render-card \
  -F "image=@/path/to/any-gunpla-photo.jpg" \
  -F "suitName=RX-78-2 Gundam" \
  -F "rarity=Legendary" \
  -F "pilotName=Amuro Ray" \
  -F "hp=1050" \
  --output test-card.png
```

Expected: `test-card.png` is a 600x900 PNG showing the Gunpla photo inside the HUD/Holo frame with gold Legendary coloring, hex grid, brackets, reticle, and nameplate.

Open `test-card.png` and visually verify all frame elements are present and properly positioned. Test with each rarity to confirm color schemes.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/render-card/route.ts
git commit -m "feat: add /api/render-card for server-side card frame compositing"
```

---

## Task 5: Build client-side `CardFrame` preview component

**Files:**
- Create: `src/components/card/CardFrame.tsx`

This component recreates the HUD/Holo Hex frame as pure HTML/CSS for live browser preview. It does NOT use Canvas — it's the same visual language as the approved mockup, implemented as a React component.

- [ ] **Step 1: Create the CardFrame component**

```tsx
"use client";

import type { Rarity } from "@/types/nft";

const RARITY_COLORS: Record<Rarity, { primary: string; glow: string }> = {
  Common: { primary: "#9ca3af", glow: "rgba(156,163,175,0.3)" },
  Uncommon: { primary: "#22c55e", glow: "rgba(34,197,94,0.3)" },
  Rare: { primary: "#3b82f6", glow: "rgba(59,130,246,0.3)" },
  "Ultra Rare": { primary: "#a855f7", glow: "rgba(168,85,247,0.3)" },
  Legendary: { primary: "#f59e0b", glow: "rgba(245,158,11,0.4)" },
};

interface CardFrameProps {
  imageUrl: string;
  suitName: string;
  rarity: Rarity;
  pilotName: string;
  hp: number;
}

export function CardFrame({ imageUrl, suitName, rarity, pilotName, hp }: CardFrameProps) {
  const colors = RARITY_COLORS[rarity];

  return (
    <div
      className="relative w-full max-w-[300px] aspect-[2/3] overflow-hidden"
      style={{
        border: `2px solid ${colors.primary}`,
        boxShadow: `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}`,
        background: "#080c14",
      }}
    >
      {/* Hex grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='${encodeURIComponent(colors.primary)}' fill-opacity='0.06'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Header bar */}
      <div
        className="relative h-[8%] flex items-center px-3"
        style={{
          background: "rgba(15,25,41,0.95)",
          borderBottom: `1px solid ${colors.primary}33`,
        }}
      >
        <span
          className="font-mono text-[10px] font-bold tracking-wider"
          style={{ color: colors.primary, opacity: 0.5 }}
        >
          GundariuM
        </span>
      </div>

      {/* Photo area */}
      <div className="relative" style={{ height: "65%" }}>
        <img
          src={imageUrl}
          alt={suitName}
          className="w-full h-full object-cover"
        />

        {/* Scan line animation */}
        <div
          className="absolute left-0 w-full h-[3%] pointer-events-none animate-[scan_3s_ease-in-out_infinite]"
          style={{
            background: `linear-gradient(transparent, ${colors.glow}, transparent)`,
          }}
        />

        {/* Targeting reticle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-20 h-20 rounded-full"
            style={{
              border: `1px solid ${colors.primary}25`,
            }}
          />
          {/* Crosshair lines */}
          <div
            className="absolute w-24 h-px"
            style={{ background: `${colors.primary}20` }}
          />
          <div
            className="absolute h-24 w-px"
            style={{ background: `${colors.primary}20` }}
          />
        </div>

        {/* HUD readouts */}
        <div
          className="absolute top-2 left-2 font-mono text-[8px] leading-relaxed pointer-events-none"
          style={{ color: colors.primary, opacity: 0.4 }}
        >
          <div>SYS ONLINE</div>
          <div>TGT LOCK</div>
        </div>
        <div
          className="absolute top-2 right-2 font-mono text-[8px] leading-relaxed text-right pointer-events-none"
          style={{ color: colors.primary, opacity: 0.4 }}
        >
          <div>FRAME 00</div>
          <div>SCAN OK</div>
        </div>
      </div>

      {/* Corner brackets */}
      <CornerBrackets color={colors.primary} />

      {/* Nameplate */}
      <div
        className="absolute bottom-0 left-0 right-0 px-3 py-2 space-y-0.5"
        style={{
          height: "27%",
          background: "rgba(15,25,41,0.95)",
          borderTop: `1px solid ${colors.primary}`,
        }}
      >
        <p className="text-white font-bold text-sm truncate">{suitName}</p>
        <p className="text-slate-400 text-[10px]">PILOT: {pilotName}</p>
        <div className="flex items-center justify-between pt-1">
          <span
            className="font-mono text-[10px] font-bold"
            style={{ color: colors.primary }}
          >
            {rarity.toUpperCase()}
          </span>
          <span className="font-mono text-xs font-bold text-white">
            HP {hp}
          </span>
        </div>
        <div className="flex justify-end pt-0.5">
          <span
            className="font-mono text-[8px] font-bold"
            style={{ color: colors.primary, opacity: 0.6 }}
          >
            GundariuM
          </span>
        </div>
      </div>
    </div>
  );
}

function CornerBrackets({ color }: { color: string }) {
  const style = { borderColor: color };
  const base = "absolute w-6 h-6 pointer-events-none";

  return (
    <>
      <div className={`${base} top-[9%] left-1`} style={{ ...style, borderLeft: `2px solid ${color}`, borderTop: `2px solid ${color}` }} />
      <div className={`${base} top-[9%] right-1`} style={{ ...style, borderRight: `2px solid ${color}`, borderTop: `2px solid ${color}` }} />
      <div className={`${base} bottom-[28%] left-1`} style={{ ...style, borderLeft: `2px solid ${color}`, borderBottom: `2px solid ${color}` }} />
      <div className={`${base} bottom-[28%] right-1`} style={{ ...style, borderRight: `2px solid ${color}`, borderBottom: `2px solid ${color}` }} />
    </>
  );
}
```

- [ ] **Step 2: Add scan animation keyframe to `globals.css`**

Add this to `src/app/globals.css` alongside the existing animations:

```css
@keyframes scan {
  0%, 100% { top: 0%; }
  50% { top: 97%; }
}
```

- [ ] **Step 3: Verify visually**

Temporarily import `CardFrame` in any page and render it with test data. Confirm:
- Frame border and glow match rarity color
- Hex grid overlay is subtle but visible
- Corner brackets are positioned correctly
- Photo fills the area with cover-fit
- Nameplate shows suit name, pilot, rarity, HP
- Scan line animates up and down
- Test all 5 rarity tiers

- [ ] **Step 4: Commit**

```bash
git add src/components/card/CardFrame.tsx src/app/globals.css
git commit -m "feat: add CardFrame client-side preview component with HUD/Holo design"
```

---

## Task 6: Add `card_preview` step to mint store and page

**Files:**
- Modify: `src/store/useMintStore.ts`
- Modify: `src/app/mint/page.tsx`

- [ ] **Step 1: Add step to store**

In `src/store/useMintStore.ts`, add `"card_preview"` to the `MintStep` union:

```typescript
export type MintStep =
  | "suit_search"
  | "grade_select"
  | "idle"
  | "uploading"
  | "analyzing"
  | "reviewing"
  | "card_preview"   // ← new
  | "confirming"
  | "success";
```

- [ ] **Step 2: Update mint page progress and routing**

In `src/app/mint/page.tsx`:

Add import:
```typescript
import { CardPreview } from "@/components/mint/CardPreview";
```

Update `STEP_LABELS`:
```typescript
card_preview: "Preview your GundariuM card",
```

Update `PROGRESS_STEPS`:
```typescript
const PROGRESS_STEPS = ["suit_search", "grade_select", "idle", "reviewing", "card_preview", "confirming", "success"] as const;
```

Update `currentProgressIndex` in the `MintFlow` component:
```typescript
const currentProgressIndex = (() => {
  if (step === "suit_search") return 0;
  if (step === "grade_select") return 1;
  if (step === "idle" || step === "uploading" || step === "analyzing") return 2;
  if (step === "reviewing") return 3;
  if (step === "card_preview") return 4;   // ← new
  if (step === "confirming") return 5;
  return 6;
})();
```

Add conditional render:
```tsx
{step === "card_preview" && <CardPreview />}
```

- [ ] **Step 3: Commit**

```bash
git add src/store/useMintStore.ts src/app/mint/page.tsx
git commit -m "feat: add card_preview step to mint state machine and page routing"
```

---

## Task 7: Build the `CardPreview` mint step component

**Files:**
- Create: `src/components/mint/CardPreview.tsx`

This component shows the user their card with the HUD/Holo frame applied. It uses the `CardFrame` component for the live browser preview.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMintStore } from "@/store/useMintStore";
import { CardFrame } from "@/components/card/CardFrame";
import type { Rarity } from "@/types/nft";

export function CardPreview() {
  const { traits, imagePreviewUrl, goTo } = useMintStore();

  if (!traits || !imagePreviewUrl) {
    return null;
  }

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-6">
      {/* Card preview with frame */}
      <CardFrame
        imageUrl={imagePreviewUrl}
        suitName={traits.name}
        rarity={traits.rarity}
        pilotName={traits.pilotName}
        hp={traits.hp}
      />

      {/* Info text */}
      <p className="text-[var(--foreground)]/50 text-xs text-center max-w-xs">
        This is how your GundariuM card will appear. The HUD frame is included free with every mint.
      </p>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-2 w-full max-w-sm">
        <button
          onClick={() => goTo("confirming")}
          className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          CONFIRM & MINT →
        </button>
        <button
          onClick={() => goTo("reviewing")}
          className="w-full py-2 text-[var(--foreground)]/40 text-sm hover:text-[var(--foreground)]/60 transition-colors"
        >
          ← Back to traits
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/mint/CardPreview.tsx
git commit -m "feat: add CardPreview mint step showing framed card before confirm"
```

---

## Task 8: Wire TraitReview to advance to `card_preview`

**Files:**
- Modify: `src/components/mint/TraitReview.tsx`

- [ ] **Step 1: Update the continue handler**

In `src/components/mint/TraitReview.tsx`, change:

```typescript
const handleContinue = () => {
  goTo("confirming");
};
```

to:

```typescript
const handleContinue = () => {
  goTo("card_preview");
};
```

And update the button text:

```tsx
CONFIRM TRAITS →
```

to:

```tsx
PREVIEW CARD →
```

- [ ] **Step 2: Verify flow**

Run `npm run dev`, walk through the full mint flow:
1. Search for a suit (e.g. "RX-78-2 Gundam")
2. Select a grade (e.g. MG)
3. Upload any photo
4. Review traits → click "PREVIEW CARD"
5. **New step:** See the card with HUD/Holo frame applied
6. Click "CONFIRM & MINT" to continue to the existing confirm flow

Expected: The card preview shows the photo inside the branded frame with correct rarity coloring.

- [ ] **Step 3: Commit**

```bash
git add src/components/mint/TraitReview.tsx
git commit -m "feat: wire TraitReview to advance to card_preview step"
```

---

## Task 9: Update MintConfirm to render the framed card before IPFS upload

**Files:**
- Modify: `src/components/mint/MintConfirm.tsx`
- Modify: `src/app/api/mint-metadata/route.ts`

Currently, `MintConfirm` uploads the raw photo to IPFS via `/api/mint-metadata`. Now it needs to:
1. Call `/api/render-card` to get the composited card PNG
2. Send that PNG to `/api/mint-metadata` instead of the raw photo

- [ ] **Step 1: Update MintConfirm to render card before uploading**

In `src/components/mint/MintConfirm.tsx`, replace the `uploadToIPFS` function:

```typescript
const uploadToIPFS = async () => {
  try {
    // Step 1: Render the framed card
    const renderForm = new FormData();
    renderForm.append("image", imageFile!);
    renderForm.append("suitName", traits!.name);
    renderForm.append("rarity", traits!.rarity);
    renderForm.append("pilotName", traits!.pilotName);
    renderForm.append("hp", String(traits!.hp));

    const renderRes = await fetch("/api/render-card", {
      method: "POST",
      body: renderForm,
    });

    if (!renderRes.ok) {
      const text = await renderRes.text();
      let msg = "Card rendering failed";
      try { msg = JSON.parse(text).error ?? msg; } catch {}
      throw new Error(msg);
    }

    const cardBlob = await renderRes.blob();
    const cardFile = new File([cardBlob], "card.png", { type: "image/png" });

    // Step 2: Upload rendered card to IPFS
    const uploadForm = new FormData();
    uploadForm.append("image", cardFile);
    uploadForm.append(
      "traits",
      new Blob([JSON.stringify(traits)], { type: "application/json" }),
      "traits.json"
    );

    const res = await fetch("/api/mint-metadata", {
      method: "POST",
      body: uploadForm,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setImageIpfsHash(data.imageHash);
    setMetadataUri(data.metadataUri);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Card rendering or IPFS upload failed");
  }
};
```

- [ ] **Step 2: Update the uploading status text**

Change the loading indicator text from `UPLOADING TO IPFS…` to show the two-phase process:

```tsx
{isUploading && (
  <div className="flex items-center justify-center gap-3 py-2">
    <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    <span className="text-[var(--accent)] text-sm font-[family-name:var(--font-orbitron)]">
      RENDERING & UPLOADING…
    </span>
  </div>
)}
```

- [ ] **Step 3: Update back button to go to card_preview**

Change the back button at the bottom of MintConfirm:

```tsx
<button
  onClick={() => goTo("card_preview")}
  className="text-[var(--foreground)]/40 text-sm hover:text-[var(--foreground)]/60 transition-colors"
>
  ← Back to preview
</button>
```

- [ ] **Step 4: Verify end-to-end**

Run `npm run dev`, walk through the complete mint flow:
1. Select suit → grade → upload photo → review traits → preview card
2. Click "CONFIRM & MINT"
3. Watch the status: "RENDERING & UPLOADING…" should appear
4. After upload completes, "IPFS ✓" should show
5. Approve USDC → Mint → Success

Verify on IPFS: fetch the minted card's image URI and confirm it shows the framed card (not the raw photo).

- [ ] **Step 5: Commit**

```bash
git add src/components/mint/MintConfirm.tsx
git commit -m "feat: render framed card server-side before IPFS upload during mint"
```

---

## Task 10: Visual polish and edge cases

**Files:**
- Modify: `src/components/card/CardFrame.tsx` (if needed)
- Modify: `src/lib/card/draw-frame.ts` (if needed)

- [ ] **Step 1: Test all 5 rarity tiers visually**

Mint (or preview) cards at each rarity and screenshot:
- Common (SD/HG) — steel/grey
- Uncommon (RG) — green
- Rare (MG) — blue
- Ultra Rare (MG Ver.Ka / Hi-RM) — purple
- Legendary (PG) — gold

Confirm colors match the approved mockup. Adjust `RARITY_PALETTES` in `frame-config.ts` if needed.

- [ ] **Step 2: Test with various photo aspect ratios**

Upload photos that are:
- Square (1:1)
- Landscape (16:9)
- Portrait (9:16)
- Very tall/narrow

Confirm the cover-fit crop looks reasonable in both the client preview (`CardFrame`) and the server render (`draw-frame.ts`).

- [ ] **Step 3: Compare client preview vs server render**

Side-by-side compare the `CardFrame` HTML/CSS preview with the `/api/render-card` PNG output. They should look visually similar (they won't be pixel-perfect since one is HTML and one is Canvas, but the layout, colors, and feel should match).

Adjust either component as needed to bring them closer together.

- [ ] **Step 4: Commit any adjustments**

```bash
git add src/components/card/CardFrame.tsx src/lib/card/draw-frame.ts src/lib/card/frame-config.ts
git commit -m "fix: polish card frame visual consistency across rarity tiers and aspect ratios"
```

---

## Verification Checklist

Before marking Phase 1 complete:

- [ ] `npm run build` succeeds with no errors
- [ ] `npm run lint` passes
- [ ] Full mint flow works: suit → grade → photo → traits → **card preview** → confirm → mint → success
- [ ] The minted NFT image on IPFS shows the framed card (not a raw photo)
- [ ] All 5 rarity tiers render with correct colors in both client preview and server output
- [ ] The card frame matches the approved HUD/Holo Hex mockup design
- [ ] Back navigation works at every step
- [ ] No console errors in browser or server logs
