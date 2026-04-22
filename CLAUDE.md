# GundariuM — CLAUDE.md

GundariuM is a Gunpla NFT battle game on the Base blockchain. Users roll traits from a pool of ~69M combinations and Gemini AI generates a unique kitbashed Mobile Suit ("Gundar-Frame") which is minted as an ERC-721 NFT on Base. Users name their own Gundar-Frame on the reveal step. Cards are used in turn-based PVE and PVP battles with $GUNR token staking. (A photograph-your-real-kit premium tier is preserved in `src/components/mint/_deprecated/` for future rollout.)

---

## Repo structure

```
GundariuM/
├── src/                        # Next.js 16 app (frontend + API routes)
│   ├── app/                    # App Router pages and API routes
│   │   ├── page.tsx            # Landing page with live GNDM ticker
│   │   ├── layout.tsx          # Root layout — fonts, metadata, Farcaster miniapp embed
│   │   ├── mint/               # Multi-step Gunpla minting flow
│   │   ├── arena/              # PVE arena page
│   │   ├── battle/             # PVP battle page
│   │   ├── collection/         # User NFT collection viewer
│   │   ├── leaderboard/        # Battle leaderboard
│   │   ├── stake/              # GNDM staking UI
│   │   ├── buy-gndm/           # Token purchase page (0x DEX / Farcaster native swap)
│   │   └── api/
│   │       ├── analyze-gunpla/ # POST — sends image to Claude, returns TraitSet
│   │       ├── mint-metadata/  # POST — uploads image + metadata to IPFS via Pinata
│   │       ├── gndm-quote/     # GET  — fetches GNDM price from 0x DEX
│   │       └── gndm-swap/      # POST — executes GNDM swap (0x or Farcaster native)
│   ├── components/
│   │   ├── mint/               # SuitSearch, GradePicker, PhotoDropzone, TraitReview, MintConfirm, MintSuccess
│   │   ├── nav/                # Navbar
│   │   ├── providers/          # Providers (wagmi + react-query), FarcasterInit
│   │   ├── ui/                 # CountdownTimer / CountdownPage, ComingSoon
│   │   └── wallet/             # ConnectButton
│   ├── store/
│   │   ├── useMintStore.ts     # Zustand — multi-step mint flow state machine
│   │   ├── useBattleStore.ts   # Zustand — battle session state
│   │   └── useArenaStore.ts    # Zustand — PVE arena state
│   ├── lib/
│   │   ├── claude/
│   │   │   └── analyzeGunpla.ts  # Claude Sonnet 4.6 + extended thinking image analysis
│   │   ├── battle/
│   │   │   └── simulate.ts     # Client-side battle simulation (armor counters, weapon rotation)
│   │   ├── contracts/
│   │   │   ├── abis/           # GunplaCard, GundaniumGame, GNDMStaking, ERC20 ABIs
│   │   │   ├── addresses.ts    # Contract addresses by chainId (Base + Base Sepolia)
│   │   │   └── hooks/          # useCollection, useMint, useStaking wagmi hooks
│   │   ├── constants/
│   │   │   ├── factions.ts     # 10 canonical Gundam factions with universe and color
│   │   │   ├── prompts.ts      # Claude vision prompt (versioned, buildGunplaPrompt())
│   │   │   └── tokens.ts       # Token constants
│   │   ├── pinata/upload.ts    # uploadImage() and uploadMetadata() to IPFS
│   │   ├── wagmi.ts            # wagmi config — Base + Base Sepolia, 3 connectors
│   │   ├── farcasterConnector.ts # Custom wagmi connector for Farcaster miniapp wallet
│   │   ├── ipfs.ts             # IPFS gateway helpers
│   │   ├── utils.ts            # clsx/tailwind-merge cn() helper
│   │   └── og/generateOgImage.tsx # Satori OG image generator
│   └── types/
│       ├── nft.ts              # TraitSet, GunplaCardMetadata, Rarity, KitGrade, ArmorType, etc.
│       ├── battle.ts           # BattleState, TurnResult, SubmitMoveRequest, etc.
│       └── api.ts              # API request/response types
├── contracts/                  # Foundry smart contracts (separate sub-project)
│   ├── src/
│   │   ├── GunplaCard.sol      # ERC-721 NFT (UUPS upgradeable, USDC mint price)
│   │   ├── GundaniumGame.sol   # Battle contract (EIP-712 off-chain resolution)
│   │   ├── GNDMStaking.sol     # Synthetix-style GNDM staking (24h lock, 7-day reward)
│   │   ├── PrizePool.sol       # Prize pool distribution
│   │   └── MockERC20.sol       # Test token
│   ├── script/                 # Deploy.s.sol, DeployStaking.s.sol
│   ├── test/                   # GNDMStaking.t.sol
│   ├── foundry.toml            # Foundry config (via_ir=true, optimizer_runs=200)
│   └── plans/                  # Design docs for contract features
├── docs/plans/                 # Frontend/product design docs
├── public/                     # Static assets
├── eslint.config.mjs
├── next.config.ts              # React compiler enabled
├── tsconfig.json               # paths: "@/*" → "./src/*"
└── vercel.json                 # alias: gundarium.vercel.app
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | TailwindCSS v4, CSS custom properties for theming |
| Fonts | Orbitron (headings/accent), Geist Sans + Geist Mono |
| State | Zustand (client stores) |
| Web3 | wagmi v3, viem v2 |
| AI (analysis) | `@anthropic-ai/sdk` — Claude Sonnet 4.6 with extended thinking (RWA tier) |
| AI (generation) | `@google/genai` — Gemini 2.5 Flash Image (kitbash minting) |
| IPFS | Pinata SDK v2 |
| Smart Contracts | Solidity ^0.8.20+, Foundry, OpenZeppelin upgradeable v5 |
| Blockchain | Base mainnet (8453), Base Sepolia testnet (84532) |
| Social | Farcaster miniapp via `@farcaster/miniapp-sdk` |
| Deployment | Vercel |

---

## Development commands

```bash
# Frontend (from repo root)
npm run dev        # start dev server at localhost:3000
npm run build      # production build
npm run lint       # ESLint

# Contracts (from contracts/ directory)
forge build        # compile contracts
forge test         # run tests
forge script script/Deploy.s.sol --broadcast --rpc-url $BASE_RPC_URL
```

---

## Environment variables

All secrets go in `.env.local` (never committed — `.env*` is gitignored).

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Server-side — Claude API key for Gunpla image analysis (RWA tier) |
| `GOOGLE_AI_API_KEY` | Server-side — Gemini API key for kitbash image generation |
| `PINATA_JWT` | Pinata JWT for IPFS uploads |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |
| `NEXT_PUBLIC_MINT_ENABLED` | Set `"true"` to enable the mint page (otherwise shows countdown) |
| `BASESCAN_API_KEY` | Foundry contract verification (contracts only) |

---

## Mint flow (state machine)

The mint page is a 5-step Zustand state machine in `useMintStore.ts`:

```
idle → generating → reveal → confirming → success
```

| Step | Component | What happens |
|---|---|---|
| `idle` | `MintLanding` | User optionally selects a faction, clicks "MINT YOUR GUNPLA" |
| `generating` | spinner | Traits are randomly rolled, `POST /api/generate-kitbash` calls Gemini to generate a unique kitbash image |
| `reveal` | `GenerationReveal` | User sees their generated card with trait badges, rarity breakdown, and battle stats |
| `confirming` | `MintConfirm` | Image + metadata uploaded to Pinata IPFS, user approves USDC + mints on-chain |
| `success` | `MintSuccess` | Shows minted NFT with animated reveal |

The `NEXT_PUBLIC_MINT_ENABLED` flag guards the entire flow — when `false`, the page shows a `CountdownPage` instead.

The original photo-your-kit mint components (SuitSearch, GradePicker, PhotoDropzone, TraitReview) are preserved in `src/components/mint/_deprecated/` for the future RWA premium tier.

---

## AI generation pipeline

**File:** `src/lib/kitbash/generate.ts`

- Model: Gemini `gemini-2.5-flash-image` with `responseModalities: ["TEXT", "IMAGE"]`
- Input: assembled prompt from rolled `KitbashTraits` (frame type, head, weapon, backpack, colorway, stance, background, special)
- Output: base64-encoded PNG image of a unique kitbashed Mobile Suit
- Generation time: ~8-15 seconds

**Trait system:** `src/lib/kitbash/traits.ts`

- 8 trait categories with weighted rarity tables (~69M+ unique combinations)
- Card rarity is a direct weighted roll, independent of the traits rolled
- Per-trait rarity labels are percentile-based over the pool (for trait-badge flavor only — they do NOT feed into card rarity)
- Battle stats (HP, damage values) derived from card rarity using non-overlapping HP bands
- Optional faction hint biases trait selection toward that faction's canon (frames, heads, weapons, backpacks, colorway)

**Stat derivation** (`src/lib/kitbash/traits.ts`):
- **Card rarity** — `deriveCardRarity()` rolls against a fixed 50/25/15/7/3 distribution (Common/Uncommon/Rare/Ultra Rare/Legendary). Decoupled from traits so the distribution stays stable as trait tables evolve.
- **Per-trait rarity** — `getTraitRarity()` walks the table sorted by weight descending and returns the tier based on where the trait falls in the cumulative distribution: top 50% → Common, 50–75% → Uncommon, 75–90% → Rare, 90–97% → Ultra Rare, 97–100% → Legendary.
- **HP ranges** — Common 150–349, Uncommon 350–599, Rare 600–899, Ultra Rare 900–1199, Legendary 1200–2000 (non-overlapping, ~7× Legendary-to-Common spread).
- **Weapon damages** are percentages of HP: primary 15–25%, secondary 25–40%, tertiary 8–15%, special 50–80%.

**Naming** (`src/lib/kitbash/namePools.ts`):
- Users name their own Gundar-Frame on the reveal step (32-char ASCII, blocks "gundam" and a hardcoded profanity/hate-speech list)
- If the user leaves the input blank, a rarity-mapped pool name is picked (Common → "Aegis-Titan" etc., Legendary → "Ω Iron-Duke" etc.)
- Server-side `validateNameContent()` in `/api/mint-metadata` enforces the same content rules as a safety net against direct-POST bypass

**When updating the generation prompt:**
- Modify `buildPrompt()` in `src/lib/kitbash/generate.ts`
- The prompt must produce clean 3D-rendered mecha art — not anime/cartoon style
- Test changes using `scripts/test-kitbash-gen.ts` before deploying

**RWA analysis pipeline (preserved for future use):**
- `src/lib/claude/analyzeGunpla.ts` — Claude Sonnet 4.6 photo analysis
- `src/app/api/analyze-gunpla/route.ts` — photo analysis API route

---

## Smart contracts

All contracts use the UUPS upgradeable proxy pattern (OpenZeppelin v5).

### GunplaCard (`src/GunplaCard.sol`)
- ERC-721 with `ERC721URIStorage` + `ERC721Enumerable`
- Mint price in USDC (6-decimal); caller must pre-approve
- Stores full `CardTraits` struct on-chain
- Cosmetic updates (repaint/decal) also cost USDC
- Token IDs start at 1 (0 is reserved as "nonexistent")

### GundaniumGame (`src/GundaniumGame.sol`)
- Hybrid on-chain/off-chain battle model
- Session creation and GNDM staking happen on-chain
- Battle resolution is done off-chain by the trusted game server
- Server submits an EIP-712 signed `BattleResult` to settle
- PVP: 10% protocol fee on loser's stake; winner gets `stake * 2 - fee`
- PVE: entry fee returned + arc reward on completion; `arcGndmReward` configurable per arc

### GNDMStaking (`src/GNDMStaking.sol`)
- Synthetix-style `rewardPerToken` yield accounting
- 24-hour lock after staking (re-staking resets the clock)
- 7-day reward eligibility window (re-staking forfeits pending rewards if not yet eligible)
- Rewards can be funded by owner (`notifyRewardAmount`) or by authorized game contracts (`receiveGameFees`)
- UUPS upgradeable + Pausable

### Contract addresses

| Chain | GunplaCard | GundaniumGame | GNDMStaking | GNDM token |
|---|---|---|---|---|
| Base Sepolia (84532) | `0x47d0...4d8f` | `0x27c0...3754` | `0x4fFF...48E7` | `0x6Add...fFa4` |
| Base mainnet (8453) | not yet deployed | not yet deployed | `0x43b2...bdA6` | `0xfc70...4ba3` |

Use `getContracts(chainId)` from `src/lib/contracts/addresses.ts`. Use `isPlaceholder(address)` to check if a mainnet address hasn't been deployed yet.

---

## Battle simulation

**File:** `src/lib/battle/simulate.ts`

Client-side auto-battle used for PVE arena preview:
- Both combatants attack simultaneously each turn using a 4-slot weapon rotation: primary → secondary → tertiary → special
- Armor type counters: I-Field blocks beam (0.45×), Phase Shift blocks physical melee (0.15×), GN Particle reduces ranged (0.65×), Luna Titanium reduces melee (0.60×), Gundanium reduces all (0.80×)
- Max 40 turns; tiebreak by highest remaining HP percentage
- Enemy weapon picks are seeded by `sessionId % 3` offset for variety

---

## Wallet / Farcaster integration

Wagmi config (`src/lib/wagmi.ts`) registers three connectors in priority order:
1. `farcasterConnector` — custom connector for Farcaster miniapp embedded wallet
2. `injected()` — MetaMask / browser wallet
3. `walletConnect({ projectId })` — WalletConnect QR modal

`FarcasterInit` component auto-connects via `sdk.wallet.ethProvider` when running inside a Farcaster miniapp context.

The `buy-gndm` page detects if it's in a miniapp context and uses the Farcaster native `swapToken` action instead of the 0x DEX flow.

The Farcaster miniapp embed is declared in the root `layout.tsx` metadata under `fc:miniapp`.

---

## Theming conventions

All colors are CSS custom properties defined in `globals.css`:
- `--accent` — primary accent (yellow/gold)
- `--accent-2` — secondary accent (blue)
- `--background`, `--surface`, `--surface-2` — dark background layers
- `--foreground` — text color
- `--border` — subtle border color

Use the `cn()` helper from `src/lib/utils.ts` (wraps `clsx` + `tailwind-merge`) for conditional class names.

Use `font-[family-name:var(--font-orbitron)]` for all headings, labels, and buttons. Use Geist for body copy.

---

## Factions

10 canonical Gundam factions are defined in `src/lib/constants/factions.ts`:

| Key | Name | Universe |
|---|---|---|
| `EFSF` | Earth Federation Space Force | Universal Century |
| `ZEON` | Principality of Zeon | Universal Century |
| `ZAFT` | Zodiac Alliance of Freedom Treaty | Cosmic Era |
| `ALLIANCE` | Earth Alliance | Cosmic Era |
| `OZ` | Organization of the Zodiac | After Colony |
| `GUNDAM_WING_TEAM` | Gundam Meisters (Wing) | After Colony |
| `CELESTIAL_BEING` | Celestial Being | Anno Domini |
| `HUMAN_REFORM_LEAGUE` | Human Reform League | Anno Domini |
| `INNOVATION` | Innovators | Anno Domini |
| `UNKNOWN` | Unknown Faction | Unknown |

---

## Feature flags

| Flag | Default | Behavior when false |
|---|---|---|
| `NEXT_PUBLIC_MINT_ENABLED` | `false` | Mint page shows `CountdownPage` (May 10, 2026 launch) |

Pages for Arena, Battle, Collection, Leaderboard, and Stake are expected to also be gated — check for `CountdownPage` / `ComingSoon` usage in each page component.

---

## Key conventions

- **Path alias:** `@/` maps to `src/` (configured in `tsconfig.json`)
- **TypeScript everywhere** — no `.js` files in `src/`
- **No test framework** currently set up for the frontend
- **Contracts:** Foundry only — no Hardhat
- **Formatting:** no explicit Prettier config; ESLint is the linter (`npm run lint`)
- **React 19 + React Compiler** (`reactCompiler: true` in `next.config.ts`) — avoid manual `useMemo`/`useCallback` optimizations
- **Don't add `console.log`** to frontend code; API routes use `console.error` for server-side errors only
- **Solidity style:** section headers use `// ─── Section ────` divider pattern; custom errors preferred over `require` strings in new code; `SafeERC20` for all token transfers
- **Deprecated exports:** `GNDM_TOKEN_ADDRESS` in `addresses.ts` is deprecated — use `getContracts(chainId).gndmToken`
