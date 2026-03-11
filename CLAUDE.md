# GundariuM — CLAUDE.md

GundariuM is a Gunpla NFT battle game on the Base blockchain. Users photograph real Gunpla model kits, Claude AI identifies the Mobile Suit and assigns lore-accurate stats, and the result is minted as an ERC-721 NFT ("Gunpla Card") on Base. Cards are used in turn-based PVE and PVP battles with $GNDM token staking.

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
| AI | `@anthropic-ai/sdk` — Claude Sonnet 4.6 with extended thinking |
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
| `ANTHROPIC_API_KEY` | Server-side — Claude API key for Gunpla image analysis |
| `PINATA_JWT` | Pinata JWT for IPFS uploads |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |
| `NEXT_PUBLIC_MINT_ENABLED` | Set `"true"` to enable the mint page (otherwise shows countdown) |
| `BASESCAN_API_KEY` | Foundry contract verification (contracts only) |

---

## Mint flow (state machine)

The mint page is a 7-step Zustand state machine in `useMintStore.ts`:

```
suit_search → grade_select → idle → uploading → analyzing → reviewing → confirming → success
```

| Step | Component | What happens |
|---|---|---|
| `suit_search` | `SuitSearch` | User searches the 148-suit database and selects their Mobile Suit |
| `grade_select` | `GradePicker` | User selects kit grade (SD/HG/RG/MG/MG_VERKA/HIRM/PG) |
| `idle` | `PhotoDropzone` | User uploads a photo |
| `uploading` | spinner | Image is uploaded to Pinata IPFS |
| `analyzing` | spinner | `POST /api/analyze-gunpla` sends image to Claude |
| `reviewing` | `TraitReview` | User reviews and can edit the AI-generated traits |
| `confirming` | `MintConfirm` | User approves USDC + calls `mintCard()` on-chain |
| `success` | `MintSuccess` | Shows minted NFT |

The `NEXT_PUBLIC_MINT_ENABLED` flag guards the entire flow — when `false`, the page shows a `CountdownPage` instead.

---

## AI analysis pipeline

**File:** `src/lib/claude/analyzeGunpla.ts`

- Model: `claude-sonnet-4-6` with extended thinking (`budget_tokens: 8000`)
- Input: base64 image + `KitGrade` (pre-confirmed by user, not detected)
- Output: `SuitIdentification` JSON — name, series, faction, pilot, armor type, 4 weapons, confidence score
- Prompt: `buildGunplaPrompt(grade)` in `src/lib/constants/prompts.ts` (currently v3.1.1)
- The API route `POST /api/analyze-gunpla` merges the Claude output with server-derived stats (HP range by rarity, damage multipliers) to produce the full `TraitSet`

**Stat derivation** (in the API route, not Claude):
- Grade → Rarity mapping: SD/HG=Common, RG=Uncommon, MG=Rare, MG_VERKA/HIRM=Ultra Rare, PG=Legendary
- HP ranges: Common 150–349, Uncommon 350–599, Rare 600–899, Ultra Rare 900–1199, Legendary 1200–2000
- Weapon damages are percentages of HP (primary 15–25%, secondary 25–40%, tertiary 8–15%, special 50–80%)

**When updating the Claude prompt:**
- Bump `PROMPT_VERSION` in `prompts.ts`
- The prompt must always return pure JSON (no markdown fences), ASCII only (no Unicode above U+007F, use hyphens not em dashes)
- Never return `null` — always provide a best estimate

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
