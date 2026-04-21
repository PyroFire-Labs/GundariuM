# GundariuM Whitelist Launch — Design Spec

**Date:** 2026-04-13
**Timeline:** Whitelist mint April 27 at 12:00 PM CST → Public mint May 10 (Joshua's birthday)
**Status:** Approved for implementation

---

## 1. GunplaCard Contract — Tiered Merkle Whitelist

### Overview

Add a phased mint system to `GunplaCard.sol` with three pricing tiers enforced via Merkle proof verification. The contract is UUPS upgradeable, so this is deployed as an upgrade to the existing Sepolia contract and as a fresh deploy on Base mainnet.

### Mint Phases

| Phase | Enum | Behavior |
|-------|------|----------|
| `PAUSED` | 0 | No minting allowed |
| `WHITELIST` | 1 | Only Merkle-verified addresses can mint |
| `PUBLIC` | 2 | Anyone can mint at full price |

Owner calls `setMintPhase(MintPhase)` to transition between phases.

### Pricing Tiers

| Tier | Merkle Leaf Value | Price (USDC) | Discount |
|------|-------------------|--------------|----------|
| VIP | `1` | 1.00 | 50% off |
| Whitelist | `2` | 1.50 | 25% off |
| Public | N/A (no proof) | 2.00 | Full price |

Tier is encoded in the Merkle leaf: `keccak256(abi.encodePacked(address, uint8 tier))`.

The contract stores a mapping of tier → price:
```solidity
mapping(uint8 => uint256) public tierPrice;
```

Set via `setTierPrice(uint8 tier, uint256 priceUsdc)` (owner-only).

### Mint Cap

- **Whitelist phase:** 5 mints per wallet max, enforced via `mapping(address => uint256) public whitelistMintCount`.
- **Public phase:** No per-wallet cap.

### Contract Changes (GunplaCard.sol)

New state variables (added in upgrade-safe order):
```solidity
enum MintPhase { PAUSED, WHITELIST, PUBLIC }

MintPhase public mintPhase;
bytes32 public merkleRoot;
mapping(address => uint256) public whitelistMintCount;
mapping(uint8 => uint256) public tierPrice;
uint256 public whitelistMintCap;
```

New/modified functions:
```
setMintPhase(MintPhase phase)              // owner-only
setMerkleRoot(bytes32 root)                // owner-only
setTierPrice(uint8 tier, uint256 price)    // owner-only
setWhitelistMintCap(uint256 cap)           // owner-only
mintCard(address to, string tokenUri, CardTraits traits)  // existing — PUBLIC phase only
mintCardWhitelist(address to, string tokenUri, CardTraits traits, uint8 tier, bytes32[] proof)  // new — WHITELIST phase
```

Merkle verification uses OpenZeppelin `MerkleProof.verify()`.

### Merkle Tree Tooling

A Node.js script at `scripts/generate-merkle.ts`:
- Input: JSON file with `{ address, tier }` entries
- Output: Merkle root + per-address proof JSON
- Uses `@openzeppelin/merkle-tree` package

Example input (`whitelist.json`):
```json
[
  { "address": "0x...", "tier": 1 },
  { "address": "0x...", "tier": 2 }
]
```

Output: `whitelist-proofs.json` with root and per-address proofs for the frontend to consume.

---

## 2. Trait Balance Audit

### Goal

Ensure minted cards produce balanced battle teams. No rarity tier should be auto-win or useless. Cards minted during whitelist must be battle-ready when PVP/PVE launches.

### Current Stat Derivation

| Rarity | HP Range | Primary (% HP) | Secondary (% HP) | Tertiary (% HP) | Special (% HP) |
|--------|----------|-----------------|-------------------|------------------|----------------|
| Common | 150–349 | 15–25% | 25–40% | 8–15% | 50–80% |
| Uncommon | 350–599 | 15–25% | 25–40% | 8–15% | 50–80% |
| Rare | 600–899 | 15–25% | 25–40% | 8–15% | 50–80% |
| Ultra Rare | 900–1199 | 15–25% | 25–40% | 8–15% | 50–80% |
| Legendary | 1200–2000 | 15–25% | 25–40% | 8–15% | 50–80% |

### Balance Concerns

1. **HP gap is massive.** A Common card (150 HP) vs Legendary (2000 HP) is a 13x difference. In a 4-slot weapon rotation battle, the Common dies in 1-2 turns while the Legendary tanks for 10+. This makes Commons functionally useless in PVP.

2. **Damage percentages scale with HP.** A Legendary with 2000 HP deals 300-500 primary damage. A Common with 200 HP deals 30-50. The Legendary one-shots the Common while barely taking damage.

3. **Armor counters help but don't solve it.** Best counter (Phase Shift, 0.15×) reduces a 400 damage hit to 60 — still more than a Common's total HP in many cases.

### Rebalance — Compressed HP Ranges

| Rarity | HP Range | Ratio to Common |
|--------|----------|-----------------|
| Common | 400–550 | 1× |
| Uncommon | 500–700 | ~1.3× |
| Rare | 650–850 | ~1.6× |
| Ultra Rare | 800–1050 | ~2× |
| Legendary | 1000–1300 | ~2.5× |

Max ratio drops from 13× to 2.5×. Legendaries are still strong but Commons can compete with good armor matchups and weapon rotation.

**Damage stays percentage-based** so it auto-scales. No change needed.

Update `src/lib/kitbash/traits.ts` — change `HP_RANGES` constant to use these values.

---

## 3. Site Updates

### Remove Photo-Your-Kit References

Files to update:
- `src/components/mint/MintLanding.tsx` — remove any camera/photo upload copy
- `src/app/mint/page.tsx` — verify step labels match generative flow
- `src/app/page.tsx` (landing page) — update hero copy if it references photographing kits
- Any other pages referencing the old flow

### Mint Flow Polish

The 5-step generative flow (`idle → generating → reveal → confirming → success`) is built. Needs:
- Whitelist-aware pricing display in `MintConfirm.tsx` (show tier discount)
- Merkle proof submission in the mint transaction
- Wallet mint count display ("2/5 mints used")
- Phase-aware gating (show "Whitelist Only" or "Coming Soon" based on contract phase)

### New GNDM Token Integration

Once Joshua deploys GNDM v2 via Clanker:
- Update `src/lib/contracts/addresses.ts` — new `gndmToken` address for chain 8453
- Update staking contract to reference new token (or redeploy staking)
- Update `buy-gndm` page with new token address
- Update any hardcoded token references

**Note:** This is blocked until Joshua completes the Clanker deploy. The rest of the work can proceed independently.

---

## 4. Mainnet Deploy Prep

### Deploy Checklist

1. **Upgrade GunplaCard on Base Sepolia** — add whitelist logic, test full flow
2. **Generate Merkle tree** — from finalized whitelist of 164 addresses
3. **Deploy GunplaCard to Base mainnet** — fresh UUPS proxy deploy
4. **Set contract state:**
   - `setMerkleRoot(root)`
   - `setTierPrice(1, 1_000_000)` (VIP: 1 USDC)
   - `setTierPrice(2, 1_500_000)` (WL: 1.50 USDC)
   - `setMintPriceUsdc(2_000_000)` (Public: 2 USDC)
   - `setWhitelistMintCap(5)`
   - `setMintPhase(PAUSED)` initially
5. **Verify on BaseScan**
6. **Update `addresses.ts`** with real mainnet GunplaCard address
7. **E2E test on Sepolia** — mint with VIP proof, WL proof, and public
8. **Flip to `WHITELIST` phase** on launch day

### Deploy Safety (per feedback)

- Use `OWNER_ADDRESS` env var — never `msg.sender` in forge scripts
- Verify owner on-chain after every deploy
- Use Foundry keystore (`deployer`), never raw env var private keys

---

## 5. Whitepaper v2

### Sections to Update

| Section | Change |
|---------|--------|
| Core Loop | Photo-your-kit → AI-generated kitbash via Gemini |
| Card System | New trait tables, 8 categories, ~69M combinations |
| $GNDM Tokenomics | New token address, Clanker v4 deploy, vault/vesting details |
| Smart Contracts | Whitelist system, tiered pricing, mint phases |
| Roadmap | Updated dates — whitelist April 27, public May 10 (birthday launch), battle post-launch |
| Technology | Add Gemini 2.5 Flash image generation pipeline |

### Format

Update `docs/whitepaper.md` source, then regenerate PDF via `docs/generate-whitepaper-pdf.py`.

---

## 6. Anti-Abuse Protection

### Why This Is Critical

A public NFT mint without bot protection will get swarmed by wallet farms and sniper bots. Joshua has direct experience with abuse from Farcaster creators — this is not theoretical. The per-wallet mint cap (5) helps but doesn't stop someone spinning up 100 wallets.

### Layer 1: Cloudflare Turnstile (Frontend)

Free, invisible CAPTCHA alternative. No puzzle-solving for real users.

- Add Turnstile widget to `MintLanding.tsx` (or `MintConfirm.tsx` right before the mint tx)
- Turnstile returns a token on success
- Token is sent to the API route for server-side verification
- **Env vars:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- Setup: https://developers.cloudflare.com/turnstile/

### Layer 2: Server-Side Rate Limiting (API)

Rate limit the `/api/generate-kitbash` endpoint to prevent generation spam:

- **Per-IP:** Max 10 generations per hour
- **Per-wallet:** Max 10 generations per hour (wallet address from request body)
- Implementation: Use Vercel KV (Upstash Redis via Vercel Marketplace) or in-memory Map with TTL
- Return `429 Too Many Requests` with retry-after header when exceeded

If KV adds cost, a simple in-memory rate limiter works for single-instance Vercel functions (not perfect but catches casual abuse).

### Layer 3: Turnstile Verification on Mint API

The `/api/mint-metadata` route (which uploads to IPFS before mint) should verify the Turnstile token server-side:

```typescript
const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  body: JSON.stringify({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: turnstileToken,
  }),
});
const { success } = await verifyRes.json();
if (!success) return Response.json({ error: 'Bot detected' }, { status: 403 });
```

### Layer 4: On-Chain Mint Cap (Already Covered)

The per-wallet cap in the contract (Section 1) is the final safety net. Even if bots pass all frontend checks, each wallet is limited to 5 mints during whitelist.

### What We're NOT Doing (Post-Launch)

- Cloudflare KV-based lockout tracking (overkill for launch)
- Wallet age/activity scoring
- Phone/email verification

---

## 7. Cleanup: Superseded Plans

The following old plans are **superseded** by the generative pivot (April 10, 2026) and this spec. They should NOT be implemented:

| Old Plan | Date | Status |
|----------|------|--------|
| `docs/plans/2026-03-08-mint-flow-redesign.md` | March 8 | Superseded — 8-step suit-search flow replaced by 5-step generative flow |
| `docs/plans/2026-03-08-mint-flow-redesign-impl.md` | March 8 | Superseded — implementation plan for above |
| `docs/plans/2026-03-03-staking-contract.md` | March 3 | Completed — staking is live on mainnet |
| `docs/plans/2026-03-03-staking-contract-design.md` | March 3 | Completed — staking is live on mainnet |

These files can remain in `docs/plans/` for historical reference but are not actionable.

---

## 8. Git Hygiene

**All work stays local.** Do not push to GitHub/origin. Commits go to local `main` only.

---

## Out of Scope (Post-Launch)

- Battle system (PVE/PVP) — cards are minted battle-ready but battles ship later
- AI Cosmetics (repaint/decal) — contract supports it, UI deferred
- Staking rewards funding — tier-access only at launch
- Multi-chain expansion
- Advanced anti-abuse (KV lockouts, wallet scoring)
