# Reroll Cost — Design

## Problem

The "REROLL" button on the mint flow's reveal screen (`GenerationReveal.tsx`)
currently just calls `reset()` on `useMintStore` — a full flow reset back to
the faction picker, discarding the user's faction pick. It's free today,
gated only by the `generate-kitbash` API's existing IP rate limit
(5/hour, 20/day). Joshua wants a real cost: 60,000 GNRM to reroll, burned.

This is the first feature in the app that spends real GNRM (every existing
GNRM-related hook only ever balance-checks or reads Transfer logs — nothing
approves, transfers, or burns it today).

## Scope

In scope: the main reveal-screen REROLL button (`GenerationReveal.tsx:199-204`),
a new `RerollBurner.sol` contract, a new `useReroll` frontend hook, and
verification changes to `/api/generate-kitbash`.

Out of scope: the *other* "REROLL" button in `GenerationReveal.tsx` (lines
61-74), shown only when a generation session was interrupted (page reload
before the image finished, per the code comment at line 58-60 — the base64
image is deliberately not persisted). That path has no successful roll to
react to yet, so it isn't a deliberate "I don't like this" action — it stays
exactly as-is: free, calls `reset()`, full restart.

## Architecture

```
GenerationReveal.tsx (REROLL button)
  └─ useReroll() hook
       1. read RerollBurner.rerollCost() on-chain (live, not a frontend constant)
       2. approve GNRM → RerollBurner (guardedWrite, skip if allowance sufficient)
       3. call RerollBurner.reroll() (guardedWrite), wait for receipt
       4. sign the message `Reroll with tx {txHash}` with the connected wallet
       5. POST /api/generate-kitbash { faction, walletAddress, rerollTxHash, signature }
            ↓
       generate-kitbash route:
         a. recover the signer from `signature` over the same message string;
            reject if it doesn't match walletAddress (EIP-191, same
            verifyMessage approach lineupStore.ts already uses) — a tx hash
            alone doesn't prove who's calling, since it's publicly visible
            the moment it's broadcast (observable in the mempool before
            confirmation); without this check, anyone could grab someone
            else's pending reroll tx and submit it as their own first.
         b. verify rerollTxHash on-chain: real Rerolled event, this contract,
            this wallet, tx succeeded (viem, same log-reading approach
            useGnrmPurchaseCheck.ts already uses)
         c. check Redis: has this tx hash already been consumed?
         d. call Gemini (existing generateKitbashImage — unchanged)
         e. only on Gemini success: mark tx hash consumed in Redis
       6. useMintStore.setGenerationResult(newData) — same action the first
          generation already uses; it sets step: "reveal" with fresh data,
          so calling it again while already on "reveal" replaces the card
          in place. No store changes needed.
```

### `contracts/src/RerollBurner.sol` (new)

UUPS upgradeable (this project's default for new mainnet contracts since
5/22), `SafeERC20` for the transfer, custom errors, section-header comment
style — matching every other contract in this repo.

- `initialize(address _gnrm, uint256 _rerollCost, address _owner)`
- `reroll()` — `SafeERC20.safeTransferFrom(gnrm, msg.sender, BURN_ADDRESS, rerollCost)`,
  then `rerollCount[msg.sender]++`, `totalRerolls++`, `totalBurned += rerollCost`,
  emits `Rerolled(address indexed user, uint256 amount, uint256 userRerollCount, uint256 totalRerolls)`.
- `setRerollCost(uint256 newCost)` — `onlyOwner`, emits `RerollCostUpdated(old, new)`.
  Owner-adjustable because mint pricing and whitelist tiers have both needed
  tuning after launch before — no reason to assume 60,000 is final.
- `BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD` (not
  `address(0)` — some ERC20s revert on transfers to the zero address).
- `_authorizeUpgrade` — `onlyOwner`.

GNRM has 18 decimals (verified directly on-chain against the live token:
`cast call 0x271b...ab491 "decimals()(uint8)"` → `18`), so the initial cost
is `60_000e18`.

### `useReroll` hook (new, `src/lib/contracts/hooks/useReroll.ts`)

Mirrors `useMint.ts`'s approve/execute phase pattern (`idle → approving →
approved → rerolling → done`), using the existing `guardedWrite` wrapper for
both the GNRM `approve` and the `reroll()` call — same chain-mismatch guard
and 20s timeout every other wallet write in this app already gets.

### `generate-kitbash` route (modified)

Adds three new optional request fields: `walletAddress`, `rerollTxHash`, and
`signature`. When `rerollTxHash` is present, the route verifies the caller's
signature and the on-chain payment *before* calling Gemini (steps a-c above)
— this is the first time this route needs to know who's calling at all.
When absent, behavior is identical to today (the free first-generation path
is completely unchanged).

The Redis-based "consumed" tracking reuses the same `@upstash/redis` client
pattern already established in `lineupStore.ts`, key shape
`reroll:consumed:{txHash}`.

## Error handling

- **Gemini fails after a verified real payment:** the tx hash is *not*
  marked consumed until generation succeeds (step e happens after step d,
  not before). The frontend can retry the same `POST` with the same tx hash
  and signature at no additional cost — a Gemini hiccup should never mean
  paying twice for one reroll.
- **Signature doesn't match:** if the recovered signer doesn't match
  `walletAddress`, reject before ever touching the chain or Gemini — clear
  error, no retry-worthy state changed.
- **Replayed tx hash:** if a tx hash is already marked consumed (a prior
  reroll already succeeded with it), the route rejects with a clear
  "This payment has already been used" error, no Gemini call.
- **Tx doesn't verify** (wrong contract, wrong wallet, wrong amount, or the
  tx simply doesn't exist/hasn't confirmed yet): reject before calling
  Gemini, clear error surfaced by `useReroll`.
- **On-chain reroll() reverts** (insufficient GNRM balance or allowance):
  surfaced through `guardedWrite`'s existing error handling, same UX pattern
  as an insufficient-USDC mint failure today.
- **Rate limiting:** the existing IP-based 5/hour, 20/day limit in
  `generate-kitbash` applies uniformly to paid and free generations — a
  hard ceiling on Gemini spend regardless of GNRM's price at any given time,
  not just an anti-freeloading measure.

## Testing

Foundry unit tests for `RerollBurner.sol`, using this repo's existing
`MockERC20.sol` deployed fresh in test setup (standard Foundry pattern, no
live testnet deployment needed for unit tests): `reroll()` pulls the exact
cost from the caller, sends it to the dead address, increments all three
counters correctly, emits `Rerolled` with the right values; `setRerollCost`
reverts for non-owner callers; `reroll()` reverts on insufficient allowance
and on insufficient balance.

For manual end-to-end verification before mainnet: deploy both `MockERC20`
and `RerollBurner` to Base Sepolia (matching how every other contract in
this repo has been rolled out — Sepolia dry run before mainnet), click
through the full reroll flow against them, then deploy `RerollBurner` to
mainnet pointed at the real GNRM address.

This project has no frontend test framework; `useReroll` and the
`generate-kitbash` route changes are verified manually via the dev server,
plus `npx tsc --noEmit` / `npx eslint`, matching this project's established
convention.
