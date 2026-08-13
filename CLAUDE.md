# GundariuM — CLAUDE.md

GundariuM is a Gunpla NFT battle game on the Base blockchain. Users roll traits from a pool of ~69M combinations and Gemini AI generates a unique kitbashed Mobile Suit ("Gundar-Frame") which is minted as an ERC-721 NFT on Base. Users name their own Gundar-Frame on the reveal step. Minting is **live and open on Base mainnet** — public mint, no whitelist cap. Cards are used in a live turn-based PVE Arena demo today; real PVP battle-staking (via `GundaniumGame`) is built and tested on Sepolia but not yet deployed to mainnet. The ecosystem token is **$GNRM**, live and tradeable via Streme.fun. (A photograph-your-real-kit premium tier is preserved in `src/components/mint/_deprecated/` for future rollout.)

**Token history:** GundariuM's token has been through three identities — $GNDM, then $GUNR, now $GNRM. Both earlier tokens' liquidity pools are dead (not purchasable). If you see `GNDM`/`GUNR` naming anywhere in this codebase, it's either (a) a real historical artifact worth understanding before touching, or (b) leftover cruft worth flagging — see the notes throughout this doc for which is which.

---

## Repo structure

```
GundariuM/
├── src/                        # Next.js 16 app (frontend + API routes)
│   ├── app/                    # App Router pages and API routes
│   │   ├── page.tsx            # Landing page — hero, kitbash gallery, game loop, GNRM section
│   │   ├── layout.tsx          # Root layout — fonts, metadata, Farcaster miniapp embed
│   │   ├── opengraph-image.tsx # Root OG share-card image (Satori-rendered)
│   │   ├── mint/                     # Multi-step Gunpla minting flow (live)
│   │   ├── arena/                    # PVE arena — live, playable turn-based demo
│   │   ├── battle/                   # PVP battle page — ComingSoon (real-time PVP not built yet)
│   │   ├── collection/               # User NFT collection viewer (live)
│   │   ├── leaderboard/              # ComingSoon (needs GundaniumGame mainnet + real data)
│   │   ├── stake/                    # Redirects to GNRM's Streme.fun page — no in-app staking UI
│   │   ├── tasks/                    # Daily Check-In — six-task checklist, Frame-Runner EXP
│   │   ├── card/[tokenId]/           # Public shareable single-card page (reads on-chain metadata)
│   │   ├── terms/, privacy/          # Legal pages
│   │   ├── .well-known/farcaster.json/ # Farcaster miniapp manifest (account association + metadata)
│   │   └── api/
│   │       ├── analyze-gunpla/       # POST — sends image to Claude, returns TraitSet (RWA tier)
│   │       ├── generate-kitbash/     # POST — Gemini kitbash image generation for the live mint flow
│   │       ├── mint-metadata/        # POST — uploads image + metadata to IPFS via Pinata
│   │       ├── generate-model/       # POST — enqueues 3D-model generation job (see "3D model pipeline" below)
│   │       ├── model-status/[tokenId]/ # GET — polled job status (pending/processing/ready/failed) + GLB URL
│   │       ├── runner-profile/[address]/ # GET — Farcaster identity lookup (via src/lib/neynar.ts), edge-cached 30min
│   │       └── og/dossier/[address]/, og/victory/  # Satori-rendered share-card images (streak/EXP, battle result)
│   ├── components/
│   │   ├── mint/                # MintLanding, GenerationReveal, MintConfirm, MintSuccess; _deprecated/ has the old photo-based flow
│   │   ├── nav/                 # Navbar — Stake and Buy GNRM both open Streme.fun via openInMiniAppOrBrowser
│   │   ├── providers/           # Providers (wagmi + react-query), FarcasterInit
│   │   ├── ui/                  # ShareButtons, ComingSoon (used for not-yet-live pages)
│   │   ├── wallet/               # ConnectButton
│   │   └── card/Model3DViewer.tsx # 2D↔3D toggle, polls model-status, lazy-loads @google/model-viewer
│   ├── store/
│   │   ├── useMintStore.ts     # Zustand — multi-step mint flow state machine
│   │   ├── useBattleStore.ts   # Zustand — battle session state
│   │   └── useArenaStore.ts    # Zustand — PVE arena state
│   ├── lib/
│   │   ├── claude/analyzeGunpla.ts   # Claude, extended thinking image analysis (RWA tier, preserved)
│   │   ├── battle/
│   │   │   ├── simulate.ts     # Client-side battle simulation (armor counters, weapon rotation)
│   │   │   └── arcs.ts         # PVE campaign arc definitions (CampaignArc.gnrmReward is display-only — see Smart contracts)
│   │   ├── card/frame-config.ts # Card image layout constants (dimensions, padding) for rendered card art
│   │   ├── contracts/
│   │   │   ├── abis/           # GunplaCard, GundaniumGame, DailyCheckIn, GNDMtoGUNR (migration, retired), ERC20
│   │   │   ├── addresses.ts    # Contract addresses by chainId — getContracts(chainId), isPlaceholder(address)
│   │   │   └── hooks/          # useCollection, useMint, useDailyCheckIn, useGnrmPurchaseCheck,
│   │   │                       # useMintedTodayCheck, useStakedTodayCheck, utcDailyWindow.ts (shared helper)
│   │   ├── constants/
│   │   │   ├── factions.ts     # 10 canonical Gundam factions with universe and color
│   │   │   └── prompts.ts      # Claude vision prompt (versioned, buildGunplaPrompt())
│   │   ├── kitbash/             # generate.ts, traits.ts, namePools.ts — the live AI generation pipeline
│   │   ├── modelStore.ts       # Redis queue + status for the 3D model pipeline (shared key scheme with worker/)
│   │   ├── queueModelGeneration.ts # Client-side fire-and-forget POST to /api/generate-model, called from MintConfirm
│   │   ├── hooks/useModelStatus.ts # Client-side poller for /api/model-status/[tokenId]
│   │   ├── og/generateOgImage.tsx # Shared Satori OG image template (icon + title + status label, no countdown)
│   │   ├── pinata/upload.ts    # uploadImage() and uploadMetadata() to IPFS
│   │   ├── neynar.ts           # Server-only Neynar client — Farcaster identity by address, backs /api/runner-profile
│   │   ├── rateLimit.ts        # In-memory per-instance rate limiter (used by generate-kitbash)
│   │   ├── rng.ts              # Grade/rarity RNG helpers for the RWA photo-analysis pipeline
│   │   ├── turnstile.ts        # Cloudflare Turnstile server-side verification
│   │   ├── openInMiniAppOrBrowser.ts # Opens a URL via Farcaster's openMiniApp when in-app, else window.open
│   │   ├── wagmi.ts            # wagmi config — Base + Base Sepolia, 3 connectors
│   │   ├── farcasterConnector.ts # Custom wagmi connector for Farcaster miniapp wallet
│   │   ├── ipfs.ts             # IPFS gateway helpers
│   │   └── utils.ts            # clsx/tailwind-merge cn() helper
│   └── types/
│       ├── nft.ts              # TraitSet, GunplaCardMetadata, Rarity, KitGrade, ArmorType, etc.
│       ├── battle.ts           # BattleState (has gnrmStaked), TurnResult, SubmitMoveRequest, etc.
│       ├── runner.ts           # RunnerProfile / RunnerSocial — the shape /api/runner-profile returns
│       └── api.ts              # API request/response types
├── contracts/                  # Foundry smart contracts (separate sub-project)
│   ├── src/
│   │   ├── GunplaCard.sol      # ERC-721 NFT (UUPS upgradeable, USDC mint price) — LIVE on Base mainnet
│   │   ├── GundaniumGame.sol   # Battle contract (EIP-712 off-chain resolution) — Sepolia only
│   │   ├── DailyCheckIn.sol    # UUPS, streak tracking, UTC-midnight resets — LIVE on Base mainnet
│   │   ├── GNDMtoGUNR.sol      # Original GNDM→GUNR migration contract — RETIRED, paused, funds recovered
│   │   ├── PrizePool.sol       # Prize pool distribution
│   │   └── MockERC20.sol       # Test token
│   ├── script/                 # Deploy.s.sol, DeployGunplaCard.s.sol, DeployDailyCheckIn.s.sol, DeployMigration.s.sol, UpgradeGunplaCard.s.sol
│   ├── test/                   # GunplaCard.t.sol, DailyCheckIn.t.sol, GNDMtoGUNR.t.sol
│   ├── foundry.toml            # Foundry config (via_ir=true, optimizer_runs=200)
│   └── plans/                  # Design docs for contract features
├── worker/                     # 3D model generation worker (separate sub-project, see below)
│   ├── blender/                # assemble.py (headless bpy entry) + lib/components.py (placeholder geometry)
│   ├── src/                    # queue.ts, worker.ts, modelStore.ts, pinataUpload.ts, alert.ts
│   └── README.md               # Architecture, how to run, how to swap in real 3D art
├── docs/                       # Whitepaper (whitepaper.md is the source; generate-whitepaper-pdf.py builds the PDF via pandoc + headless Chrome), superpowers specs/plans
├── public/                     # Static assets, GundariuMwhitepaper.pdf
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
| AI (analysis) | `@anthropic-ai/sdk` — Claude with extended thinking (RWA tier, preserved for future use) |
| AI (generation) | `@google/genai` — Gemini 2.5 Flash Image (kitbash minting, live) |
| Farcaster identity | Neynar API via `src/lib/neynar.ts`, server-only |
| Anti-bot | Cloudflare Turnstile (`src/lib/turnstile.ts`) |
| IPFS | Pinata SDK v2 |
| Smart Contracts | Solidity ^0.8.20+, Foundry, OpenZeppelin upgradeable v5 (UUPS, except the retired migration contract, which is flat) |
| Blockchain | Base mainnet (8453), Base Sepolia testnet (84532) |
| Token / Staking | $GNRM launched via Streme.fun — native Superfluid streaming staking (stGNRM), no custom staking contract |
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
forge script script/DeployGunplaCard.s.sol --broadcast --rpc-url $BASE_RPC_URL --account deployer
```

---

## Secrets

**Managed via Doppler**, project `gundarium`, configs `dev`/`stg`/`prd` — not a checked-in `.env.local` as the primary source of truth (one may exist locally for tooling like the whitepaper PDF script, but Doppler is authoritative). Run frontend/scripts with `doppler run --project gundarium --config dev -- <command>` to inject secrets into the process env.

**Never read or write Doppler secret *values* directly** (`doppler secrets get/set/delete/upload`) — these commands echo full secret tables to stdout, a real exposure risk. `doppler run -- <command>` is fine since the value never gets displayed. If a secret needs to change, hand the owner the exact command to run themselves.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Server-side — Claude API key for Gunpla image analysis (RWA tier) |
| `GOOGLE_AI_API_KEY` | Server-side — Gemini API key for kitbash image generation |
| `NEYNAR_API_KEY` | Server-side — Farcaster identity lookups (`src/lib/neynar.ts`) |
| `PINATA_JWT` | Pinata JWT for IPFS uploads |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile anti-bot verification |
| `BATTLE_RESOLVER_PRIVATE_KEY` | EIP-712 signing key for the trusted game server (GundaniumGame battle settlement) |
| `BASE_RPC_URL` / `NEXT_PUBLIC_BASE_SEPOLIA_RPC` | RPC endpoints |
| `NEXT_PUBLIC_CHAIN_ID` | Target chain for client reads (8453 in production) |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC address used directly by `useMint.ts` (not via `addresses.ts`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID |
| `NEXT_PUBLIC_MINT_ENABLED` | Set `"true"` to enable the mint/collection pages (otherwise shows `ComingSoon`) — `true` in production |
| `BASESCAN_API_KEY` | Foundry contract verification (contracts only) |
| `FARCASTER_HEADER` / `FARCASTER_PAYLOAD` / `FARCASTER_SIGNATURE` | Farcaster account-association proof, served from `.well-known/farcaster.json` |
| `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` | Coinbase Developer Platform |

Note: `addresses.ts`'s `getContracts(chainId)` is the source of truth for `gunplaCard`/`gundaniumGame`/`prizePool`/`migration`/`dailyCheckIn` addresses — most contract addresses are **not** read from env vars.

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

The `NEXT_PUBLIC_MINT_ENABLED` flag guards the mint and collection pages — when `false`, they show `ComingSoon` instead. It's `true` in production; mint is live.

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
- `src/lib/claude/analyzeGunpla.ts` — Claude photo analysis
- `src/app/api/analyze-gunpla/route.ts` — photo analysis API route

---

## 3D model pipeline

Every real mint also gets a 3D model (GLB), generated in the background
alongside the Gemini 2D card art. Full architecture and run instructions:
**`worker/README.md`** — this section is the short version.

**Trigger point:** `handleMint()` in `MintConfirm.tsx`, right after a mint
transaction confirms and the tokenId is parsed from the `Transfer` event —
not at generation/reveal time, since a reveal can be rerolled or abandoned
before payment and would otherwise render models nobody ends up owning.
`queueModelGeneration()` (`src/lib/queueModelGeneration.ts`) fires a
non-blocking `POST /api/generate-model` with the tokenId + geometry-relevant
`KitbashTraits`; it never blocks or fails the mint flow itself.

**Where it runs:** `worker/` is a standalone package (own `package.json`,
not part of the Next.js build) that runs wherever headless Blender is
installed — **not Vercel**, which can't run long-lived native processes.
**No host is provisioned for it yet** — see `worker/README.md`'s "open
questions" section.

**Data flow:** `POST /api/generate-model` enqueues onto a Redis list
(`src/lib/modelStore.ts`); `worker/src/worker.ts` polls it (Upstash's REST
API has no blocking pop), shells out to `blender --background --python
worker/blender/assemble.py`, uploads the resulting GLB to IPFS via Pinata,
and writes `{ status, uri }` to `model:status:<tokenId>` in the same Redis
instance. `GET /api/model-status/[tokenId]` (polled by `useModelStatus.ts`,
used on the card page and the mint success screen) reads that key. The GLB
URI is **not** part of the immutable on-chain `tokenURI` metadata — it's
looked up out-of-band by tokenId, the same pattern `leaderboardStore.ts`
uses for off-chain cached data.

**The geometry is a placeholder**, not final art. `worker/blender/lib/
components.py` procedurally assembles a blocky mecha from primitives,
deterministic per trait name (same trait always → same shape/color) —
because hand-modeling real Gunpla components for all ~94 distinct trait
options is a 3D-art task that hasn't happened yet, not something to fake by
skipping the pipeline. The pipeline itself is real and complete end-to-end;
only the shapes it assembles are stand-ins. See `worker/README.md` for
exactly what changes when real art is ready to drop in (only
`components.py`'s `build_*` functions — nothing about the queue, worker, API
routes, or viewer needs to change).

**Viewer:** `src/components/card/Model3DViewer.tsx` shows the 2D card image
by default (always available immediately) and offers a "VIEW IN 3D" toggle
once the model's ready, backed by Google's `@google/model-viewer` web
component (lazy-loaded client-side only). Wired into the public card page
(`/card/[tokenId]`); `MintSuccess.tsx` shows a lighter "forging" status pill
that links to the card page once ready, rather than embedding the full
viewer in the flip-card component.

---

## Smart contracts

Most contracts use the UUPS upgradeable proxy pattern (OpenZeppelin v5); the retired migration contract is flat (last grandfathered exception).

### GunplaCard (`src/GunplaCard.sol`) — LIVE on Base mainnet
- ERC-721 with `ERC721URIStorage` + `ERC721Enumerable`
- Mint price in USDC (6-decimal); caller must pre-approve. VIP tier $1, WL tier $1.50, Public $2
- Mint phase is **PUBLIC** — open to anyone, no per-wallet cap (removed July 2026; whitelist tiers still exist for Merkle-verified wallets, they just no longer gate access)
- Stores full `CardTraits` struct on-chain
- Cosmetic updates (repaint/decal) also cost USDC
- Token IDs start at 1 (0 is reserved as "nonexistent")
- USDC accrues in the contract until the owner calls `withdrawUsdc(uint256)` — not auto-swept

### GundaniumGame (`src/GundaniumGame.sol`) — deployed to Base Sepolia only
- Hybrid on-chain/off-chain battle model
- Session creation and stake locking happen on-chain
- Battle resolution is done off-chain by the trusted game server (`BATTLE_RESOLVER_PRIVATE_KEY`)
- Server submits an EIP-712 signed `BattleResult` to settle
- PVP: 10% protocol fee on loser's stake; winner gets `stake * 2 - fee`
- PVE: entry fee returned + arc reward on completion
- **Naming note:** the contract's actual on-chain variable/parameter names still say `gndmStaked` / `arcGndmReward` / `gndmAmount` — that's real, already-compiled Sepolia-deployed code, not a doc error. Renaming would mean a redeploy; not done as part of the GNRM rebrand. `src/lib/battle/arcs.ts`'s `CampaignArc.gnrmReward` field (frontend-only, display purposes, not wired to any real token yet) *was* renamed from `gunrReward` — don't confuse the two.
- Mainnet deployment is the next real milestone — nothing here pays out real GNRM yet

### DailyCheckIn (`src/DailyCheckIn.sol`) — LIVE on Base mainnet
- UUPS upgradeable, owner-gated for future task changes
- Per-wallet `lastCheckInDay`, `currentStreak`, `longestStreak`, `totalCheckIns`, plus a rolling 7-day `checkInsThisWeek` bucket (`today/7`)
- `checkIn()` is a real, player-paid signed transaction — no gasless/sponsored path by design
- Day bucketing is `block.timestamp / 1 days` — genuine UTC-midnight resets, not a rolling 24h-from-last-action timer
- `getStreak(address)` returns `(current, longest, total, lastDay, weekCount)`
- Frontend: `src/lib/contracts/hooks/useDailyCheckIn.ts`, rendered on `/tasks`

### GNDMtoGUNR (`src/GNDMtoGUNR.sol`) — RETIRED
- The original GNDM→GUNR migration contract. **Paused**, and its remaining GUNR (~49M) and GNDM (~980K) balances were swept to the deployer wallet. `migrate()` will revert (paused) for anyone who still tries.
- The `/migrate` frontend page has been deleted entirely.
- Kept in the repo (source + ABI) as a real historical artifact of a live contract, not because it's still in use.

### Contract addresses

Use `getContracts(chainId)` from `src/lib/contracts/addresses.ts`. Use `isPlaceholder(address)` to check if a mainnet address hasn't been deployed yet (`gundaniumGame` and `prizePool` are both still placeholder zero-addresses on mainnet).

| Chain | GunplaCard | GundaniumGame | DailyCheckIn | Migration (retired) |
|---|---|---|---|---|
| Base Sepolia (84532) | `0x7475...9fF4c` | `0x3107...6be7` | `0x4a44...706a67` | placeholder |
| Base mainnet (8453) | `0xA7bc...27a6C` | placeholder | `0xCA60...05d9D8` | `0x8CCb...107230` (paused) |

$GNRM itself is **not** in `addresses.ts` — it's a Streme-launched token, not a GundariuM-deployed contract. Its address and Streme's staking (stGNRM) address are hardcoded directly in the hooks that need them (`useGnrmPurchaseCheck.ts`, `useStakedTodayCheck.ts`) rather than centralized, since nothing about them is chain-conditional (GNRM only exists on Base mainnet).

---

## Battle simulation

**File:** `src/lib/battle/simulate.ts`

Client-side automatic simulation (used for quick preview/summary results, distinct from the interactive Arena below):
- Both combatants attack simultaneously each turn using a 4-slot weapon rotation: primary → secondary → tertiary → special
- Armor type counters: I-Field blocks beam (0.45×), Phase Shift blocks physical melee (0.15×), GN Particle reduces ranged (0.65×), Luna Titanium reduces melee (0.60×), Gundanium reduces all (0.80×)
- Max 40 turns; tiebreak by highest remaining HP percentage
- Enemy weapon picks are seeded by `sessionId % 3` offset for variety

**The live, interactive PVE Arena** (`src/app/arena/page.tsx`) is a separate, player-driven system: you pick a weapon each turn rather than watching an auto-battle, with a charge-gated Special (fills over a few non-Special turns), a 10%/5% player/enemy crit-chance split (deliberate slight player favor), and the same armor matchups. It's labeled "Demo" in the nav because it's entirely client-side and isn't wired to real GNRM staking or on-chain settlement yet — see GundaniumGame above.

---

## Daily Check-In & Frame-Runner EXP

Live at `/tasks`. Six-task daily checklist, all resetting at UTC midnight:

| Task | Verified how |
|---|---|
| Check In | Real on-chain tx to `DailyCheckIn.checkIn()` |
| Buy GNRM | `useGnrmPurchaseCheck` — checks for a Transfer to the wallet that shares a transaction hash with a Transfer OUT of the GNRM/WETH pool (catches swaps routed through any aggregator, not just a direct pool→wallet transfer), min 30,000 GNRM/day. If not met, offers Farcaster's native `swapToken` (in a miniapp) or opens Streme.fun (`openInMiniAppOrBrowser`) |
| Mint a Gundar-Frame | `useMintedTodayCheck` — ERC-721 mint Transfer from zero address, same UTC-window pattern |
| Stake Token | `useStakedTodayCheck` — same pattern, checks for an stGNRM mint. Always opens Streme.fun on an unmet check (no Farcaster-native staking action exists) |
| Share Your Dossier | Real on-chain verified share (intent + confirm via `DossierShareLog`, Farcaster-only) — see `useVerifiedShare`/`useDossierShareVerification` |
| Share an Arena Battle | Same verified intent + confirm model via `ArenaBattleLog`, wired into Arena's battle-result share button |

All three verification hooks share `utcDailyWindow.ts` — estimates the block nearest today's UTC 00:00 from current block + elapsed seconds (Base's block time isn't perfectly constant, so it's an approximation, buffered to over-include rather than risk a false negative), and auto-run on wallet connect/change rather than waiting for a manual click.

**Frame-Runner EXP** is computed live client-side from on-chain reads (streak, total check-ins, cards minted, daily task completion) — no backend, no stored balance, no spendable use. Bragging rights only, by design.

---

## Runner identity / Farcaster profile lookups

- `src/lib/neynar.ts` — server-only Neynar client, looks up a Farcaster identity by wallet address
- `src/app/api/runner-profile/[address]/route.ts` — the one and only route for this; returns a `RunnerProfile` (`src/types/runner.ts`), edge-cached 30 minutes, always returns a valid object (`source: "none"` + `emptyRunnerProfile()` fallback rather than null) so callers never need to null-check
- `ShareButtons.tsx` calls this route to resolve a Farcaster username for dossier shares when not running inside the Farcaster miniapp itself (where `sdk.context.user.username` is used directly)
- **Don't build a second identity-lookup route.** This happened once already (a redundant `/api/farcaster-username` got built and later deleted) — this is the one.

---

## Wallet / Farcaster integration

Wagmi config (`src/lib/wagmi.ts`) registers three connectors in priority order:
1. `farcasterConnector` — custom connector for Farcaster miniapp embedded wallet
2. `injected()` — MetaMask / browser wallet
3. `walletConnect({ projectId })` — WalletConnect QR modal

`FarcasterInit` component auto-connects via `sdk.wallet.ethProvider` when running inside a Farcaster miniapp context.

`src/lib/openInMiniAppOrBrowser.ts` opens a URL via Farcaster's `openMiniApp` action when inside a Farcaster miniapp (keeps the user in-app), falling back to a normal `window.open` otherwise. Used for the Streme.fun buy/stake redirects on the Navbar, home page, `/stake`, and `/tasks`.

The Farcaster miniapp embed is declared in the root `layout.tsx` metadata under `fc:miniapp`. The account-association manifest is served from `.well-known/farcaster.json/route.ts`.

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

## Feature flags & page status

| Flag | Default | Behavior when false |
|---|---|---|
| `NEXT_PUBLIC_MINT_ENABLED` | `true` in production | Mint and Collection pages show `ComingSoon` instead |

There's no more countdown-timer gating anywhere on the site — the old `CountdownTimer.tsx` (`CountdownPage`/`CountdownBanner`) counted down to a May 10, 2026 date that's long since passed and was deleted as dead/broken code. Current page status:

| Page | Status |
|---|---|
| Mint, Collection, Arena, Tasks, Stake (redirect) | Live |
| Battle, Leaderboard | `ComingSoon` — genuinely not built yet (pending GundaniumGame mainnet + real PVP) |

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
- **Before adding a new API route or hook, grep for an existing one first** — the runner-profile duplication (above) happened from not checking
