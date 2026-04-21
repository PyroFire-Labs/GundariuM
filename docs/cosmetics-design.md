# AI Cosmetics — Design Document

**Status:** Approved (2026-03-25)
**Author:** Joshua + Claude brainstorm session

---

## Overview

Every GundariuM card gets a free branded HUD/Holo Hex card frame with rarity coloring. Users can optionally purchase premium cosmetics (frame upgrades, decals, color manipulation, AI repaints) at mint time or post-mint. All cosmetic state is stored on-chain in an expanded `CardTraits` struct.

---

## Card Frame (Free — Every Card)

- **Style:** HUD + Holographic Hex fusion
  - Corner brackets (targeting reticle)
  - Hex grid overlay (holographic data field)
  - Scan line animation
  - Side data readouts (monospace HUD text)
  - Nameplate bar (suit name, rarity, GundariuM seal)
- **Rarity color schemes:**
  - Common — Steel (grey)
  - Uncommon — Green (GN particle)
  - Rare — Blue
  - Ultra Rare — Purple
  - Legendary — Gold/Amber

---

## Cosmetic Tiers & Pricing

| Tier | Type | Price (USDC) | Tech |
|------|------|-------------|------|
| Free | Base GundariuM HUD frame | $0.00 | CSS/SVG + Canvas compositing |
| 1 | Frame upgrades (faction themes, elite skins, animated) | $0.50 | CSS/SVG + Canvas compositing |
| 1 | Decals & stickers (faction emblems, battle marks) | $0.50 | PNG compositing |
| 1 | Color manipulation (hue shift, tint) | $0.50 | Canvas color filters |
| 2 | AI Repaint (style gallery) | $2.00 | Gemini 3 Pro Image API (~$0.13-0.24/gen) |

---

## AI Repaint Style Gallery (12 Styles at Launch)

### Weathering
1. **Desert Storm** — Sand-blasted, faded paint, dust accumulation
2. **Arctic Ops** — Frost/ice buildup, white-blue weathering, cracked paint
3. **Battle Scarred** — Scorch marks, bullet holes, chipped armor panels
4. **Deep Space Corroded** — Oxidation, pitting, vacuum exposure damage

### Tactical
5. **Urban Camo** — Grey/black/white geometric camo pattern
6. **Forest Camo** — Green/brown/tan organic camo
7. **Stealth Black** — Matte black with subtle panel line contrast
8. **Titan Chrome** — Mirror chrome/polished metal finish

### Fantasy
9. **Neon Cyberpunk** — Glowing neon accents, dark base, cyberpunk palette
10. **Blood Red Ace** — Deep crimson repaint (Char Aznable vibes)
11. **Ghost White** — Ethereal white with pale blue glow effects
12. **Gold Plated** — Full gold/brass finish, ornamental

**Preview strategy:** Pre-generated gallery images (3-4 representative suits per style, ~40-48 total images). Stored in `public/data/repaint-gallery/`. One-time generation cost: ~$1-2.

---

## Rendering Pipeline

**Hybrid approach:** Client-side preview + server-side final render.

- **Client preview:** Card frame rendered as HTML/CSS in the browser (live, interactive)
- **Server render:** `POST /api/render-card` composites the final PNG via `@napi-rs/canvas`
- **AI repaint:** `POST /api/generate-repaint` calls Gemini 3 Pro Image API
- **Upload:** `POST /api/upload-card` sends rendered card + metadata to IPFS via Pinata

### Mint-Time Flow
```
suit_search → grade_select → idle (photo) → reviewing (traits)
→ cosmetics_select (optional paid add-ons)
→ card_preview (live browser preview)
→ confirming (USDC approve + mint) → success
→ [if cosmetics selected] → updateCosmetics() / updateRepaint() on-chain
```

**Sequential payment:** Mint includes free base frame. Cosmetics are separate USDC transactions post-mint.

### Post-Mint Flow
- Collection page → "Customize" button per card
- Same CosmeticsMenu + CardPreview components
- `updateCosmetics()` / `updateRepaint()` on-chain
- Re-render card image → re-upload to IPFS → update tokenURI

---

## Smart Contract Changes (GunplaCard.sol)

### Expanded CardTraits struct
```solidity
// Add to END of existing struct (storage layout safe for UUPS upgrade)
uint8  frameId;        // 0 = base GundariuM frame (free), 1+ = premium
uint8  colorShift;     // hue rotation: 0 = none, 1-180 = degrees
uint8  repaintStyle;   // 0 = none, 1-12 = AI repaint gallery style
```

Existing `repaintColor` (string) and `decalId` (string) stay as-is.

### New state variable
```solidity
uint256 public repaintPriceUsdc;  // $2.00 = 2_000_000
```

### New/updated functions
```solidity
// $0.50 tier — frame, decal, color shift, tint
function updateCosmetics(
    uint256 tokenId,
    uint8   frameId,
    string calldata decalId,
    string calldata repaintColor,
    uint8   colorShift,
    string calldata newTokenUri
) external;

// $2.00 tier — AI repaint
function updateRepaint(
    uint256 tokenId,
    uint8   repaintStyle,
    string calldata newTokenUri
) external;

// Admin
function setRepaintPrice(uint256 newPrice) external onlyOwner;
```

### New events
```solidity
event CosmeticsUpdatedV2(uint256 indexed tokenId, uint8 frameId, string decalId, uint8 colorShift);
event RepaintApplied(uint256 indexed tokenId, uint8 repaintStyle);
event RepaintPriceUpdated(uint256 newPrice);
```

---

## Frontend Architecture

### New Zustand store: `useCosmeticsStore`
- `selectedFrame` (0 = base, 1+ = premium)
- `selectedDecal` (string ID or null)
- `colorShift` (0-360 hue rotation)
- `tintColor` (hex string or null)
- `repaintStyle` (0 = none, 1-12)
- `totalCosmeticCost` (computed)

### New components
```
CosmeticsMenu
├── FrameTab       — grid of frame skins
├── DecalTab       — grid of decal stickers
├── ColorTab       — hue slider + tint color picker
├── RepaintTab     — style gallery with example images
└── CostSummary    — running total + "NEXT: PREVIEW" button

CardPreview        — live HTML/CSS card render with all cosmetics applied
CardFrame          — reusable card frame component (all 5 rarity tiers)
```

### API routes
| Route | Purpose |
|---|---|
| `POST /api/render-card` | Photo + traits + cosmetics → final card PNG via @napi-rs/canvas |
| `POST /api/generate-repaint` | Photo + style ID → Gemini 3 Pro Image → repainted photo |
| `POST /api/upload-card` | Rendered card + metadata → IPFS via Pinata → CIDs |

### UX Safety
- Button locks immediately on click (prevents double-submit)
- Progress indicator: "Rendering card..." → "Uploading to IPFS..." → "Approve USDC..." → "Minting..."
- Re-enables with error message on failure

---

## Environment Variables (New)

| Variable | Purpose |
|---|---|
| `GOOGLE_AI_API_KEY` | Gemini API key for AI repaint generation |

---

## Implementation Phases

### Phase 1 — Card Frame Renderer
1. Build `CardFrame` React component (all 5 rarity tiers)
2. Build `/api/render-card` with `@napi-rs/canvas`
3. Wire into mint flow with base free frame
4. Test: mint on Sepolia with framed image

### Phase 2 — Cosmetics Menu UI
5. Create `useCosmeticsStore`
6. Build `CosmeticsMenu` (4 tabs)
7. Build `CardPreview` (live browser preview)
8. Add `cosmetics_select` + `card_preview` mint steps
9. Create frame skin + decal assets
10. Test: full mint flow with cosmetics selection

### Phase 3 — On-Chain Cosmetics
11. Expand `CardTraits` struct + tiered pricing in contract
12. Foundry tests
13. Deploy to Base Sepolia
14. Wire frontend cosmetic purchase flow
15. Build post-mint cosmetics on collection page
16. Test: full purchase + on-chain verification

### Phase 4 — AI Repaint
17. Build `/api/generate-repaint` (Gemini 3 Pro Image)
18. Generate 12-style gallery previews (batch)
19. Wire RepaintTab + purchase flow
20. Full `updateRepaint()` end-to-end flow
21. Test: AI repaint purchase on Sepolia

### Phase 5 — Polish & Launch Prep
22. Button locking + progress indicators
23. Error handling + retry logic
24. Mobile responsiveness
25. Cosmetics gallery page (marketing)
