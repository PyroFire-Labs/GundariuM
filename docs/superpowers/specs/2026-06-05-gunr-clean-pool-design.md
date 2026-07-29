# GUNR Clean Liquidity Pool — Design Spec

**Date:** 2026-06-05
**Status:** Draft, pending owner approval
**Author:** Larry (for Joshua / PyroFire Labs)

## 1. Problem

GUNR's only on-chain market is the Clanker Uniswap V4 pool governed by the
`ClankerHookDynamicFeeV2` hook (`0xd60d6b218116cfd801e28f78d011a203d2b068cc`).
Real swaps revert on every router tested — OKX DEX Aggregator, Rainbow (Relay),
and the official Uniswap app — while read-only price simulation succeeds. The
failure signature (simulation passes, execution reverts) matches a documented
defect in the Clanker dynamic-fee hook's protocol-fee accounting when the
simulated swap tick differs from the actual swap tick.

Consequence: GUNR has not recorded a successful swap in 29+ days. The token reads
as "dead" ($0 volume) not from lack of interest but because it is effectively
unbuyable. The ~$16.6K of liquidity in the Clanker pool is locked and unreachable
through that hook.

No remediation path is exposed on Clanker's interface (no salvage action, no
support contact). Therefore the existing pool is treated as unrecoverable for the
purposes of this work.

## 2. Goal

Establish a fresh, hookless GUNR/WETH market that any wallet and aggregator can
swap, fully under owner control, seeded from assets already held by the deployer
wallet, at minimal cost. Success = a third party can buy and sell GUNR through a
standard interface (Uniswap, OKX, etc.) without manual workarounds.

## 3. Design Decisions

### 3.1 Venue — Uniswap V3 on Base
Uniswap V3 is hookless and is routed by effectively every wallet and aggregator,
which maximizes buyability — the single objective here. Alternatives considered
and deferred:
- **Uniswap V4 (hookless):** Today demonstrated that major aggregators (notably
  OKX) still mishandle V4 routing. Rejected for V1 to avoid inheriting that risk.
- **Aerodrome:** Base-native and unlocks future gauge/emissions incentives
  (see `project_lp_staking_brainstorm`). More moving parts than needed now;
  reserved as a later liquidity-deepening layer, not the initial buyable market.

### 3.2 Pair and fee tier
- Pair: **GUNR / WETH** (WETH `0x4200...0006`).
- Fee tier: **1% (10000)**, tickSpacing 200. Standard for low-cap, volatile
  assets and consistent with the prior pool's effective fee.

### 3.3 Price
Initialize at the **current market price** by reusing the live Clanker pool's
`sqrtPriceX96` (`7973503768384402773302369423813468`, tick `230397`). Uniswap V3
and V4 share the same tick/price math, so the new pool opens at the same price the
public chart already displays. No price reset, no arbitrage discontinuity (the old
pool is unswappable, so no arb link exists regardless).

### 3.4 Range
**Full range** for V1 (`tickLower = -887200`, `tickUpper = 887200`, the nearest
spacing-200 multiples to the V3 min/max). Rationale: always quotable, nothing to
manage, robust. Concentrated liquidity is deferred as a depth-improvement step
once the market is live and being deepened.

### 3.5 Capital and seed amounts
Funded entirely from deployer `0x9D62` (holds ~4.75B GUNR and ~0.04 ETH; any WETH
already wrapped in that wallet also counts toward the WETH side).
- **WETH side:** ~**0.03 ETH** (≈ $48 at ~$1,593/ETH). Retain ~0.01 ETH for gas.
- **GUNR side:** computed at execution from the live tick (full-range ratio),
  approximately **~300M GUNR** (~6% of the deployer's GUNR; the separately
  earmarked 300M makeup allocation in `project_vault_300m_makeup` is unaffected).
- **Starting pool size:** ~$90–100 total.

This is intentionally a thin seed. It is acknowledged openly: with ~$50 of
WETH-side depth, a single ~$20 buy will move price materially. The objective of
V1 is *buyable*, not *deep*. Depth is a follow-on (Section 6).

### 3.6 Execution wallet and method
Execute from deployer `0x9D62`, which holds both assets. This wallet carries an
EIP-7702 delegation (see `feedback_eip7702_deploy`), so **use individual
`cast send` calls, not a multi-transaction `forge` broadcast**, to avoid the
gapped-nonce rejection. Each step waits for confirmation before the next.

## 4. Execution Steps (single `cast send` per step)

Token ordering: WETH (`0x4200...0006`) < GUNR (`0x825E...DB07`), so in Uniswap V3
`token0 = WETH`, `token1 = GUNR`.

Contracts (Base, verified 2026-06-05):
- Uniswap V3 Factory: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`
- NonfungiblePositionManager (NFPM): `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1`
- WETH9: `0x4200000000000000000000000000000000000006`
- GUNR: `0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07`

1. **Wrap ETH → WETH:** `WETH.deposit{value: 0.03 ether}()` (skip if sufficient
   WETH already held).
2. **Approve WETH to NFPM:** `WETH.approve(NFPM, <wethAmount>)`.
3. **Approve GUNR to NFPM:** `GUNR.approve(NFPM, <gunrAmount>)`.
4. **Create + initialize pool:**
   `NFPM.createAndInitializePoolIfNecessary(WETH, GUNR, 10000, <sqrtPriceX96>)`
   using the reused `sqrtPriceX96` from Section 3.3.
5. **Mint full-range position:** `NFPM.mint(MintParams{ token0: WETH,
   token1: GUNR, fee: 10000, tickLower: -887200, tickUpper: 887200,
   amount0Desired, amount1Desired, amount0Min, amount1Min, recipient: 0x9D62,
   deadline })`. Exact `amount1Desired` (GUNR) is computed from the price at
   execution to match the WETH side at full range.

`amount*Min` set to ~95% of desired to tolerate any tick rounding on init.

All exact numeric values (`sqrtPriceX96`, GUNR amount, mins) are recomputed from
live chain state at execution time and confirmed with Joshua before sending.

## 5. Verification (post-execution)

- `Factory.getPool(WETH, GUNR, 10000)` returns the new pool address (non-zero).
- An independent quote (canonical V3 path / Uniswap app) returns a clickable swap
  for a small ETH→GUNR buy.
- A live test buy from a separate wallet succeeds and prints volume/a green candle
  on Dexscreener/GeckoTerminal.

## 6. Follow-on (out of scope for V1, tracked separately)

- **Deepen the pool:** concentrated range, backer co-LP (NomadicFrame / KayOnFire
  / Donald), and recurring contribution — ties to `project_lp_staking_brainstorm`.
- **Aerodrome gauge + emissions** as the "attract other people's WETH" layer.
- **V2 single-sided staking** (`project_staking_rework_spec`) once GUNR is buyable.
- **The "heartbeat + burst" visibility plan** — only meaningful after this ships,
  since buys must succeed first.

## 7. Risks and Notes

- **Thin V1 depth** — stated plainly above; not a silent cap.
- **Two pools now exist** — the locked, unswappable Clanker pool and the new V3
  pool. Aggregators will route to the V3 pool because it is the only swappable
  one; price discovery moves to V3.
- **Token-level wallet warnings (Blockaid) are unaffected** by this change — the
  GUNR token contract is unchanged. Any Blockaid flag is handled on a separate
  track (point to Clanker's audited contracts + verified source).

## 8. Open Parameters for Owner Confirmation

1. **WETH seed amount** — default 0.03 ETH (~$48), keeping ~0.01 for gas. More/less?
2. **Starting FDV** — default: match current (~$21K). Reset higher or lower?
3. **Execution surface** — default: a reviewed `cast` command sequence Joshua runs
   with the `deployer` keystore. Alternative: the Uniswap app UI (less reliable
   from a 7702 wallet, but no terminal).
