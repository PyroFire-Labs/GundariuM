# Base / Blockaid Verification Submission Package — GundariuM

Form URL: **https://report.blockaid.io/**

Use the sections below to fill out the Blockaid form. Categories vary by submission type — if asked to choose, pick **"Verification request"** or **"False positive report"** depending on whether you've actually been flagged. Most fields below are universal.

---

## Project name

**GundariuM**

## Tagline (one-line)

A Gunpla NFT battle game on Base — AI-generated kitbashed Mobile Suits, turn-based PVE/PVP combat, and on-chain progression powered by the $GUNR token.

## Project URL (live app)

https://gundarium.xyz

(Vercel-hosted; canonical custom domain. Alternate URL: https://gundarium.vercel.app)

## Whitepaper

https://gundarium.xyz/GundariuMwhitepaper.pdf

## Source code (public)

https://github.com/PyroFire-Labs/GundariuM

## Builder code / Studio

**Studio:** PyroFire Labs (https://github.com/PyroFire-Labs)
**Founder GitHub:** https://github.com/PyroFireZero

## Project category

- Primary: GameFi / NFT
- Secondary: Token migration (for the migration contract specifically)

## Network

Base mainnet (chain ID 8453). No testnet contracts being submitted.

---

## Contract registry

All contracts deployed by `0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7` (project deployer wallet). All Basescan-verified.

### 1. GunplaCard (ERC-721 NFT)

| Field | Value |
|---|---|
| Address (proxy) | `0xA7bc3d31A4863b33854F2d73C77BAf31c4f27a6C` |
| Basescan | https://basescan.org/address/0xA7bc3d31A4863b33854F2d73C77BAf31c4f27a6C |
| Type | UUPS upgradeable ERC-721 (current implementation `0x5D122b489117f8E44F17C78945f2870adEF0F230`) |
| Standards | ERC-721 + ERC721URIStorage + ERC721Enumerable + Ownable + UUPSUpgradeable (OpenZeppelin v5) |
| Function | The NFT contract for GundariuM "Gundar-Frames." Holders mint a unique AI-generated kitbashed Mobile Suit by paying USDC. Each NFT stores card battle traits on-chain (HP, weapons, armor type, faction, rarity). Supports paid cosmetic updates (repaints, decals). 13 NFTs minted to date. |
| User-facing payment token | USDC (Base mainnet, 6-decimal) |
| Why not malicious | Standard OpenZeppelin ERC-721 patterns. No infinite approvals, no surprise transfers. UUPS upgrade authorized by owner only. Source verified. |

### 2. $GUNR Token (ERC-20)

| Field | Value |
|---|---|
| Address | `0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07` |
| Basescan | https://basescan.org/token/0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07 |
| Type | Standard ERC-20 |
| Deployed via | Clanker (https://clanker.world) on 2026-04-15 |
| Function | The native token used for VIP tier discounts on mints, future in-game sinks (battle staking, prize pools, cosmetic upgrades), and as the destination token for the GNDM→GUNR migration. Fixed supply, no mintability. |
| LP | Clanker-managed Uniswap V4 positions across multiple price ranges (80% supply in pool, 20% vault — Clanker's standard model) |
| Why not malicious | Deployed via Clanker's audited factory. Fixed supply. No mint function. Standard ERC-20 used as a game economy token. |

### 3. GNDM→GUNR Migration v2 (NEW — submitted today)

| Field | Value |
|---|---|
| Address | `0x8CCbd8EEA766d564fC0AD09D2cB99e4cD4107230` |
| Basescan (verified) | https://basescan.org/address/0x8CCbd8EEA766d564fC0AD09D2cB99e4cD4107230 |
| Type | Flat (non-upgradeable) Solidity contract — OZ Ownable + Pausable + SafeERC20 |
| Function | One-time 1:1 token migration from $GNDM (the project's deprecated v1 token) to $GUNR. Any GNDM holder can swap. Funded with 50,000,000 GUNR. 60-day window ending ~2026-07-25. |
| Admin surface | Owner can pause/unpause, adjust deadline, and recover stuck tokens. No ability to mint or steal user funds. |
| Why not malicious | Source verified. 6-line `migrate()` body — read it on Basescan. Bounded liability (max 50M GUNR can ever pay out, equal to what was deposited). Open whitelist eliminates the gatekeeping that legitimate users sometimes flag as suspicious. |
| Predecessor (now defunct) | `0xefbD485bFbDb9aC766659811151CB2b6e43A7261` — v1 was bricked by a Merkle leaf-encoding bug; v2 redeploy fixes it by removing the whitelist mechanism entirely. v1 holds 0 of everything and is a safe tombstone. |

### 4. $GUNR Staking

| Field | Value |
|---|---|
| Address (proxy) | `0x2F61D7EaC30E44ed33df3a441aDfC69C47Bd5B02` |
| Basescan | https://basescan.org/address/0x2F61D7EaC30E44ed33df3a441aDfC69C47Bd5B02 |
| Type | UUPS upgradeable, Synthetix-style staking (current implementation `0x7500cf99...f05C51E5d`) |
| Function | Holders stake $GUNR for tier access. The reward distribution mechanism is built but intentionally not funded with rewards yet — we plan to route in-game fees into rewards once GundaniumGame deploys, rather than emitting dilutionary yield from day one. A V2 staking rework with a single-lock-from-first-stake rule is on the active design queue. |
| Why not malicious | Synthetix `rewardPerToken` accounting is a well-known, audited pattern. UUPS upgrade authorized by owner only. Source verified. |

### Contracts NOT yet deployed (listed in addresses registry as `0x000...0` placeholders)

- `GundaniumGame` — Battle resolution contract; off-chain server signs EIP-712 battle results
- `PrizePool` — Prize distribution for tournament arcs

These will be submitted for verification separately once deployed.

---

## Builder bio — short version (recommended for forms)

I'm Joshua Grubbs (PyroFireZero on GitHub), the founder of PyroFire Labs. GundariuM is my first crypto project — built in public since late 2025 after getting into Base / Farcaster development. I'm a full-stack developer who handles both the smart contracts and the frontend. The project has a public whitepaper, public GitHub, and an active Farcaster presence (@pyrofirezero).

Mentor: NomadicFrame (creator of TYSM, 10K+ community on Farcaster — listed as advisor with his approval).

## Builder bio — extended version (only if there's a "tell us your story" field; optional)

I'm Joshua Grubbs (PyroFireZero on GitHub), founder of PyroFire Labs.

GundariuM is my first crypto project. Got into Base / Farcaster development in late 2025 after NomadicFrame (creator of TYSM and the gratitude economy) became a mentor. Background is AT&T retail at Best Buy (top-1% national rankings) and a previous venture called Xcelsior Tech focused on protecting senior citizens from tech predators — a "consumer defender" pattern that carries into how I think about user safety in this project too.

My AI development partner inside this project is named **Larry** — after my father, Larry Sr., who passed away from the opioid epidemic. He worked 12-hour days for 20 years through chronic pain to put food on our table. Naming the AI pair-programmer "Larry" keeps him in the work.

*(Only include the Larry paragraph if the form has a long-form story field and you want to share it. Skip otherwise — it's personal.)*

---

## Legitimacy signals (paste into "why is this not malicious" field if asked)

- All four mainnet contracts have source verified on Basescan
- Open-source on GitHub: https://github.com/PyroFire-Labs/GundariuM
- Public whitepaper: https://gundarium.xyz/GundariuMwhitepaper.pdf
- Active social presence on Farcaster: @pyrofirezero
- Live community of holders (13 GunplaCard NFTs minted, ~125 addresses on the GNDM migration whitelist)
- Built on standard, audited OpenZeppelin contract patterns (Ownable, Pausable, ERC-721 Upgradeable, UUPS)
- $GUNR liquidity managed via Clanker's standard pool-positions model (transparent, on-chain)
- Migration contract uses safest patterns: bounded by funding amount, no infinite mint, no token transfer authority over user wallets, owner cannot drain user funds (only the contract's own pre-funded GUNR)
- The project has been operating openly since the April 2026 whitelist mint — no rug, no surprise contract changes

## If you've previously been flagged

If Coinbase Wallet or another wallet has shown a "malicious" / "suspicious" warning on any of these addresses, paste the screenshot in the form. The most likely reason for false positives:

- The deployer wallet `0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7` has an EIP-7702 delegation installed (this is normal account-abstraction behavior, not a security concern — wallets flag it generically as "destination has delegation")
- The $GUNR token was deployed via Clanker's factory; some wallet flagging systems are conservative about Clanker-deployed tokens

---

## Contact

- **Farcaster:** @pyrofirezero (primary, fastest)
- **GitHub:** https://github.com/PyroFireZero
- **Email:** joshuagrubbs90@gmail.com
- **Project Discord:** (early stage, will provide on request)
