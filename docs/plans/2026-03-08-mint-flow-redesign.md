# Mint Flow Redesign — GundariuM
**Date:** 2026-03-08
**Status:** Approved
**Author:** Josh Grubbs + Larry (Claude)

---

## Overview

Replace AI-based suit recognition with a user-driven suit selection flow. The cosmetics and upgrades system becomes the product's shining star. Anti-abuse protection via Cloudflare Turnstile + KV.

---

## Mint Flow (8 Steps)

### Step 1 — Suit Search
- Autocomplete text input backed by static `src/data/suits.json`
- Fuzzy search via **fuse.js** (client-side, no API call)
- User types suit name, dropdown shows matching results
- Each result shows: suit name, series, thumbnail (optional)

### Step 2 — Grade Select
- Dynamically shows only grades Bandai actually produced for the selected suit
- Sourced from `suits.json` (each suit has a `grades[]` array)
- Selecting grade locks in rarity tier

### Step 3 — Photo Upload
- Same PhotoDropzone component (max 1400px, JPEG 0.85 compression)
- No AI analysis — photo is purely for the card image
- User confirms photo before proceeding

### Step 4 — Trait Review
- Stats (HP, primary/secondary/tertiary/special damage) generated via **RNG within grade-appropriate ranges**
- Canonical data (pilot, faction, weapons, series, armor type) pulled from `suits.json` — not editable
- **1 free roll on arrival**
- **2 paid re-rolls at $0.50 USDC each** (3 total attempts)
- After 3 re-rolls: **20-minute lockout**
- Failure detector (see Anti-Abuse section)

### Step 5 — Cosmetics
- **Free random cosmetic roll on arrival** — user sees a randomized border/paint/decal combo
- User may **opt out** entirely and proceed with no cosmetics
- Paid upgrades in **GNDM token**:
  - Packages: $2 / $5 / $10 GNDM equivalent (contents TBD)
  - Ala carte options (TBD)
- Failure detector applied here (see Anti-Abuse section)

### Step 6 — Upgrades
- Optional: pay GNDM to upgrade weapon damage, armor resistance, or HP
- Specific pricing and upgrade increments TBD
- User may **opt out** ("Deploy My Suit") and proceed to mint
- Failure detector applied here

### Step 7 — Confirm & Mint
- Mint price: **$2 USDC**
- Standard USDC approve → mintCard flow
- Failure detector applied here
- **Cheating will not be tolerated**

### Step 8 — Success
- Display minted card with all traits, cosmetics, and upgrades
- Link to BaseScan transaction
- Share to Farcaster option

---

## Data Architecture

### suits.json Schema
```json
{
  "id": "rx-78-2",
  "name": "RX-78-2 Gundam",
  "series": "Mobile Suit Gundam [Universal Century]",
  "faction": "Earth Federation Forces",
  "pilot": "Amuro Ray",
  "armorType": "Luna Titanium",
  "weapons": {
    "primary": "Beam Rifle",
    "secondary": "Beam Saber",
    "tertiary": "Hyper Bazooka",
    "special": "Final Shooting"
  },
  "grades": ["HG", "RG", "MG", "MG_VERKA", "PG"],
  "stats": {
    "hp": { "min": 800, "max": 1200 },
    "primaryDamage": { "min": 200, "max": 400 },
    "secondaryDamage": { "min": 150, "max": 350 },
    "tertiaryDamage": { "min": 100, "max": 250 },
    "specialDamage": { "min": 400, "max": 700 }
  }
}
```

Stat ranges scale with grade rarity (PG rolls higher than HG).

### Data Sources
- Primary: community database cross-referenced from Newtype.org + Gundam Wiki
- Initial build: ~300 most popular suits, expandable
- Migration path to Supabase/database later requires only a fetch() swap — schema stays identical

---

## Anti-Abuse System

### Cloudflare Turnstile
- Invisible human verification widget initialized at Step 1 (Suit Search)
- Token validated server-side on first API call
- Does not interfere with Claude API or other server-to-server calls

### Cloudflare KV — Lockout Tracking
Keys stored per wallet address and Farcaster FID:

| Key Pattern | Value | TTL |
|---|---|---|
| `rerolls:{wallet}:{mintSession}` | count (0-2) | 24h |
| `failures:{wallet}:{hourTimestamp}` | count | 1h |
| `lockout:{wallet}` | `"20min"` or `"24h"` | 20min or 24h |
| `lockout:{fid}` | `"20min"` or `"24h"` | 20min or 24h |

### Lockout Rules (applied at Steps 4, 5, 6, 7)
- **Re-rolls exhausted** (3 total at Step 4): 20-minute lockout
- **7 contract failures**: 20-minute lockout on wallet + FID
- **14+ failures in 1 hour**: 24-hour lockout on wallet + FID
- Lockout UI shows countdown timer and reason

### Contract Failure Detector
- Wraps every on-chain call (approve, reroll, cosmetic, upgrade, mint)
- On catch: increments `failures:{wallet}:{hour}` in KV
- Distinguishes user rejections (not a failure) from contract reverts (failure)
- After 7 failures: lockout triggered
- Protects against: infinite retry loops, exploit attempts, design flaws

---

## Tech Stack Additions

| Addition | Purpose |
|---|---|
| `fuse.js` | Client-side fuzzy suit search |
| `@cloudflare/turnstile` | Human verification |
| Cloudflare KV | Lockout/re-roll state |
| `src/data/suits.json` | Static suits database |
| fal.ai `nano-banana-2` | Cosmetic image generation ($0.08/image) |
| GNDM token payments | Cosmetics + upgrades |

---

## Revenue Model

| Item | Price | Currency |
|---|---|---|
| Mint | $2 | USDC |
| Re-roll (x2 max) | $0.50 each | USDC |
| Cosmetic packages | $2 / $5 / $10 | GNDM |
| Ala carte cosmetics | TBD | GNDM |
| Stat upgrades | TBD | GNDM |

---

## What Is NOT Changing
- Smart contract core (mintCard, updateCosmetics) — additions only
- IPFS/Pinata metadata upload
- Farcaster miniapp integration
- ConnectButton / wagmi setup
- buy-gndm page

---

## Open Items (TBD)
- Cosmetic package contents ($2/$5/$10 tiers)
- Ala carte cosmetic options and pricing
- Upgrade increment amounts and GNDM pricing
- Suits database initial population (~300 suits)
- fal.ai cosmetic generation prompt templates
