# GundariuM Whitepaper

**Version 2.0 — April 14, 2026**
**PyroFire Labs**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [The Core Loop](#2-the-core-loop)
3. [Design Philosophy](#3-design-philosophy)
4. [Card System](#4-card-system)
5. [Battle System](#5-battle-system)
6. [$GNDM Tokenomics](#6-gndm-tokenomics)
7. [Smart Contracts](#7-smart-contracts)
8. [Technology & Infrastructure](#8-technology--infrastructure)
9. [Multi-Chain Strategy](#9-multi-chain-strategy)
10. [Roadmap](#10-roadmap)
11. [Team](#11-team)

---

## 1. Introduction

GundariuM is a generative NFT card battle game where players roll random traits across 8 categories and Gemini AI renders a unique kitbashed Mobile Suit image — minted as a playable ERC-721 battle card on the Base blockchain. With over **69 million possible trait combinations**, no two cards are alike. Every mint is a one-of-a-kind machine built from weighted rarity tables spanning frame types, weapons, colorways, and more.

The premise is simple: **your rolls are your deck.**

Every mint is a pull from the machine. GundariuM turns each roll into a digital battle card — traits randomized, rarity calculated, and a unique Mobile Suit generated on the spot by AI. A heavy assault frame with a beam cannon and GN particle backpack plays completely differently from a stealth recon frame with dual heat hawks and a flight unit, because they should.

Players use their minted cards in Pokemon-style turn-based battles, staking $GNDM tokens on the outcome. Strategic weapon selection, armor-type matchups, and rarity-based power scaling create depth that rewards tactical decision-making and collection building.

GundariuM is not a promise — it is a product. Smart contracts are deployed on Base mainnet with active $GNDM stakers, the full web application is live at **gundarium.xyz**, and the complete mint flow is functional. Whitelist mint opens **April 27, 2026**, with public launch on **May 10, 2026**.

> **RWA Premium Tier (Future):** The original photo-your-kit pipeline — where players photograph real Gunpla model kits and Claude AI identifies the Mobile Suit with lore-accurate stats — is preserved for a future premium Real World Asset tier. Your shelf will still become your deck.

---

## 2. The Core Loop

GundariuM's gameplay follows a five-step loop from roll to battle:

| Step | Action | Description |
|------|--------|-------------|
| 1 | **Select Faction** (optional) | Choose from 10 canonical Gundam factions to bias the colorway toward that faction's palette |
| 2 | **Roll Traits** | 8 trait categories are randomly rolled from weighted rarity tables — Frame Type, Head, Primary Weapon, Backpack, Colorway, Stance, Background, and Special |
| 3 | **AI Generates** | Gemini 2.5 Flash renders a unique kitbashed Mobile Suit image from the rolled traits in ~8-15 seconds |
| 4 | **Mint** | Pay USDC to mint an ERC-721 NFT card on Base with full on-chain traits |
| 5 | **Battle** | Enter PVE story arcs or PVP matches, staking $GNDM tokens on the outcome |

The loop is designed so that each step adds value and meaning to the card. Faction selection gives it identity. The trait roll determines its power tier and combat profile. AI generation makes it visually unique — no two cards look the same. Minting commits it to the blockchain. And battle gives the card purpose.

---

## 3. Design Philosophy

### Generative Fairness

GundariuM's generative model means every player starts on equal footing. There is no pay-to-win path — you cannot buy a specific trait combination. Every mint is a roll from the same weighted tables, and the AI generates a unique card from whatever you get. Rarity emerges organically from the probability math, not from artificial scarcity gates.

This design is deliberate. The best cards are the ones you get lucky on, and the best players are the ones who make the most of what they roll.

### Depth Through Variety

With 8 trait categories and over 69 million possible combinations, the design space is enormous. Two players can both roll a heavy assault frame but end up with completely different weapon loadouts, colorways, and special abilities. This variety means the metagame stays fresh — there is no single dominant build because the combinations are too vast to solve.

### The Shelf Lives On

The generative kitbash system is the primary mint path, but GundariuM was born from the Gunpla hobby. The original photo-your-kit pipeline — where Claude AI identifies real Gunpla model kits and assigns lore-accurate stats — is preserved for a future **RWA Premium Tier**. Players who own real Gunpla will eventually be able to photograph their kits and mint premium cards that carry canonical Mobile Suit identities, pilot names, and faction data. Your shelf will still become your deck.

---

## 4. Card System

### Trait Categories

Every card is defined by 8 randomly rolled trait categories:

| Category | Examples | Role |
|----------|----------|------|
| **Frame Type** | Heavy Assault, Stealth Recon, Artillery, Support | Determines base chassis and silhouette |
| **Head** | Gundam-type V-fin, Mono-eye, Visor, Twin-sensor | Defines the head unit design |
| **Primary Weapon** | Beam Rifle, Heat Hawk, Bazooka, Sniper Rifle | Main armament for battle |
| **Backpack** | Flight Unit, Booster Pack, Funnels, Weapon Rack | Back-mounted equipment and abilities |
| **Colorway** | Tri-color, Monochrome, Desert Camo, Titans Blue | Color scheme (faction-biased if faction selected) |
| **Stance** | Combat Ready, Firing Pose, Aerial Dive, Kneeling | Pose and composition of the generated image |
| **Background** | Space Debris Field, Colony Interior, Desert, Orbital | Environment setting for the card art |
| **Special** | Trans-Am Glow, Psychoframe Resonance, Wings of Light | Rare visual effects and signature abilities |

Each trait within a category has a weighted probability that determines its rarity: **Common**, **Uncommon**, **Rare**, **Ultra Rare**, or **Legendary**. With 8 categories and dozens of options per category, the system produces over **69 million unique trait combinations**.

### Rarity Derivation

Card rarity is derived from the number of non-common traits rolled:

| Non-Common Traits | Card Rarity |
|-------------------|-------------|
| 0-1 | Common |
| 2 | Uncommon |
| 3 | Rare |
| 4+ | Ultra Rare |
| Any Legendary trait | Legendary |

This means rarity is not purchased or selected — it emerges naturally from the probability of rolling higher-tier traits across all 8 categories.

### Battle Stats

Card rarity determines HP ranges and combat effectiveness:

| Rarity | HP Range |
|--------|----------|
| Common | 400 - 550 |
| Uncommon | 500 - 700 |
| Rare | 650 - 850 |
| Ultra Rare | 800 - 1,050 |
| Legendary | 1,000 - 1,300 |

Weapon damage values are calculated as percentages of the card's HP:

| Weapon Slot | Damage (% of HP) | Role |
|-------------|-------------------|------|
| Primary | 15 - 25% | Main weapon, consistent damage |
| Secondary | 25 - 40% | High-impact weapon |
| Tertiary | 8 - 15% | Light/situational weapon |
| Special | 50 - 80% | Devastating ability, used sparingly |

### Armor Types

Each card's frame type determines its armor, which creates defensive matchups in battle:

| Armor Type | Effect | Lore Origin |
|------------|--------|-------------|
| **Standard** | No special resistance | Basic mobile suit armor |
| **Luna Titanium** | Reduces melee damage (0.60x) | RX-78 line, original Gundam |
| **Gundanium Alloy** | Reduces all damage (0.80x) | After Colony timeline (Wing) |
| **Phase Shift** | Blocks physical melee (0.15x) | Cosmic Era (SEED) |
| **I-Field** | Blocks beam weapons (0.45x) | Universal Century beam barrier |
| **GN Particles** | Reduces ranged damage (0.65x) | Anno Domini (00 Gundam) |

Armor types create a knowledge-based metagame: a player who knows their opponent is running Phase Shift armor will favor beam weapons over physical attacks.

### AI Cosmetics (Post-Launch)

After minting, players can apply digital modifications to their card art:

- **Digital repaints** — AI-generated custom color schemes applied to the card image
- **HUD/Holo frames** — tiered frame overlays (faction-themed, animated)

The AI Cosmetics system is a post-launch feature with tiered USDC pricing.

### RWA Premium Tier (Future)

The original photo-based pipeline is preserved for a future premium tier. In this mode, players photograph real Gunpla model kits, and Claude Sonnet 4.6 with extended thinking identifies the Mobile Suit and assigns lore-accurate stats from a curated database of 148 canonical suits. This creates a distinct class of cards tied to physical ownership — true Real World Assets on-chain.

---

## 5. Battle System

### Overview

GundariuM's battle system is **Pokemon-style turn-based combat** — not auto-battle. Each turn, players choose their action: which weapon to fire, what stance to take, how to respond to their opponent's last move. Wins and losses are determined by player decisions, not just card stats.

### Turn Structure

1. **Speed check** — the faster suit acts first (Speed and Agility stats)
2. **Action selection** — each player chooses a weapon and optional stance
3. **Damage calculation** — base weapon damage × grade multiplier × armor effectiveness
4. **Resolution** — HP is reduced, status effects applied
5. **Turn timer** — chess-clock enforcement prevents stalling (if a player times out, they forfeit the action)

Battles run for a maximum of **40 turns**. If both suits survive, the tiebreak goes to the highest remaining HP percentage.

### Weapon Selection

Each turn, players choose from all four of their card's weapons — just like choosing a move in Pokemon. There is no forced rotation or cooldown system. Every weapon is available every turn.

This design is deliberate. The strategic depth comes from reading your opponent:

- **Do you lead with your Special** to deal massive damage, or save it because you suspect they'll switch to a defensive stance?
- **Do you pick your beam weapon** because you think their armor is weak to it, or do they have I-Field and you're walking into a 0.45x reduction?
- **Do you go physical melee** against what might be Phase Shift armor (0.15x), or play it safe with a ranged option?

Every turn is a decision. No autopilot, no waiting for your good move to come around in rotation. You have four weapons — pick one.

### Armor Effectiveness

Armor matchups are the tactical heart of combat. Damage dealt is multiplied by the defender's armor modifier against the weapon type:

- **I-Field vs. Beam weapons**: 0.45x (beam attacks are nearly halved)
- **Phase Shift vs. Physical melee**: 0.15x (physical melee is almost nullified)
- **GN Particles vs. Ranged attacks**: 0.65x (ranged is significantly reduced)
- **Luna Titanium vs. Melee**: 0.60x (melee is reduced)
- **Gundanium Alloy vs. All damage**: 0.80x (flat reduction across everything)
- **Standard**: No special resistance

This creates a rock-paper-scissors layer on top of raw stats. A Common card with I-Field armor can survive against a Legendary beam-heavy attacker if the player reads the matchup correctly.

### Battle Modes

**PVE (Player vs. Environment)**
- Story-driven campaign arcs based on Gundam series plotlines
- Increasing difficulty with AI opponents
- Entry fee returned on completion + arc completion rewards
- Serves as the onboarding path for new players

**PVP (Player vs. Player)**
- Real-time WebSocket matches — both players connected live
- $GNDM token staking on each match
- 10% protocol fee on PVP stakes (revenue model)
- Ranked matchmaking with seasonal leaderboards

---

## 6. $GNDM Tokenomics

### Token Overview

**$GNDM** is the native utility token of the GundariuM ecosystem. It is an ERC-20 token deployed on Base mainnet with an active staking contract.

### Utility

| Use Case | Mechanism |
|----------|-----------|
| **Battle staking** | Players stake $GNDM on PVP matches; winner takes the pot minus protocol fee |
| **PVE entry** | $GNDM fee to enter campaign arcs; returned on completion |
| **Staking rewards** | Stake $GNDM to earn yield via Synthetix-style reward distribution |
| **Tournament prizes** | Prize pools for seasonal and weekly tournaments |
| **Upgrade currency** | Spend $GNDM to upgrade card stats and weapons |
| **Governance** (future) | Token-weighted voting on game balance, new suit additions, tournament rules |

### GNDM v2 Deployment

$GNDM v2 was deployed via the **Clanker SDK** with the following parameters:

| Parameter | Value |
|-----------|-------|
| **Total Supply** | 100,000,000,000 (100B) |
| **Vault** | 20% of supply vaulted (30-day cliff, 90-day linear vest) |
| **Trading Fees** | Dynamic 1-3% on buys and sells |
| **LP Fees** | 100% of Uniswap V4 LP fees to team wallet |

The dynamic fee structure funds ongoing development and reward pools while maintaining healthy trading liquidity.

### Staking Mechanics

The GNDMStaking contract implements Synthetix-style `rewardPerToken` accounting:

- **24-hour lock** after staking (re-staking resets the lock timer)
- **7-day reward eligibility window** — stakers must maintain their position for a full week to earn rewards
- Rewards are distributed continuously and can be claimed at any time after the eligibility window
- The staking contract is **live on Base mainnet** with active participants

### Revenue Flows

| Source | Rate | Destination |
|--------|------|-------------|
| PVP battle stakes | 10% protocol fee | Treasury / reward pool |
| Card minting | USDC mint fee | Treasury |
| Cosmetic upgrades | USDC fee | Treasury |
| Tournament entry | $GNDM entry fee | Prize pool + protocol |

The protocol generates revenue from every core game action, creating a sustainable loop: players spend to play → treasury grows → rewards increase → more players stake → ecosystem expands.

---

## 7. Smart Contracts

All GundariuM contracts are written in Solidity ^0.8.20, built with Foundry, and use the **UUPS upgradeable proxy pattern** (OpenZeppelin v5) for safe iteration post-launch.

### GunplaCard

- **Standard**: ERC-721 with `ERC721URIStorage` + `ERC721Enumerable`
- **Mint pricing**: USDC (6-decimal) — caller must pre-approve
- **On-chain storage**: Full `CardTraits` struct per token (name, series, faction, pilot, rarity, armor type, HP, four weapons with damage values, special weapon, special damage)
- **Token IDs**: Start at 1 (0 reserved as "nonexistent")
- **Cosmetic upgrades**: USDC-gated repaints and decals supported at the contract level

#### Whitelist Mint System

The GunplaCard contract supports a three-phase mint rollout:

| Phase | Status | Pricing | Access |
|-------|--------|---------|--------|
| **PAUSED** | No minting allowed | — | — |
| **WHITELIST** | Whitelist-only minting | Tiered by Merkle proof | Verified wallets only |
| **PUBLIC** | Open minting | Public price | Anyone |

**Whitelist tiers** use Merkle proof verification for gas-efficient access control:

| Tier | Mint Price (USDC) | Description |
|------|-------------------|-------------|
| VIP | $1.00 | Early supporters, core community |
| WL (Whitelist) | $1.50 | Community members, partners |
| Public | $2.00 | Open to all |

During the whitelist phase, each wallet is limited to **5 mints**. This prevents whale accumulation and ensures broad distribution across the community.

### GundaniumGame

- **Architecture**: Hybrid on-chain/off-chain battle model
- **On-chain**: Session creation, $GNDM stake locking, battle type (PVE/PVP)
- **Off-chain**: Battle resolution by trusted game server
- **Settlement**: Server submits EIP-712 signed `BattleResult` (sessionId, winner, finalHpWinner, timestamp)
- **Economics**: PVP — 10% protocol fee; PVE — entry fee returned + arc reward on completion
- **Gas efficiency**: One transaction per battle (settlement), not one per turn

### GNDMStaking

- **Model**: Synthetix-style `rewardPerToken` continuous yield
- **Lock**: 24-hour lock after staking; re-staking resets the clock
- **Eligibility**: 7-day reward eligibility window
- **Status**: **Live on Base mainnet**

### $GNDM Token

- **Standard**: ERC-20
- **Purpose**: Game utility token (staking, battle stakes, rewards, upgrades)
- **Status**: **Live on Base mainnet**

### Deployment Status

| Contract | Base Sepolia | Base Mainnet | Ronin (Planned) |
|----------|-------------|-------------|-----------------|
| GunplaCard | Deployed | May 10 launch | May 10 launch |
| GundaniumGame | Deployed | May 10 launch | May 10 launch |
| GNDMStaking | Deployed | **LIVE** | May 10 launch |
| $GNDM Token | Deployed | **LIVE** | May 10 launch |

All contracts are chain-agnostic (standard OpenZeppelin + EIP-712). Deploying to new chains requires only RPC endpoint and gas token configuration — no architectural changes.

---

## 8. Technology & Infrastructure

### Web Application

GundariuM is a full web application at **gundarium.xyz**, not a dApp with a wallet modal bolted on. The application is built for both crypto-native users and Gunpla hobbyists who have never used a blockchain.

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router), React 19 |
| **Styling** | TailwindCSS v4, CSS custom properties for theming |
| **Typography** | Orbitron (headings/accent), Geist Sans + Geist Mono |
| **State Management** | Zustand (client stores) |
| **Web3** | wagmi v3, viem v2 |
| **AI (Generation)** | Google Gemini 2.5 Flash with `responseModalities: ["TEXT", "IMAGE"]` — kitbash card generation |
| **AI (Analysis)** | Anthropic Claude SDK — Claude Sonnet 4.6 with extended thinking (preserved for RWA premium tier) |
| **IPFS** | Pinata SDK v2 (migrating to Cloudflare R2) |
| **Smart Contracts** | Solidity ^0.8.20, Foundry, OpenZeppelin v5 |
| **Deployment** | Vercel |

### Wallet Integration

GundariuM supports multiple wallet connection methods, prioritized for the broadest possible user base:

1. **Farcaster embedded wallet** — automatic connection when running inside the Farcaster miniapp, zero friction for Farcaster users
2. **Ronin Waypoint** — seedless wallet creation via email/social login, gas-sponsored transactions for new users
3. **WalletConnect** — QR code modal supporting 300+ wallets, the standard for desktop and cross-device connection
4. **Injected wallets** — MetaMask, Coinbase Wallet, and other browser extension wallets

The wallet connection flow detects context automatically: if the user is in a Farcaster frame, the embedded wallet activates. If they're on Ronin, Waypoint handles onboarding. Otherwise, WalletConnect or injected wallets are presented.

### Backend Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Frontend hosting | Vercel | Next.js deployment, preview environments, global CDN |
| Battle server | Cloudflare Workers + Durable Objects | Stateful real-time battle sessions with WebSocket connections |
| Game database | Cloudflare D1 | Leaderboard, battle history, player stats, off-chain game data |
| NFT storage | Cloudflare R2 | Card images and metadata with zero egress fees |
| Anti-abuse | Cloudflare KV + Turnstile | Rate limiting, bot prevention, mint abuse protection |

### Mint Flow State Machine

The mint flow is implemented as a Zustand state machine with five states:

```
idle → generating → reveal → confirming → success
```

| State | What Happens |
|-------|-------------|
| `idle` | Player optionally selects a faction, clicks "MINT YOUR GUNPLA" |
| `generating` | Traits are randomly rolled, Gemini AI generates the kitbash image (~8-15s) |
| `reveal` | Player sees their generated card with trait badges, rarity breakdown, and battle stats |
| `confirming` | Image + metadata uploaded to IPFS via Pinata, player approves USDC and mints on-chain |
| `success` | Minted NFT displayed with animated reveal |

Each state transition is guarded — users cannot skip steps, and the flow provides clear feedback at every stage.

---

## 9. Multi-Chain Strategy

GundariuM launches simultaneously on **Base** and **Ronin** — two chains chosen for complementary strengths, not chain tourism.

### Base

Base is where GundariuM was born. The project entered the crypto ecosystem through Farcaster in November 2025, and Base is the natural home for social-first distribution:

- **Farcaster miniapp** — GundariuM is registered as a Farcaster miniapp, discoverable in-feed by millions of Farcaster users
- **Base App MiniApp** — integrated into the Base app ecosystem for native mobile discovery
- **$GNDM token** — already live on Base mainnet with active staking
- **Farcaster social graph** — card sharing, battle challenges, and collection showcases within the Farcaster feed
- **Community roots** — mentored by NomadicFrame (TYSM, 10K+ staker community), connected to the Base builder ecosystem

### Ronin

Ronin is where GundariuM's audience already lives. The chain was built for gaming, and its community skews anime-adjacent — exactly the demographic that would build Gunpla:

- **Gaming-native users** — Axie Infinity, Pixels, Wild Forest, Craft World players are familiar with NFT card mechanics
- **Ronin Waypoint** — seedless wallet onboarding removes the biggest barrier for non-crypto Gunpla hobbyists
- **Katana DEX** — $GNDM liquidity pool for Ronin-native trading
- **Gas sponsorship** — Waypoint Gas Grant enables gas-free transactions for new users
- **Ecosystem co-marketing** — featured on the Ronin ecosystem page, Ronin Wallet, and Builders Discord

### Cross-Chain Philosophy

At launch, each chain operates its own independent card economy and battle ecosystem. Cards minted on Base exist on Base; cards minted on Ronin exist on Ronin. This keeps the economies clean and avoids bridge complexity at launch.

Cross-chain card bridging and unified leaderboards are on the post-launch roadmap (see Section 10).

---

## 10. Roadmap

### Completed

- [x] GunplaCard, GundaniumGame, GNDMStaking contracts deployed on Base Sepolia
- [x] $GNDM v2 token deployed via Clanker SDK on Base mainnet
- [x] GNDMStaking live on Base mainnet with active stakers
- [x] Generative kitbash mint flow (faction select → roll traits → AI generate → mint)
- [x] 8-category trait system with weighted rarity tables (~69M+ combinations)
- [x] Gemini 2.5 Flash image generation pipeline
- [x] Client-side battle simulation engine with armor matchup system
- [x] Farcaster miniapp integration
- [x] gundarium.xyz live and functional
- [x] Whitelist mint system with tiered Merkle proof verification
- [x] Whitepaper v2.0 published

### April 27, 2026 — Whitelist Mint

- [ ] GunplaCard deployed on Base mainnet
- [ ] Whitelist mint live (VIP $1 / WL $1.50, 5 per wallet)
- [ ] Merkle tree generated from whitelist signups
- [ ] Community launch event on Farcaster

### May 10, 2026 — Public Launch

- [ ] Public mint live ($2 USDC per card)
- [ ] Base App MiniApp integration
- [ ] $GNDM staking rewards funded

### Post-Launch

- [ ] Arena: PVE campaign arcs with story-driven battles
- [ ] PVP real-time battles with $GNDM staking
- [ ] Leaderboard with seasonal rankings
- [ ] AI Cosmetics — digital repaints and HUD/Holo frames
- [ ] Prize pools for tournaments

### Q3 2026

- [ ] PVP ranked matchmaking system
- [ ] Weekly and seasonal tournament schedule
- [ ] Card upgrade system
- [ ] Community tournaments co-marketed with Base ecosystem

### Q4 2026

- [ ] Cross-chain expansion (Ronin or additional L2s)
- [ ] Advanced battle mechanics (stances, team battles)
- [ ] New trait categories and expanded generation options

### 2027

- [ ] **RWA Premium Tier** — photo-your-kit pipeline with Claude AI identification
- [ ] Mobile app (React Native) for minting and battle on mobile
- [ ] Governance system for token-weighted voting on game balance
- [ ] Partnership integrations with Gunpla retailers and events

---

## 11. Team

### PyroFire Labs

**Joshua Grubbs — Founder & Lead Developer**

Full-stack developer handling smart contracts (Solidity/Foundry), frontend (Next.js/React), and system architecture. Entered crypto development in November 2025 through the Farcaster community. Shipped a working MVP with mainnet contracts, a complete mint flow, and a 148-suit curated database in under 5 months. Active Ronin gamer (Craft World, Pixels) with staked RON.

**Larry — AI Development Partner (Claude Code)**

GundariuM is built in collaboration with "Larry," an AI development partner powered by Claude Code. Larry is named after Joshua's late father — the greatest influence in his life. Larry Sr. was an early tech adopter who got the family's first PC in 1995 and was the first in the neighborhood with DSL high-speed internet when everyone else was on dial-up. He cornered online auto sales through his dealership, landing contracts with Cars.com and Vehix.com. He always wanted the latest gaming console the day it released — from the Sega Genesis to every generation after — because he believed technology would make the world a better place. He played Madden from its earliest days with Madden 93. His passion for technology and sales shaped Joshua's career path, first into sales and now into web development. Naming the AI partner "Larry" keeps his dad in the work he would have loved to see.

Larry is a core collaborator on architecture decisions, contract design, battle system planning, and documentation. This partnership is how a solo founder ships at studio velocity — the entire codebase, smart contracts, battle simulation engine, grant proposals, and this whitepaper were developed through this collaboration.

**Kayonfire (Farcaster) — Brand & Visual Design**

Contracted for the GundariuM logo, promotional materials, and visual identity.

**NomadicFrame (Farcaster) — Advisor**

Creator of TYSM and the gratitude economy, with a community of 10,000+ stakers. Mentor to Joshua since his entry into crypto development. Provides guidance on community building, token economics, and Farcaster ecosystem strategy.

**Battle Animation Designer — Hiring**

Three prospects currently being evaluated for 2D/3D battle animation sequences. The hire will bring battle visuals to life with animated weapon attacks, armor effects, and victory sequences.

---

## Legal Disclaimer

This whitepaper is for informational purposes only and does not constitute financial advice, an offer of securities, or a solicitation of investment. $GNDM is a utility token intended for use within the GundariuM game ecosystem. Token value may fluctuate. Participation in GundariuM involves risk, including the potential loss of staked tokens.

**GundariuM is an independent fan project.** PyroFire Labs holds no rights to the name, likeness, or intellectual property of Mobile Suit Gundam, Gunpla, or any related franchise properties. GundariuM is not affiliated with, endorsed by, or sponsored by Bandai Namco, Sunrise, Sotsu, or any rights holders of the Gundam franchise. All Mobile Suit names, model numbers, pilot names, faction names, series titles, and lore references are the property of their respective owners and are used here solely for identification and gameplay purposes within a fan-created experience. AI-generated card images are original kitbashed compositions and do not reproduce any specific copyrighted Mobile Suit design.

---

*GundariuM — Your rolls are your deck.*

**gundarium.xyz** | PyroFire Labs | 2026
