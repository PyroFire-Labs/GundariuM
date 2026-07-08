# GNRM (GundariuM-RE-Grade) — Streme.fun Launch Design Spec

**Date:** 2026-07-08
**Status:** Draft, pending owner approval
**Author:** Larry (for Joshua / PyroFire Labs)

## 1. Problem

GUNR's original liquidity lived in a Clanker V4 pool that has been permanently
dead since ~June 2026 (see `project_gunr_pool_unbuyable`), with 80B of its 100B
supply frozen single-sided inside it. Repeated outreach to Clanker (two Farcaster
profiles) about recovering or fixing that pool went unanswered. A self-funded
replacement V3 pool kept GUNR technically buyable for a few weeks, but on
2026-07-08 Joshua withdrew that pool entirely for cash (unrelated financial
emergency — see `project_gunr_pool_funding_deferred`), so GUNR is effectively
dead again, this time with no active remediation path.

GUNR also carries an unfinished custom-staking obligation: a "GUNR Staking V2"
design (`2026-05-30-gunr-staking-v2-design.md`) intended to add Superfluid
streaming rewards manually, which has not been built.

## 2. Goal

Give GundariuM a genuinely liquid, tradeable token again, launched on a platform
Joshua already trusts from firsthand experience (he holds ~90M staked TYSM, a
Streme.fun token), with native Superfluid streaming staking built in — retiring
the need to build custom staking. Success = GNRM is live, tradeable through
standard Base wallets/aggregators, and staking works with zero custom contract
work.

The ~9.6B GUNR remaining in the deployer wallet is explicitly **out of scope**
here — Joshua's stated long-term intent is to hold it and eventually reposition
it as a premium reward token once GundariuM has an active community. No work is
planned against it as part of this launch.

## 3. Design Decisions

### 3.1 Platform — Streme.fun
Streme deploys tokens as native Superfluid Super Tokens (streamable from
inception, no wrap/unwrap step) with built-in per-second streaming staking and
automatic Uniswap V3 liquidity provisioning. Confirmed against Joshua's own
lived experience as a TYSM staker (Streme's Season One template):

- **Total supply:** 100B (fixed by the platform template).
- **20B → staking rewards pool**, streamed linearly over 365 days via
  Superfluid's General Distribution Agreement; stakers receive rewards 1:1 for
  their staked deposit; 24-hour minimum hold before unstaking.
- **80B → single Uniswap V3 LP position, single-sided**, funded entirely from
  the token's own supply. **The creator supplies zero upfront ETH/WETH** — this
  corrects Joshua's original assumption that the withdrawn GUNR/WETH pool's
  WETH would "fund" the GNRM launch. It doesn't need to; that WETH (if any is
  left after travel/medical costs) is just early buy-in capital, not seed
  capital.
- **Trading fee:** 1% on the Uniswap pool, 40% of which accrues to the token
  creator, claimable anytime; 60% to the Streme protocol.
- Streme also participates in Superfluid's Season 4 $SUP rewards program,
  which connects to Joshua's separate personal SUP position
  (`project_sup_token_reserve`) — noted as a side benefit, not a design driver.

**Known risk, flagged and accepted:** the 80B/100B single-sided-liquidity shape
is structurally similar to the ratio that froze GUNR's original pool. It is not
the same failure mode — GUNR's problem was a Clanker V4 hook bug that reverted
every swap outright, not mere single-sidedness, and single-sided V3 launches are
a standard, functional fair-launch pattern (buyers' ETH becomes the counter-
liquidity as price moves up the curve). Joshua reviewed this parallel directly
and chose to proceed.

### 3.2 Token identity
- **Name:** GundariuM-RE-Grade
- **Symbol:** GNRM
- **Creator/launch account:** `@gundarium` (the project's Farcaster account),
  not Joshua's personal `@pyrofirezero`. This ties the 40% trading-fee share and
  on-chain creator identity to the project rather than to Joshua personally.

### 3.3 Launch mechanism
Streme tokens are created by mentioning `@streme` (an AI agent, Coinbase
AgentKit-powered) in a Farcaster cast that includes the token name, symbol, and
an attached brand image. There is no Foundry/Solidity deploy step on
GundariuM's side — the "deploy" is a social action from `@gundarium`.

### 3.4 Existing GUNR holder relations
No formal on-chain migration/claim contract (a "Migration V3" was considered and
explicitly rejected for this launch). Instead: **discretionary personal gifts**
of GNRM to known holders — Donald, NomadicFrame (3 wallets), Kay, THEC1 — at
Joshua's own timing and amounts, funded from whatever he buys in with. Joshua
should communicate directly with this group about *why* GUNR's pool disappeared
(Clanker's silence plus an unrelated cash need), not just present GNRM as a
fait accompli.

### 3.5 Staking
No custom contract work. Streme's built-in per-second streaming staking is the
staking product for GNRM. The in-progress GUNR Staking V2 design
(`2026-05-30-gunr-staking-v2-design.md`) and the GNDMStaking contract rework
are **retired** — no further design or implementation work against them.

### 3.6 Site/frontend scope at launch
**Minimal.** GNRM is announced via Farcaster/socials first (Joshua posts this
himself). GUNR-facing site references (buy page, any GUNR mentions) are left
as-is at launch time and updated later, after Joshua returns from travel. This
spec does not include a frontend implementation plan for site updates — that is
tracked as follow-on work (Section 6).

### 3.7 Buy-in capital
No fixed amount or percentage. Joshua's commission check (timing aligns with
the target launch date) is the source, but the actual amount is explicitly
undetermined — his crypto reserves are depleted from recent medical costs and a
pre-planned family trip. Buying in is opportunistic on whatever is available
post-trip, not a planned allocation. This does not block the launch itself,
since Streme requires no creator capital.

### 3.8 Timing
- **Target launch date:** Tuesday, 2026-07-14.
- Joshua travels to Wisconsin Dells with Manda and her family 2026-07-10,
  returning Monday 2026-07-13 — he is back before the target date, so no
  remote-execution planning is required (his phones are already paired via
  Claude Code's `/remote-control` if a remote assist is ever needed for
  something else — see `project_remote_access_setup`).
- Joshua handles the launch cast and announcement personally; this is not
  drafted or posted on his behalf unless he asks.

## 4. Execution Steps

This launch has no code-deploy steps. The concrete actions are:

1. Joshua (from `@gundarium`) casts mentioning `@streme` with name
   "GundariuM-RE-Grade", symbol "GNRM", and an attached brand image (source
   from `docs/brand-guidelines.md` assets).
2. Streme's agent deploys the token, staking contract, and Uniswap V3 pool
   automatically.
3. Joshua buys in with whatever ETH is available at the time.
4. Joshua sends discretionary GNRM gifts to known GUNR holders, with a direct
   explanation of the transition.
5. Joshua posts the public launch announcement.

## 5. Verification (post-launch)

- Confirm the new GNRM token contract and its Uniswap V3 pool are live and
  quotable (a small test buy succeeds through a standard wallet).
- Confirm staking works: staking GNRM returns stGNRM and rewards begin
  streaming.
- Confirm the `@gundarium` account is recorded as creator (40% fee-share
  claimable).

## 6. Follow-on (out of scope for this spec, tracked separately)

- **Site updates:** swap GUNR-facing references to GNRM across
  gundarium.xyz (buy page, mint flow mentions, etc.) — deferred until after
  Joshua's trip, per Section 3.6.
- **Whitepaper PDF compression:** unrelated pre-existing issue found during
  this brainstorm — `public/GundariuMwhitepaper.pdf` is 22MB (loads fine but
  is a poor mobile-data experience, likely from uncompressed embedded images).
  Should be compressed to a few MB. Tracked as its own follow-on, not part of
  the GNRM launch.
- **Remaining ~9.6B GUNR repricing** as a premium reward token — explicitly
  deferred by Joshua until GundariuM has an active community (Section 2).

## 7. Risks and Notes

- **Single-sided-LP parallel to the original GUNR failure** — flagged in 3.1,
  accepted by Joshua after review.
- **Abrupt transition** — the GUNR pool's withdrawal was forced by an unrelated
  financial emergency, not sequenced as part of this plan. There is no "legacy
  exit window" for existing GUNR holders to trade out; GUNR was already
  effectively dead by the time this spec was written. Holder communication
  (3.4) is the mitigation, not a liquidity window.
- **Buy-in capital is unfunded/undetermined** (3.7) — treat any dollar
  projection involving Joshua's own GNRM position as speculative until he
  actually buys in.

## 8. Open Parameters for Owner Confirmation

1. **Brand image for the launch cast** — which asset from `docs/brand-
   guidelines.md` / `public/` should be attached? Not yet specified.
2. **Gift amounts/timing for existing holders** — left fully to Joshua's
   discretion; no default proposed here.
