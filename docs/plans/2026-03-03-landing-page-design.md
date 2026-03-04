# Landing Page + Navbar Upgrade — Design Doc
_2026-03-03_

## Overview

Upgrade the GundariuM site with a responsive navbar (all screen sizes) and a full marketing home page that pitches both the game and the GNDM token, with a buy CTA linking to the existing `/buy-gndm` swap page.

## Scope

- **`src/components/nav/Navbar.tsx`** — full rewrite for responsive mobile/desktop nav
- **`src/app/page.tsx`** — full rewrite as marketing landing page
- Middleware and `/buy-gndm` page unchanged

---

## Navbar

### Desktop
- Logo left · nav links center · Connect Wallet button right
- Active link highlighted in `--accent` cyan

### Mobile
- Logo left · hamburger icon right
- Tap opens full-width dropdown: all links stacked + Connect Wallet at bottom
- Toggle managed with React `useState`, no extra libraries

### Links (all screens)
`Home` · `Mint` · `Arena` · `Battle` · `Collection` · `Leaderboard` · `Buy GNDM` (accent-highlighted)

> Middleware keeps game pages redirected in production. Nav links are present but pages are gated server-side.

---

## Home Page Sections

### 1. Hero
- Large Orbitron headline + tagline with animated cyan glow
- Two CTAs: `BUY GNDM 🔥` (primary, links to `/buy-gndm`) and `Learn More` (smooth-scrolls to game loop section)

### 2. Game Loop Strip
Three-step horizontal visual:
```
📸 PHOTOGRAPH  →  🤖 AI MINTS  →  ⚔️ BATTLE
Your Gunpla        Your NFT Card      The Multiverse
```

### 3. Feature Cards
Three cards (existing content, redesigned):
- Photo → NFT
- Turn-Based Combat
- GNDM Economy

### 4. GNDM Token Section
- Live price ticker reusing `/api/gndm-quote` (0.01 ETH → GNDM, 30s refresh)
- Token utility: PVP entry, suit upgrades, prize pools
- "How to earn" blurb

### 5. Final CTA Banner
Full-width glowing section: "Ready to fight?" → `BUY GNDM 🔥` button → `/buy-gndm`

---

## Constraints
- Dark sci-fi theme: `--background: #080c14`, `--accent: #00d4ff`, `--accent-2: #7c3aed`
- Orbitron font for headings, Geist Sans for body
- No new npm packages
- TypeScript strict, no `tsc` errors
