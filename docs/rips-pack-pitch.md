# GundariuM × RIPS — Pack Inclusion Pitch

Submission summary for the RIPS team. Copy-paste-able into a DM, email, or form field.

---

## TL;DR

GundariuM is a Gunpla NFT battle game on Base, powered by the $GUNR token. We just shipped a major mainnet milestone this week (full token migration v2 — verified on Basescan, 49M+ GUNR available, 60-day open swap). $GUNR is an early-stage game token: holdings position you for VIP tier discounts on future mints, future battle staking, and the in-game economy we're actively building. We'd like to be featured in your packs so the people who pull GUNR get an early stake in an actively-shipping Base GameFi project.

---

## Who we are

**PyroFire Labs** is the studio. **Joshua Grubbs** (Farcaster: [@pyrofirezero](https://farcaster.xyz/pyrofirezero)) is the founder and primary builder — full-stack engineer doing both the smart contracts and the frontend.

- GitHub org: https://github.com/PyroFire-Labs
- Started building on Base in late 2025; first project to ship
- Mentor: **NomadicFrame** (creator of TYSM, 10K+ Farcaster community) — listed as advisor

We've been building in public since launch, with active commits, a published whitepaper, and an open Farcaster presence.

---

## What GundariuM is

A Gunpla NFT card battle game on Base.

- Users mint NFT "Gundar-Frames" — unique AI-generated kitbashed Mobile Suit designs with on-chain battle stats (HP, weapons, armor type, faction, rarity)
- Generation is on-demand via Gemini 2.5 Flash Image. Pool of ~69 million possible trait combinations
- Cards battle in turn-based PVE (Arena) and PVP modes with $GUNR token staking
- Live now: mint, collection viewer, arena demo (V1 turn-based), staking
- Coming: full PVP, leaderboards, tournament arcs, prize pool distribution

### Quick stats

| Metric | Value |
|---|---|
| Live since | April 2026 (whitelist mint), May 2026 (public) |
| NFTs minted | 13 Gundar-Frames |
| Migration whitelist | ~125 addresses (legacy GNDM → GUNR swap, just shipped v2) |
| Whitepaper | https://gundarium.xyz/GundariuMwhitepaper.pdf |
| Live app | https://gundarium.xyz |

---

## $GUNR — what it offers a user who pulls it from a pack

**Contract:** `0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07` (Base mainnet)
**Type:** Standard ERC-20, deployed via Clanker, fixed supply. Clanker manages LP positions across multiple price ranges (80% supply in pool positions, 20% in vault).
**Basescan:** https://basescan.org/token/0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07

A user who opens a pack and pulls GUNR has four real options:

1. **Hold for VIP tier discount** — past whitelist mints used GUNR holdings to set discount tiers (VIP holders paid $1 instead of $2 on the public mint). Future mint rounds will use the same pattern. This is the most concrete utility today.
2. **Position for the game economy we're building** — battle staking for PVE/PVP, prize pool entries, GUNR-paid cosmetic upgrades on NFTs (repaints, decals). The GunplaCard contract is already wired for USDC-gated cosmetics; GUNR sinks are the natural next step.
3. **Stake for tier access** — staking contract is live at `0x2F61D7EaC30E44ed33df3a441aDfC69C47Bd5B02` for tier access; reward APR is intentionally not funded yet (we're routing future game fees into rewards rather than emitting dilutionary yield from day one). A V2 staking rework is on the active design queue.
4. **Swap to USDC** through your existing batch-swap flow if they prefer cash out — fully fungible standard ERC-20.

This is meaningful for RIPS pulls because it's an *early position in an actively-shipping project*, not a meme that's already had its run. The community story (Gunpla collectors, AI-generated mecha designs, NomadicFrame gratitude economy heritage) is also shareable content — cards from our mint generate visually distinct, tweet-worthy artifacts.

### Liquidity note (transparent disclosure)

Clanker-positioned LPs sit across a wide price range. As of this pitch, the active-tick liquidity is being restored after a temporary withdrawal — we're working on that today. Primary value capture for $GUNR is *in-app utility* (VIP mint discounts today, battle sinks and game fees as the roadmap rolls out), not secondary-market flipping.

---

## Why this fits a RIPS pack

- **Active development, weekly commits** — we just shipped a fresh contract redeployment on 2026-05-24, and contract + frontend work is ongoing
- **Community story** — Gunpla / mecha lore + AI generation is shareable content. Our generated cards are visually distinct and tweet/cast well
- **Cross-pollination** — RIPS users who pull GUNR get pulled into our community; our players who learn about RIPS become pack-openers. Bidirectional growth
- **Transparent track record** — we publicly shipped a fix for a broken v1 migration contract (open post-mortem in our docs, full v2 redeploy this week). No rug, no surprise upgrades, all source verified
- **Early enough to matter** — we're not asking RIPS users to buy a token that's already mooned; we're inviting them to a position in a project that's actively building toward game launch

## Contract verification

All mainnet contracts source-verified on Basescan:

| Contract | Address |
|---|---|
| GUNR token | `0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07` |
| GunplaCard NFT | `0xA7bc3d31A4863b33854F2d73C77BAf31c4f27a6C` |
| GUNR Staking | `0x2F61D7EaC30E44ed33df3a441aDfC69C47Bd5B02` |
| GNDM→GUNR Migration | `0x8CCbd8EEA766d564fC0AD09D2cB99e4cD4107230` |

Deployer: `0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7`

---

## Contact

- **Farcaster (fastest):** [@pyrofirezero](https://farcaster.xyz/pyrofirezero)
- **GitHub:** https://github.com/PyroFireZero
- **Email:** joshuagrubbs90@gmail.com

Happy to provide additional materials, jump on a call, or coordinate co-promotion on Farcaster when the pack drops.
