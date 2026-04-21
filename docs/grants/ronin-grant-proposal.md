# GundariuM — Ronin Grant Proposal

**Applicant:** PyroFire Labs
**Founder:** Joshua Grubbs (PyroFireZero)
**Date:** March 20, 2026
**Grants Applied For:** Forge Innovation Grant, Ecosystem Builder Grant, Waypoint Gas Grant

---

## 1. Executive Summary

GundariuM is a physical-to-digital NFT card battle game where players photograph their real Gunpla model kits and mint them as playable ERC-721 battle cards with lore-accurate stats. Each card carries the identity of the Mobile Suit it represents — its pilot, faction, weapons, armor type, and series — all derived from a curated database of 148 suits spanning the entire Gundam universe.

Players then use these cards in Pokemon-style turn-based battles with $GNDM token staking, strategic weapon selection, and armor-type matchups that reward knowledge of the source material.

**Why Ronin?** I'm not pitching Ronin because I found a grant page. I'm a Ronin gamer. I play Craft World (Angry Dynomites Labs), I've spent time in Pixels, and I have ~100 staked RON. When I started building GundariuM, I was new to crypto development — I came in through Farcaster and Base in November 2025, mentored by NomadicFrame (creator of TYSM and the gratitude economy). I built my MVP on Base because that's where I learned to ship. But the game I'm building — anime-themed collectible card battles — belongs where the gaming community already lives. That's Ronin.

GundariuM has a working MVP with smart contracts deployed on both Base Sepolia (testnet) and Base mainnet — the $GNDM token and GNDMStaking contracts are already live in production with active stakers. The complete mint flow, 148-suit database, client-side trait generation, and battle simulation engine are all functional. I'm not applying with an idea. I'm applying with a product that's already on mainnet.

**Launch date: May 10, 2026** — 51 days from application.

---

## 2. Product Overview

### The Core Loop

```
Photograph → Select Suit → Choose Grade → Cosmetics → Mint → Upgrade → Battle
```

1. **Photograph**: Players take a photo of their real-world Gunpla model kit
2. **Identify**: Search a curated database of 148 Mobile Suits to find their kit
3. **Grade**: Select the kit grade (SD, HG, RG, MG, MG Ver.Ka, Hi-Res, PG) — each grade acts as a rarity tier with stat multipliers
4. **Cosmetics**: Apply digital paint schemes and custom decals to your card photo via the Cosmetics AI
5. **Mint**: Pay in USDC to mint an ERC-721 NFT card with on-chain traits (name, series, faction, pilot, weapons, HP, damage values, armor type, rarity)
6. **Upgrade**: Enhance your card post-mint — upgrade weapons, boost stats, and evolve your build over time
7. **Battle**: Enter PVE arcs or PVP matches, staking $GNDM tokens on the outcome

### What Makes GundariuM Unique

- **Physical-to-digital bridge**: Your real Gunpla collection becomes your in-game deck. This isn't random minting — every card represents a model kit you own and photographed.
- **Lore-accurate stats**: Weapons, armor types, and factions are pulled from canonical Gundam data. An RX-78-2 fights differently than a Wing Zero because they should.
- **Grade = Rarity = Power**: A Perfect Grade kit (PG, Legendary) is genuinely harder to build and more expensive IRL — the game reflects that with a 1.5x stat multiplier. An SD kit (Common, 0.7x) is accessible but weaker. This creates natural economic stratification tied to real-world collecting.
- **Armor-type matchups**: I-Field blocks beam weapons (0.45x), Phase Shift nullifies physical melee (0.15x), GN Particles reduce ranged (0.65x), Luna Titanium resists melee (0.60x), Gundanium alloy reduces all (0.80x). Knowing your enemy's armor type matters.
- **AI-vision pipeline (built, available)**: A Claude AI analysis route exists in the codebase for automated Gunpla identification from photos. Currently inactive in the mint flow (stats come from the database), but ready to activate for future features like authenticity verification.
- **Cosmetics AI — where the real magic happens**: The upcoming Cosmetics AI feature lets players digitally paint their cards and add custom decals overlaid onto their photograph. This is the killer feature for Gunpla enthusiasts — seeing your real kit with custom color schemes and markings applied digitally. It's also the system's natural quality gate: users who mint with a non-Gunpla photo will find it difficult or impossible for the AI overlay to work properly, since the model needs to recognize Gunpla geometry to apply cosmetics accurately.

### Design Philosophy: Open Doors, Natural Incentives

During conception, I realized there are variables I can't control — anyone can upload any photo, whether it's a Gundam or not. Rather than building expensive verification gates that create friction and false negatives, I made a deliberate design choice: **the system is open to everyone, but rewards authenticity through features, not restrictions.**

Any user can mint a card with any photo and play the game. We don't gatekeep. But users who photograph real Gunpla kits unlock the full experience — the Cosmetics AI, the connection between your physical shelf and your digital deck, the pride of seeing your actual build as a battle card. The game self-selects for its target audience by making the best features work best with real Gunpla. No walls, just incentives.

### Target Audience

- **Gunpla builders** (massive global community — Bandai sells 600M+ kits worldwide)
- **Gundam anime fans** (the franchise spans 45+ years across every timeline)
- **Ronin gamers** already playing anime-adjacent titles (Axie, Pixels, Craft World)
- **NFT collectors** looking for utility-backed NFTs with real gameplay, not just art
- **Memecoin collectors** who want a token ($GNDM) with an actual game economy behind it
- **TCG players** who want strategic depth beyond auto-battle

---

## 3. Technical Architecture

### Smart Contracts (Solidity ^0.8.20, Foundry, OpenZeppelin v5)

All contracts use the UUPS upgradeable proxy pattern for safe iteration post-launch.

| Contract | Purpose | Status |
|----------|---------|--------|
| **GunplaCard** | ERC-721 with full `CardTraits` struct stored on-chain (name, series, faction, pilot, rarity, armor type, HP, 4 weapons with damage values). USDC mint pricing. Supports cosmetic upgrades (repaints, decals). | Deployed on Base Sepolia |
| **GundaniumGame** | Hybrid on-chain/off-chain battle model. Session creation + $GNDM staking on-chain; resolution via EIP-712 signed `BattleResult` from game server. PVP (10% protocol fee) and PVE (entry fee + arc rewards). | Deployed on Base Sepolia |
| **GNDMStaking** | Synthetix-style `rewardPerToken` yield accounting. 24hr lock after staking, 7-day reward eligibility window. | **Live on Base mainnet** |
| **$GNDM Token** | ERC-20 game token for staking and battle rewards. | **Live on Base mainnet** |

**Ronin deployment**: These contracts are chain-agnostic (standard OpenZeppelin + EIP-712). Deploying to Ronin requires updating RPC endpoints and configuring for RON gas. No architectural changes needed.

### Frontend (Next.js 16, React 19, TailwindCSS v4)

- **Mint flow**: 6-step state machine (suit search → grade select → photo upload → trait review → confirm → success)
- **Suit database**: 148 Mobile Suits with full metadata (weapons, armor types, stat ranges, available grades, series, faction, pilot)
- **Trait generation**: Client-side RNG from suit data with grade multipliers — deterministic, auditable, no server dependency
- **Wallet integration**: wagmi v3 + viem v2, with Farcaster miniapp connector

### Battle System (In Development)

- **Pokemon-style turn-based combat**: Players choose actions each turn (weapon selection, stances)
- **Real-time multiplayer**: WebSocket connections via Cloudflare Durable Objects for per-turn state management
- **Turn timer**: Chess-clock enforcement prevents stalling
- **4-weapon rotation**: Primary → secondary → tertiary → special, with armor-type effectiveness calculations
- **Client-side simulation**: Battle preview engine already built (`src/lib/battle/simulate.ts`) with full armor counter system

### Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| Frontend hosting | Vercel | Next.js deployment, previews, CDN |
| Battle server | Cloudflare Workers + Durable Objects | Stateful real-time game sessions |
| Game database | Cloudflare D1 | Leaderboard, battle history, off-chain data |
| NFT storage | Cloudflare R2 (migrating from Pinata) | Card images + metadata, zero egress fees |
| Anti-abuse | Cloudflare KV + Turnstile | Rate limiting, bot prevention |

---

## 4. Team

### PyroFire Labs

**Joshua Grubbs — Founder & Lead Developer**
Full-stack developer handling smart contracts (Solidity/Foundry), frontend (Next.js/React), and architecture. Started crypto development in November 2025 through the Farcaster community. Shipped a working MVP with deployed contracts, a complete mint flow, and a 148-suit curated database in under 5 months.

**Larry — AI Development Partner (Claude Code)**
GundariuM is built in collaboration with "Larry," an AI development partner powered by Claude Code. Larry is named after Joshua's father — an avid gamer who played the Madden series from its earliest days on the Sega Genesis with Madden 93. Larry isn't just a code generator; he's a core collaborator on architecture decisions, contract design, battle system planning, and this proposal. This is how a solo founder ships at studio velocity — the entire codebase, smart contracts, battle simulation engine, and grant proposal were developed through this partnership.

**Kayonfire (Farcaster) — Brand & Visual Design**
Contracted for GundariuM logo, promotional materials, and visual identity. Currently in production.

**NomadicFrame (Farcaster) — Advisor**
Creator of TYSM and the gratitude economy, with a 10K+ community of stakers. Mentor to Joshua since his entry into crypto development. Provides guidance on community building, token economics, and Farcaster ecosystem strategy.

**Battle Animation Designer — Hiring**
Three prospects currently being evaluated for 2D/3D battle animation sequences. Grant funding would accelerate this hire.

---

## 5. Ronin Ecosystem Fit

### Why GundariuM Belongs on Ronin

**The community is already here.** Ronin is the home of anime-adjacent gaming. Axie Infinity proved that creature-battling NFT games can build massive communities on this chain. GundariuM is the Gundam version of that thesis — but with real-world physical collectibles as the entry point.

**Complementary, not competitive.** No existing Ronin game bridges physical collectibles to on-chain gameplay. GundariuM adds a new category: phygital gaming. Every Gunpla builder who mints a card becomes a new Ronin user.

**Categories we fit:**
- Web3 games (primary)
- AI-driven applications (AI vision pipeline for card analysis)
- Bridge physical and digital commerce (Gunpla photos → NFT cards)

### Multi-Chain Strategy

GundariuM launches on both **Base** (existing community via Farcaster) and **Ronin** (gaming-native community). This isn't chain tourism — it's meeting players where they are:

- **Base**: Farcaster miniapp integration, Base App MiniApp integration, existing $GNDM token and staking contracts, social discovery
- **Ronin**: Gaming-first users, Katana DEX for $GNDM liquidity, Waypoint for frictionless onboarding, co-marketing with existing Ronin gaming community

Cross-chain play is a future roadmap item. At launch, each chain has its own card economy and battle ecosystem.

### User Onboarding via Ronin Waypoint

Ronin Waypoint integration removes the biggest barrier to adoption: wallet setup. New players can:
1. Sign up with email/social (no seed phrase)
2. Get gas-sponsored transactions (via Waypoint Gas Grant)
3. Mint their first card without ever touching a wallet UI
4. Gradually discover their on-chain identity as they play

This is critical for the Gunpla community, who are hobbyists first and crypto-native second.

---

## 6. Deployment Timeline

**Launch date: May 10, 2026 — Full launch, not a beta.**

Everything goes live simultaneously: Mint flow, Arena (PVE/PVP battles), Leaderboard, Prize Pools, and $GNDM staking. The site is already live at **gundarium.xyz** and registered as a Farcaster miniapp. The GundariuM whitepaper will be published prior to launch.

### Phase 1: Ronin Deployment (Weeks 1-3, Mar 20 – Apr 10)

- [ ] Deploy GunplaCard, GundaniumGame, GNDMStaking, $GNDM to Ronin testnet (Saigon)
- [ ] Configure wagmi for Ronin chain (RPC, chain ID 2020)
- [ ] Test full mint flow on Ronin testnet
- [ ] Integrate Ronin Waypoint SDK as primary login method
- [ ] Set up $GNDM on Katana DEX (testnet)

### Phase 2: Brand & Polish (Weeks 3-5, Apr 10 – Apr 24)

- [ ] Receive logo and promo materials from Kayonfire
- [ ] Landing page refresh with Ronin branding
- [ ] Battle UI wireframes and animation integration (if designer hired)
- [ ] Community building: Ronin Discord, cross-promotion with existing Ronin games
- [ ] Security review of contracts (pre-audit checklist)

### Phase 3: Mainnet & Launch (Weeks 5-7, Apr 24 – May 10)

- [ ] Deploy contracts to Ronin mainnet
- [ ] Smart contract audit (funded by grant)
- [ ] Provide initial $GNDM liquidity on Katana DEX
- [ ] Activate Waypoint gas sponsorship
- [ ] Launch day: May 10, 2026 — full launch on both chains
- [ ] Mint flow, Arena, Leaderboard, Prize Pools, $GNDM staking all live
- [ ] Simultaneous launch on Base mainnet + Ronin mainnet

### Phase 4: Post-Launch Growth (Weeks 8-16, May – July)

- [ ] PVP battle system beta (WebSocket battles via Durable Objects)
- [ ] Tournament system with $GNDM prize pools
- [ ] Leaderboard with seasonal rankings
- [ ] Community tournaments co-marketed with Ronin ecosystem
- [ ] Activate AI vision pipeline for card authenticity features

---

## 7. Budget Breakdown

### Forge Innovation Grant Request: $50,000 in RON

Core deployment and launch costs:

| Item | Amount | Purpose |
|------|--------|---------|
| Smart contract security audit | $8,000 | Professional audit of 4 contracts before mainnet |
| $GNDM liquidity (Katana DEX) | $15,000 | Initial liquidity pool for trading on Ronin |
| Battle animation designer | $12,000 | 2D/3D battle move sequences (3-month contract) |
| Brand & visual design | $3,000 | Logo, promo materials, landing page assets |
| Infrastructure (6 months) | $5,000 | Cloudflare Workers, R2 storage, D1 database |
| Ronin Waypoint integration | $4,000 | Development time for SDK integration + testing |
| Community launch campaign | $3,000 | Tournament prizes, early adopter rewards, content |
| **Total** | **$50,000** | |

### Ecosystem Builder Grant Request: $150,000 in RON

Milestone-based funding for sustained development:

| Milestone | Amount | Deliverable | Timeline |
|-----------|--------|-------------|----------|
| M1: Ronin Mainnet Launch | $30,000 | Contracts deployed, mint flow live, Waypoint integrated | May 10, 2026 |
| M2: PVP Battle System | $40,000 | Real-time WebSocket battles, matchmaking, ranked play | July 2026 |
| M3: Tournament System | $30,000 | Seasonal tournaments, leaderboard, prize pool distribution | September 2026 |
| M4: Cross-Chain Features | $25,000 | Base ↔ Ronin card bridging, unified leaderboard | November 2026 |
| M5: Mobile App | $25,000 | React Native app for photo capture + battle on mobile | January 2027 |
| **Total** | **$150,000** | | |

### Waypoint Gas Grant Request: $20,000 in RON

- Full Ronin Waypoint integration as primary login method
- Gas sponsorship for: card minting, battle session creation, staking transactions
- Goal: First 10,000 transactions gas-free for new users
- Estimated coverage: ~6 months of gas sponsorship at projected usage

### Combined Ask: $220,000 across all three programs

---

## 8. Growth Strategy

### Community Channels

| Channel | Strategy | Target |
|---------|----------|--------|
| **Ronin Discord** | Partner with existing game communities (Axie, Pixels, Craft World players) | Gaming-native users |
| **Farcaster** | Miniapp distribution, NomadicFrame's TYSM community (10K+ stakers) | Crypto-native builders |
| **Gunpla communities** | Reddit r/Gunpla (300K+), Instagram #gunpla (5M+ posts), YouTube builders | Hobbyists new to crypto |
| **Tournament marketing** | Weekly PVP tournaments with $GNDM prizes, seasonal rankings | Competitive players |

### Onboarding Funnel

```
Gunpla builder sees GundariuM → Signs up via Waypoint (email) → Photographs kit →
Mints first card (gas-free) → Plays PVE arc → Discovers $GNDM → Stakes → Enters PVP
```

The key insight: **every Gunpla builder already has the "NFT" on their shelf.** We're not asking them to buy a random JPEG — we're asking them to bring their existing collection on-chain. The barrier to entry is photographing something they're already proud of.

### Growth Metrics (6-month targets)

| Metric | Target |
|--------|--------|
| Cards minted | 5,000 |
| Unique players | 2,000 |
| Battle sessions | 10,000 |
| $GNDM holders | 1,500 |
| Ronin new users onboarded | 1,000 |

### Revenue Model

| Source | Mechanism |
|--------|-----------|
| Card minting | USDC mint fee per card |
| PVP battles | 10% protocol fee on $GNDM stakes |
| Cosmetic upgrades | USDC-gated repaints, decals, card borders |
| Tournament entry | Entry fees with prize pool distribution |

---

## 9. Links & Resources

| Resource | Link |
|----------|------|
| Website | gundarium.xyz (live, Farcaster miniapp) |
| Whitepaper | Published at gundarium.xyz (pre-launch) |
| GitHub | github.com/PyroFireZero/GundariuM |
| Contracts (Base Sepolia) | GunplaCard, GundaniumGame deployed and verified |
| Contracts (Base Mainnet) | $GNDM token + GNDMStaking live with active stakers |
| Farcaster | @pyrofirezero |
| Founder | Joshua Grubbs |
| Studio | PyroFire Labs |

---

## 10. Summary

GundariuM brings something new to Ronin: a game where your real-world collection is your deck. Every Gunpla kit photographed and minted is a new user onboarded, a new card in the economy, and a new reason for the massive global Gunpla community to discover blockchain gaming.

I'm not a studio with a pitch deck and no product. I'm a solo founder with contracts live on Base mainnet, active stakers, a working MVP, and a launch date 51 days away. I play on Ronin already. I want to build here.

**PyroFire Labs is ready to deploy. We're asking Ronin to bet on us.**

---

## Legal Disclaimer

GundariuM is an independent fan project. PyroFire Labs holds no rights to the name, likeness, or intellectual property of Mobile Suit Gundam, Gunpla, or any related franchise properties. GundariuM is not affiliated with, endorsed by, or sponsored by Bandai Namco, Sunrise, Sotsu, or any rights holders of the Gundam franchise. All Mobile Suit names, model numbers, pilot names, faction names, series titles, and lore references are the property of their respective owners and are used solely for identification and gameplay purposes within a fan-created experience.
