# GundariuM Whitepaper

**Version 3.0 — July 21, 2026**
**PyroFire Labs**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [The Core Loop](#2-the-core-loop)
3. [Design Philosophy](#3-design-philosophy)
4. [Card System](#4-card-system)
5. [Battle System](#5-battle-system)
6. [Daily Engagement](#6-daily-engagement)
7. [$GNRM Tokenomics](#7-gnrm-tokenomics)
8. [Smart Contracts](#8-smart-contracts)
9. [Technology & Infrastructure](#9-technology--infrastructure)
10. [Roadmap](#10-roadmap)
11. [Team](#11-team)

---

## 1. Introduction

GundariuM is a generative NFT card battle game where players roll random traits across 8 categories and Gemini AI renders a unique kitbashed Mobile Suit image — minted as a playable ERC-721 battle card ("Gundar-Frame") on the Base blockchain. With over **69 million possible trait combinations**, no two cards are alike. Every mint is a one-of-a-kind machine built from weighted rarity tables spanning frame types, weapons, colorways, and more.

The premise is simple: **your rolls are your deck.**

Every mint is a pull from the machine. GundariuM turns each roll into a digital battle card — traits randomized, rarity calculated, and a unique Mobile Suit generated on the spot by AI. Players name their own Gundar-Frame on the reveal step, making it theirs before it ever sees a battle.

GundariuM is not a promise — it is a live product. GunplaCard is deployed and open for public mint on Base mainnet, the full web application is live at **gundarium.xyz**, and as of this writing **26 Gundar-Frames have been minted** by real collectors. The PVE Arena is playable today. The $GNRM token is live and tradeable. A daily engagement system with real on-chain streak tracking ships alongside it.

> **RWA Premium Tier (Future):** The original photo-your-kit pipeline — where players photograph real Gunpla model kits and Claude AI identifies the Mobile Suit with lore-accurate stats — is preserved in the codebase for a future premium Real World Asset tier. Your shelf will still become your deck.

---

## 2. The Core Loop

GundariuM's gameplay follows a five-step loop from roll to battle:

| Step | Action | Description |
|------|--------|-------------|
| 1 | **Select Faction** (optional) | Choose from 10 canonical Gundam factions to bias the colorway toward that faction's palette |
| 2 | **Roll Traits** | 8 trait categories are randomly rolled from weighted rarity tables — Frame Type, Head, Weapon, Backpack, Colorway, Stance, Background, and Special |
| 3 | **AI Generates** | Gemini 2.5 Flash renders a unique kitbashed Mobile Suit image from the rolled traits in ~8-15 seconds |
| 4 | **Mint** | Pay USDC to mint an ERC-721 Gundar-Frame on Base with full on-chain traits, and name it yourself |
| 5 | **Battle** | Enter the PVE Arena and put your Gundar-Frame's weapons and armor to the test |

The loop is designed so that each step adds value and meaning to the card. Faction selection gives it identity. The trait roll determines its power tier and combat profile. AI generation makes it visually unique — no two cards look the same. Minting and naming it commits it to the blockchain as yours. And battle gives the card purpose.

---

## 3. Design Philosophy

### Generative Fairness

GundariuM's generative model means every player starts on equal footing. There is no pay-to-win path — you cannot buy a specific trait combination. Every mint is a roll from the same weighted tables, and the AI generates a unique card from whatever you get. Card rarity is a direct weighted roll (50% Common / 25% Uncommon / 15% Rare / 7% Ultra Rare / 3% Legendary), independent of which specific traits you land — so the odds stay honest and stable even as the trait tables grow over time.

This design is deliberate. The best cards are the ones you get lucky on, and the best players are the ones who make the most of what they roll.

### Depth Through Variety

With 8 trait categories and over 69 million possible combinations, the design space is enormous. Two players can both roll a heavy assault frame but end up with completely different weapon loadouts, colorways, and special abilities. This variety means the metagame stays fresh — there is no single dominant build because the combinations are too vast to solve.

### The Shelf Lives On

The generative kitbash system is the live mint path today, but GundariuM was born from the Gunpla hobby. The original photo-your-kit pipeline — where Claude AI identifies real Gunpla model kits and assigns lore-accurate stats — is preserved in the codebase for a future **RWA Premium Tier**. Players who own real Gunpla will eventually be able to photograph their kits and mint premium cards that carry canonical Mobile Suit identities, pilot names, and faction data. Your shelf will still become your deck.

---

## 4. Card System

### Trait Categories

Every Gundar-Frame is defined by 8 randomly rolled trait categories:

| Category | Examples | Role |
|----------|----------|------|
| **Frame Type** | Heavy Assault, Stealth Recon, Artillery, Support | Determines base chassis and silhouette |
| **Head** | Gundam-type V-fin, Mono-eye, Visor, Twin-sensor | Defines the head unit design |
| **Weapon** | Beam Rifle, Heat Hawk, Bazooka, Sniper Rifle | Primary armament shown in the card art |
| **Backpack** | Flight Unit, Booster Pack, Funnels, Weapon Rack | Back-mounted equipment and abilities |
| **Colorway** | Tri-color, Monochrome, Desert Camo, Titans Blue | Color scheme (faction-biased if faction selected) |
| **Stance** | Combat Ready, Firing Pose, Aerial Dive, Kneeling | Pose and composition of the generated image |
| **Background** | Space Debris Field, Colony Interior, Desert, Orbital | Environment setting for the card art |
| **Special** | Trans-Am Glow, Psychoframe Resonance, Wings of Light | Rare visual effects and signature abilities |

Each trait within a category has a weighted probability that determines a percentile-based rarity label — **Common**, **Uncommon**, **Rare**, **Ultra Rare**, or **Legendary** — shown on the card as flavor. With 8 categories and dozens of options per category, the system produces over **69 million unique trait combinations**.

### Rarity Derivation

Card rarity is decoupled from the individual trait roll — it's a direct weighted roll against a fixed distribution:

| Card Rarity | Odds |
|-------------|------|
| Common | 50% |
| Uncommon | 25% |
| Rare | 15% |
| Ultra Rare | 7% |
| Legendary | 3% |

This means overall card rarity stays stable and predictable even as individual trait tables expand — a Legendary card and a Common card have the same chance of rolling any given trait; what changes is the card's stat band.

### Battle Stats

Card rarity determines HP ranges and combat effectiveness. The bands are non-overlapping, with roughly a 7x spread between the lowest Common roll and the highest Legendary roll:

| Rarity | HP Range |
|--------|----------|
| Common | 150 - 349 |
| Uncommon | 350 - 599 |
| Rare | 600 - 899 |
| Ultra Rare | 900 - 1,199 |
| Legendary | 1,200 - 2,000 |

Weapon damage values are calculated as percentages of the card's HP, across four weapon slots:

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

### Naming Your Gundar-Frame

On the reveal step, every player names their own Gundar-Frame — up to 32 ASCII characters, filtered against a profanity/hate-speech list and blocked from using "Gundam" directly (GundariuM is an independent fan project and doesn't claim the trademarked name for card identities). Leave it blank and the card is assigned a name from a rarity-mapped pool instead — Legendary cards get suitably dramatic names.

### AI Cosmetics (Post-Launch)

After minting, players will be able to apply digital modifications to their card art — AI-generated repaints and tiered HUD/Holo frame overlays. This system is designed and specced, targeted for a post-launch release with USDC pricing.

### RWA Premium Tier (Future)

The original photo-based pipeline is preserved in the codebase for a future premium tier. In this mode, players photograph real Gunpla model kits, and Claude with extended thinking identifies the Mobile Suit and assigns lore-accurate stats. This creates a distinct class of cards tied to physical ownership — true Real World Assets on-chain.

---

## 5. Battle System

### Overview

The **PVE Arena is live today** at gundarium.xyz/arena — a playable, turn-based demo where you pick your Gundar-Frame's weapon each turn rather than watching an auto-battle. It's currently labeled "Demo" because it runs entirely client-side and isn't yet wired into real GNRM staking or on-chain settlement — that's the near-term roadmap (Section 10), not a hypothetical.

### Turn Structure

Each turn, you choose one of your card's weapons — primary, secondary, tertiary, or a special that has to charge up first. There's no forced rotation: reading the matchup and deciding what to throw out is the actual game.

- **Charge-gated Special** — your Special is locked until a charge meter fills over a few non-Special turns, so using it is a real commitment, not a free spam option
- **Critical hits** — your attacks have a 10% crit chance; the AI opponent's have 5%, a deliberate slight player-favor for demo feel
- **Armor matchups** — every hit is multiplied by the defender's armor modifier against that weapon type (Section 4)
- **Max 40 turns** — if both suits are still standing, the tiebreak goes to whoever has the higher remaining HP percentage

### Armor Effectiveness

Armor matchups are the tactical heart of combat. Damage dealt is multiplied by the defender's armor modifier against the weapon type:

- **I-Field vs. Beam weapons**: 0.45x (beam attacks are nearly halved)
- **Phase Shift vs. Physical melee**: 0.15x (physical melee is almost nullified)
- **GN Particles vs. Ranged attacks**: 0.65x (ranged is significantly reduced)
- **Luna Titanium vs. Melee**: 0.60x (melee is reduced)
- **Gundanium Alloy vs. All damage**: 0.80x (flat reduction across everything)
- **Standard**: No special resistance

This creates a rock-paper-scissors layer on top of raw stats. A Common card with I-Field armor can survive against a Legendary beam-heavy attacker if the player reads the matchup correctly.

### What's Next: On-Chain PVP

GundariuM's battle contract, **GundaniumGame**, is built and deployed to Base Sepolia testnet — a hybrid on-chain/off-chain design where session creation and GNRM staking happen on-chain, battle resolution happens off-chain via a trusted game server, and the result is settled by an EIP-712 signed submission. PVP carries a 10% protocol fee on the loser's stake; PVE returns the entry fee plus a configurable arc reward on completion. Mainnet deployment is the next major milestone (Section 10) — until then, staking real GNRM on a battle outcome isn't live yet.

---

## 6. Daily Engagement

GundariuM ships a real, on-chain daily habit loop — **Daily Check-In**, live on Base mainnet — built to reward players who show up consistently, not just once.

### How It Works

The `DailyCheckIn` contract tracks a player-paid, real on-chain check-in per wallet. Every task resets at **00:00 UTC**, not on a rolling 24-hour timer from whenever you last acted — so "daily" means the same thing for every player regardless of time zone:

| Task | What It Verifies |
|------|-------------------|
| **Check In** | A signed on-chain transaction, once per UTC day — the foundation of your streak |
| **Buy GNRM** | A real on-chain purchase of 30,000+ GNRM that day, verified against pool activity, not self-reported |
| **Run Demo + Submit Form** | Play the Arena and share feedback |
| **Mint a Gundar-Frame** | A verified mint that UTC day |
| **Stake Token** | A verified GNRM stake that day |
| **Share Your Dossier** | Post your current streak and stats to Farcaster |

Streaks are tracked entirely on-chain — current streak, longest streak, total check-ins, and a rolling 7-day counter. Hit all 7 days in a rolling week and you earn a **+200 bonus**. There's no gasless shortcut here by design: every check-in is a real, player-signed transaction, because a habit loop that costs nothing to fake isn't a real habit loop.

### Frame-Runner EXP

Every player has a **Frame-Runner EXP** number, computed live from real on-chain state — streak length, total check-ins, cards minted, and daily task completion. It has no spendable use and no stored backend balance; it's a bragging-rights number, not a currency. That's a deliberate choice, not a limitation: it keeps the system honest and simple while the game itself is still growing.

---

## 7. $GNRM Tokenomics

### Token Overview

**$GNRM** (GundariuM-RE-Grade) is the native token of the GundariuM ecosystem, launched on **Streme.fun** — a platform that deploys tokens as native Superfluid Super Tokens with built-in streaming staking and automatic Uniswap V3 liquidity, no custom staking contract required.

| Parameter | Value |
|-----------|-------|
| **Contract** | `0x271b01cc11032a4e23f0200f8f57eb45176ab491` (Base mainnet) |
| **Total Supply** | 100,000,000,000 (100B) |
| **Decimals** | 18 |
| **Launched** | July 15, 2026 |

### Supply Allocation

| Allocation | Share | Mechanism |
|------------|-------|-----------|
| **Staking rewards pool** | 20B (20%) | Streamed linearly over 365 days via Superfluid's General Distribution Agreement |
| **Liquidity pool** | 80B (80%) | Single-sided Uniswap V3 position, funded entirely from the token's own supply — no upfront ETH/WETH from the creator |

### Trading Fees

A 1% fee applies on the Uniswap pool. 40% of that fee accrues to the token creator (the `@gundarium` Farcaster account, claimable anytime); 60% goes to the Streme protocol.

### Staking

Staking GNRM mints **stGNRM**, a 1:1 receipt token, via Streme's native per-second streaming staking — no custom contract, no manual claim cycles. There's a 24-hour minimum hold before unstaking. This retires the need for GundariuM's own staking contract entirely; the previous `GNDMStaking` design is no longer in active development.

### Utility

| Use Case | Status |
|----------|--------|
| **Daily Check-In tasks** | Live — buying and staking GNRM are two of the six daily tasks (Section 6) |
| **PVE/PVP battle staking** | Roadmap — pending GundaniumGame's mainnet deployment (Section 5) |
| **Upgrade currency** | Roadmap — card stat/weapon upgrades |
| **Tournament prizes** | Roadmap — seasonal and weekly prize pools |
| **Governance** | Future — token-weighted voting on game balance and new content |

### A Note on Prior Tokens

GundariuM's token has been through two prior identities — $GNDM, then $GUNR — before settling on $GNRM. Both earlier tokens' liquidity pools are no longer active, and neither is purchasable today. GNRM is the current, live, tradeable token; references to $GNDM or $GUNR anywhere else should be treated as historical.

---

## 8. Smart Contracts

All GundariuM contracts are written in Solidity ^0.8.20+, built with Foundry. Most use the **UUPS upgradeable proxy pattern** (OpenZeppelin v5) for safe iteration post-launch.

### GunplaCard — Live on Base Mainnet

- **Standard**: ERC-721 with `ERC721URIStorage` + `ERC721Enumerable`
- **Mint pricing**: USDC (6-decimal) — caller must pre-approve. VIP tier $1.00, Whitelist tier $1.50, Public $2.00
- **On-chain storage**: Full `CardTraits` struct per token (name, series, faction, pilot, rarity, armor type, HP, four weapons with damage values, special weapon, special damage)
- **Token IDs**: Start at 1 (0 reserved as "nonexistent")
- **Mint phase**: **PUBLIC** — open to anyone, no cap on mints per wallet
- **Cosmetic upgrades**: USDC-gated repaints and decals supported at the contract level

Whitelist tiers still exist in the contract (Merkle proof gated) for anyone previously verified, but the per-wallet mint cap has been removed — minting is fully open.

### GundaniumGame — Deployed to Base Sepolia (Testnet)

- **Architecture**: Hybrid on-chain/off-chain battle model
- **On-chain**: Session creation, GNRM stake locking, battle type (PVE/PVP)
- **Off-chain**: Battle resolution by a trusted game server
- **Settlement**: Server submits an EIP-712 signed `BattleResult` to settle
- **Economics**: PVP — 10% protocol fee on the loser's stake, winner gets `stake × 2 − fee`; PVE — entry fee returned plus a configurable arc reward on completion
- **Status**: Live on Sepolia for testing; not yet deployed to Base mainnet (Section 10)

### DailyCheckIn — Live on Base Mainnet

- **Model**: UUPS upgradeable, owner-gated for future task additions or reworks
- **State**: Per-wallet current streak, longest streak, total check-ins, and a rolling 7-day window, all tracked on-chain
- **Reset**: UTC-midnight day-bucketed (`block.timestamp / 1 days`), not a rolling 24-hour timer from last action
- **Status**: Live, real usage since launch

### Retired Contracts

GundariuM's original `GNDMStaking` contract and the `GNDMtoGUNR` migration contract (which handled the first token transition) are both retired — staking now happens natively through Streme (Section 7), and the migration window has closed with no further token transition planned.

---

## 9. Technology & Infrastructure

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
| **AI (Analysis)** | Anthropic Claude, extended thinking (preserved for the future RWA premium tier) |
| **IPFS** | Pinata SDK v2 |
| **Smart Contracts** | Solidity ^0.8.20+, Foundry, OpenZeppelin v5 |
| **Deployment** | Vercel |

### Wallet Integration

GundariuM supports multiple wallet connection methods, prioritized for the broadest possible user base:

1. **Farcaster embedded wallet** — automatic connection when running inside the Farcaster miniapp, zero friction for Farcaster users
2. **Injected wallets** — MetaMask, Coinbase Wallet, and other browser extension wallets
3. **WalletConnect** — QR code modal supporting hundreds of wallets, the standard for desktop and cross-device connection

The wallet connection flow detects context automatically: if the user is in a Farcaster frame, the embedded wallet activates. Otherwise, injected wallets or WalletConnect are presented.

### Why Base

GundariuM entered the crypto ecosystem through Farcaster in November 2025, and Base is the natural home for social-first distribution — a registered Farcaster miniapp discoverable in-feed, native card sharing and dossier flexing within the Farcaster social graph, and a builder community the project is directly rooted in. GundariuM is Base-focused by design, not chain-agnostic for its own sake; expanding to additional chains is a future consideration (Section 10), not a launch-day commitment.

---

## 10. Roadmap

### Shipped

- [x] GunplaCard live on Base mainnet, public mint open
- [x] Generative kitbash mint flow (faction select → roll traits → AI generate → mint → name it)
- [x] 8-category trait system with weighted rarity tables (~69M+ combinations)
- [x] Gemini 2.5 Flash image generation pipeline
- [x] PVE Arena — playable turn-based demo with weapon selection, charge-gated specials, and armor matchups
- [x] Farcaster miniapp integration
- [x] gundarium.xyz live and functional
- [x] $GNRM live and tradeable via Streme.fun, with native streaming staking (stGNRM)
- [x] Daily Check-In — on-chain streaks, UTC-midnight resets, Frame-Runner EXP
- [x] GundaniumGame battle contract deployed and tested on Base Sepolia

### Near-Term

- [ ] GundaniumGame deployed to Base mainnet
- [ ] Real GNRM staking wired into PVE/PVP battle outcomes
- [ ] AI Cosmetics — digital repaints and HUD/Holo frames
- [ ] Leaderboard with real rankings

### Mid-Term

- [ ] Ranked PVP matchmaking
- [ ] Tournament schedule with GNRM prize pools
- [ ] Card upgrade system
- [ ] Expanded trait categories and generation options

### Future

- [ ] **RWA Premium Tier** — photo-your-kit pipeline with Claude AI identification
- [ ] Governance system for token-weighted voting on game balance
- [ ] Evaluate additional chains once Base is fully mature
- [ ] Partnership integrations with Gunpla retailers and events

---

## 11. Team

### PyroFire Labs

**Joshua Grubbs — Founder & CEO**

Full-stack developer handling smart contracts (Solidity/Foundry), frontend (Next.js/React), and system architecture. Entered crypto development in November 2025 through the Farcaster community. Shipped a working MVP with mainnet contracts and a complete mint flow in under a year — solo, with an AI development partner.

**Larry — AI Development Partner (Claude Code)**

GundariuM is built in collaboration with "Larry," an AI development partner powered by Claude Code. Larry is named after Joshua's late father — the greatest influence in his life. Larry Sr. was an early tech adopter who got the family's first PC in 1995 and was the first in the neighborhood with DSL high-speed internet when everyone else was on dial-up. He cornered online auto sales through his dealership, landing contracts with Cars.com and Vehix.com. He always wanted the latest gaming console the day it released — from the Sega Genesis to every generation after — because he believed technology would make the world a better place. He played Madden from its earliest days with Madden 93. His passion for technology and sales shaped Joshua's career path, first into sales and now into web development. Naming the AI partner "Larry" keeps his dad in the work he would have loved to see.

Larry is a core collaborator on architecture decisions, contract design, battle system planning, and documentation. This partnership is how a solo founder ships at studio velocity — the entire codebase, smart contracts, battle simulation engine, and this whitepaper were developed through this collaboration.

**Kayonfire (Farcaster) — Chief Marketing Officer**

Leads GundariuM's marketing strategy, brand and visual design, and community campaigning across social channels.

### Community Leadership

**Papusiek1111 (Farcaster) — Guild & Channel Moderator**

Moderator for the GundariuM Frame-Runners Guild and the GundariuM Guardians leadership channel. Founder of Quizzy, a Farcaster-native quiz mini app, and an active collaborator on GundariuM's community initiatives.

**darganmage35 (Farcaster) — Guild & Channel Moderator**

Moderator for the GundariuM Frame-Runners Guild and the GundariuM Guardians leadership channel.

### Advisors

**NomadicFrame (Farcaster) — Advisor**

Creator of TYSM and the gratitude economy, with a community of 10,000+ stakers. Mentor to Joshua since his entry into crypto development. Provides guidance on community building, token economics, and Farcaster ecosystem strategy.

---

## Legal Disclaimer

This whitepaper is for informational purposes only and does not constitute financial advice, an offer of securities, or a solicitation of investment. $GNRM is a utility token intended for use within the GundariuM game ecosystem. Token value may fluctuate. Participation in GundariuM involves risk, including the potential loss of staked tokens.

**GundariuM is an independent fan project.** PyroFire Labs holds no rights to the name, likeness, or intellectual property of Mobile Suit Gundam, Gunpla, or any related franchise properties. GundariuM is not affiliated with, endorsed by, or sponsored by Bandai Namco, Sunrise, Sotsu, or any rights holders of the Gundam franchise. All Mobile Suit names, model numbers, pilot names, faction names, series titles, and lore references are the property of their respective owners and are used here solely for identification and gameplay purposes within a fan-created experience. AI-generated card images are original kitbashed compositions and do not reproduce any specific copyrighted Mobile Suit design.

---

*GundariuM — Your rolls are your deck.*

**gundarium.xyz** | PyroFire Labs | 2026
