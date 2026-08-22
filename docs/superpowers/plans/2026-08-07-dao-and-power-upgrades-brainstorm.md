# GundariuM DAO + Power-Trait Upgrades — Brainstorm Notes
**Date:** 2026-08-07
**Status:** Brainstorm — not yet a design doc. Captured to resume from, not to implement against.
**Participants:** Josh, Larry (Claude), input from ghostmintops

---

## Origin

Ability/power upgrades were scoped on day one, in `docs/plans/2026-03-08-mint-flow-redesign.md`, Step 6: *"Optional: pay GNDM to upgrade weapon damage, armor resistance, or HP. Specific pricing and upgrade increments TBD."* That flow was superseded by the generative-kitbash pivot, so the mechanic survived conceptually but was never re-scoped for the current mint flow, GNRM, or on-chain reality. This session picked it back up, prompted by ghostmintops' liquid-staking "triple rewards" pitch for a GundariuM Treasury Vault.

---

## Thread 1 — GundariuM DAO

- No governance/DAO code exists anywhere in this codebase today (confirmed by grep).
- All three live contracts (`GunplaCard`, `DailyCheckIn`, `ArenaBattleLog`) are UUPS-upgradeable behind a plain `onlyOwner` — almost certainly one wallet with total upgrade authority over contracts holding real USDC and NFTs.
- **Recommendation, not yet decided:** the DAO's first concrete job is migrating that `onlyOwner` role to a multisig, before any token-voting apparatus exists. That's a scoped, low-ambiguity first step independent of whether GNRM ends up being the governance token.
- **Open question:** is the near-term goal *decentralizing control* (multisig takeover) or *building a voting/governance system*? Different first steps.
- Nest's tiered lock-staking (0/10/25/50/100 days, linear-decay early-exit penalty, penalties redistributed to remaining stakers) is a clean, reusable pattern — flagged as a good fit for a *future* "lock GNRM for governance weight" feature, not for the NFT-upgrade vault below. Keeping these two threads separate deliberately.

---

## Thread 2 — Power-trait upgrades (all 5 stats: HP, primary/secondary/tertiary/special damage)

### Decided
- **All 5 `CardTraits` stat fields are upgradeable.**
- **Payment is dual-asset — GNRM + a liquid-staking token (wstETH or similar)** — deposited together into a real LP position (Uniswap or Aerodrome), not burned.
- **The LP position must be vault-held, not self-custodied**, with non-transferable receipt shares tracking each contributor's claim — a self-custodied position can't guarantee "permanent," since the user could just withdraw it. This is economically necessary anyway: individual on-chain LP mints per ~$20 upgrade would likely lose real value to gas; a shared pool with internal share accounting is closer to mandatory once amounts are small and frequent.
- **Bound to the NFT, not the wallet — confirmed, final.** Mechanism: the vault keys accounting by `tokenId` and resolves the claimant at claim-time via `GunplaCard.ownerOf(tokenId)`. No transfer hooks, no listener on `GunplaCard`, no wrapping. "Eternally grafted" falls out for free because the vault never stores an owner address.
- **`GunplaCard`'s on-chain traits stay permanently immutable.** Power upgrades live as deltas in a new companion contract, keyed by `tokenId`. Effective battle stat = base (frozen, `GunplaCard`) + upgrades (growing, new contract), summed at read time. This avoids ever needing a UUPS upgrade to the live `GunplaCard` contract for this feature — a walk-back from an earlier instinct to fold power fields into the same struct expansion planned for cosmetics.
- **Unclaimed accrued yield transfers with the NFT on any sale, in-house or external (OpenSea, direct transfer) — by design, not a bug.** The seller forfeits it to the buyer with no compensation path unless they claim before selling.
- **Market strategy is transparency, not restriction.** Explicitly rejected importing Nest's "Slot Recovery" pattern (a real benefit withheld unless you sell through their own market) — GundariuM can't block OpenSea sales anyway (standard ERC721), and a punitive mechanic isn't needed. The actual driver is that GundariuM's own Market is the only venue that *tells you* the accrued number exists before you trade; OpenSea has no idea the vault exists at all.

### Open / undecided
- **Auto-compound vs. manual claim** — does accrued yield grow the position automatically (claimable number = position value), or sit as a literal pending payout someone actively pulls?
- **Deterministic vs. probabilistic upgrades** — Nest's model charges cost regardless of outcome with declining success odds at higher levels (90% → 10%). GundariuM has been assumed pay-$X-get-+Y guaranteed so far. Not decided either way; probabilistic adds real trust/fairness requirements (on-chain verifiable randomness, disclosed odds) if pursued.
- **Pairing asset for the LP** — GNRM's actual live liquidity today is a **GNRM/WETH** pool (`GNRM_POOL_ADDRESS` in `useGnrmPurchaseCheck.ts`), not GNRM/wstETH. A brand-new GNRM/wstETH pool would be a cold start with no depth — the upgrade mechanic's own users would be its only liquidity for a while, which is thin and manipulable. Not yet decided whether to pair against WETH instead (matches the real market) or accept a deliberately separate GNRM/wstETH market.
- **wstETH "minimum to earn yield"** — clarified this isn't really a thing; wstETH accrues via a continuously-appreciating exchange rate vs. stETH, no threshold. The real minimum to think about is gas/dust economics on the LP side, which the shared-vault-accounting design already addresses.

### Where the transparency lives (two surfaces, not yet built)
1. **Collection page, always-on** — every held card shows its live accrued vault claim, not just at sale time.
2. **Market listing flow, explicit gate** — "claim now before listing, or acknowledge the buyer receives it," a real interstitial not fine print.
3. **Idea, not yet explored** — a static pointer embedded in `tokenURI` metadata (e.g. "this card carries a vault-bound reward claim, check gundarium.xyz/card/{id}") so even an OpenSea listing carries a breadcrumb back, since that's the one venue GundariuM has zero UI presence on. Can't embed a live number (metadata is a snapshot, would go stale), only a pointer.

---

## Thread 3 — Gundar-Frame Market (first-party marketplace)

- Not a transfer restriction — technically can't be, `GunplaCard` is a standard ERC721.
- Value proposition: the only venue that shows accrued vault value on a listing, and the only one that gates selling behind a real "you're about to forfeit unclaimed rewards" warning.
- Fee precedent worth reusing from Nest: 3% protocol + 3% creator royalty, multi-currency listings (their model: USDC + their token). Also reinforces that a first-party market is the only reliable way to guarantee royalty capture at all, since OpenSea doesn't consistently enforce creator royalties industry-wide anymore.
- Natural build surface: `src/app/card/[tokenId]/page.tsx` (already public, already per-card) is the base to extend into a real listing page, and `/collection` is where the always-on accrued-value display belongs.

---

## Explicitly separate, not merged in

- **ghostmintops' original Treasury Vault pitch** (opt-in wstETH/GNRM deposits, triple stacked yield, DAO-supplied initial liquidity) is mechanically close to the upgrade-vault's custody/share-accounting shape, but remains a distinct product decision — flagged earlier for a legal/regulatory read (securities exposure on a public vault paying yield under a "DAO Treasury" banner) before any public capital moves, independent of whether the upgrade-vault ships.
