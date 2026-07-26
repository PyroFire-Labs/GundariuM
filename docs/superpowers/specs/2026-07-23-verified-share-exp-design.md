# Verified Share EXP — Design

**Status:** Approved in full (Sections 1–5), 2026-07-26. Paused overnight on
2026-07-23 after Section 1; resumed and completed 2026-07-26, after the Base
App integration branch shipped. Ready for an implementation plan.

## Origin

Joshua caught a real bug: canceling a Dossier share on Farcaster still granted the
+8 EXP task credit, because `ShareButtons`' `onShare` fired immediately on button
click, with no check that the share actually completed. His framing for the fix
went further than a simple bug patch: he wants this to work like TYSM's flow —
two real on-chain transactions (not free signatures), one on intent, one on
confirmation — and pointed out the same pattern could give Arena battle-result
shares genuine proof-of-play, not just Dossier shares.

His stated motivation, verbatim-close: **EXP/leaderboard accuracy matters even for
bragging-rights features** ("it shouldn't be permissible to be inaccurate,
especially since the leaderboard's first tracking is on EXP"). The 2-tx cost is
not primarily an anti-bot-spam deterrent — it's about the EXP number being *true*.

## Decisions locked in during clarifying questions

1. **Real on-chain paid transactions**, not free EIP-191 signatures — confirmed
   explicitly, matches how TYSM does it.
2. **Two separate lightweight logging contracts** (`DossierShareLog`,
   `ArenaBattleLog`), not one shared contract, not extending an existing contract.
3. **Intent → Confirm model**: tx#1 (`intentToShare`) fires the moment Share is
   clicked, before the compose dialog opens. tx#2 (`confirmShare`) fires only
   after we can confirm the share actually completed. EXP is granted only once
   tx#2 lands.
4. **Scope covers both** Dossier share and Arena battle-result share in one
   design (not split into two separate design passes).
5. **Arena stays free to play.** The intent/confirm tx pair is triggered only
   when the player clicks Share on the battle result screen — never required to
   start or play a battle. This preserves Arena's current "free Demo" framing
   (CLAUDE.md already documents it as entirely client-side, not on-chain).
6. **Only the Farcaster share button gets the verified flow.** `composeCast()` is
   the only share path with a real completion signal — it returns
   `{ cast: ComposeCastInnerResult | null }`; `null` means the user cancelled.
   X, Facebook, and the generic Web Share button are plain `window.open()` calls
   with zero completion signal, so they cannot be verified and stay exactly as
   they are today (unverified, no EXP).
7. **On the two EXP-earning rows** (Share Your Dossier, and the not-yet-built
   Arena battle-share row), only the Farcaster button is shown — X/Facebook/
   generic Share are hidden there specifically, to avoid confusion about why
   clicking them doesn't grant EXP. Those three buttons remain fully available
   in other contexts (e.g. sharing a freshly minted card, which has no EXP tied
   to it anyway).
8. **Gas cost on cancel is accepted and intentional** — if the user cancels
   after tx#1 lands, they've spent real gas for nothing. Joshua's framing:
   this is fine because the point is EXP accuracy, not just cost-based
   deterrence.
9. **Arena battle log records the real result fields**: player name, enemy name,
   won/lost, HP% remaining — not just a boolean "battled today". Named
   explicitly during design: since Arena battles run entirely client-side with
   no trusted server resolver (unlike `GundaniumGame`'s EIP-712 signed PvP
   resolution), this is **cost-gated self-attestation**, not cryptographic
   proof of fair simulation. Real gas makes mass-fabrication expensive; it does
   not cryptographically prove the fight was simulated fairly. Joshua accepted
   this framing explicitly.
10. **Task-done state should ultimately come from an on-chain read**
    (`hasSharedToday(address)`-style), replacing the localStorage flag shipped
    earlier today — same pattern as Check-In/Buy GNRM/Mint/Stake, all of which
    read real on-chain state already. **However: wiring this into the actual
    leaderboard EXP formula (`/api/cron/refresh-leaderboard/route.ts`) and any
    EXP reset is explicitly OUT OF SCOPE for this pass.** Joshua: "yes, but we
    aren't attempting that UNTIL it is 100% correct" — build the on-chain
    source of truth now, defer the leaderboard wiring/reset to a later pass
    once he's fully confident the tracking is accurate.
11. **Rate limit: one intent/confirm cycle per UTC day per address**, per
    contract — matches every other daily task on `/tasks` (Check-In, Buy GNRM,
    Mint, Stake). Prevents repeat-farming the same or a new result multiple
    times in one day.

## Pre-existing context discovered during design (useful precedent)

- **The leaderboard cron's EXP formula is already a strict subset** of what
  `/tasks` shows client-side:
  - Leaderboard (`refresh-leaderboard/route.ts`, server-verified on-chain reads
    only): `currentStreak*10 + totalCheckIns*5 + mintedCount*25 + perfectWeek*200`
  - `/tasks` page (adds self-reported/client-only extras on top of the above
    four terms): `+ stakedToday*50 + gnrmVerified*12 + formDone*15 +
    dossierShared*8`
  - This is exactly the precedent point 10 above follows — the leaderboard
    already deliberately excludes categories that aren't server-verifiable.
    `stakedToday`/`gnrmVerified` actually *are* on-chain-verifiable today (via
    `useStakedTodayCheck`/`useGnrmPurchaseCheck`, real Transfer-event reads) but
    aren't yet folded into the leaderboard formula either — `formDone` and
    (until this work) `dossierShared` are the two that are structurally
    unverifiable server-side today.
- **The right frontend building block is `guardedWrite()`** from
  `src/lib/contracts/hooks/useMint.ts` (re-checks the connector's live chain ID,
  races `writeContractAsync` against a 20s timeout, then
  `publicClient.waitForTransactionReceipt`) — **not** `useSaveLineup`'s
  `signMessage` pattern, which is for free off-chain signatures and doesn't fit
  since this feature requires real paid transactions.
- **Day-bucketing convention**: `block.timestamp / 1 days`, same as
  `DailyCheckIn.sol`.
- Leaderboard is currently blank in production — noted by Joshua as known and
  not urgent, unrelated to this design.

## Section 1: Smart Contracts (APPROVED)

Two new UUPS upgradeable contracts, deployed to Base mainnet (same convention as
`GunplaCard`/`DailyCheckIn`), identical intent→confirm shape, different confirm
payload.

**`DossierShareLog.sol`**
```solidity
mapping(address => uint256) public pendingIntentDay;   // day bucket of last intentToShare()
mapping(address => uint256) public lastConfirmedDay;    // day bucket of last confirmShare()

function intentToShare() external;
function confirmShare(uint256 streak, uint256 exp) external;
function hasSharedToday(address user) external view returns (bool);

event ShareIntentLogged(address indexed user, uint256 day);
event ShareConfirmed(address indexed user, uint256 day, uint256 streak, uint256 exp);
```
- `intentToShare()`: callable repeatedly (covers retry-after-cancel) as long as
  today isn't already confirmed; reverts if `hasSharedToday` is already true.
- `confirmShare(...)`: reverts unless `pendingIntentDay[user] == today` (intent
  must have been called first, same day) and `lastConfirmedDay[user] != today`
  (no double-confirm).

**`ArenaBattleLog.sol`** — identical shape, different confirm payload:
```solidity
function confirmBattleShare(string calldata playerName, string calldata enemyName, bool won, uint16 hpPct) external;
event BattleShareConfirmed(address indexed user, uint256 day, string playerName, string enemyName, bool won, uint16 hpPct);
```

Both follow existing repo conventions: custom errors (not `require` strings),
`// ─── Section ────` header divider style, UUPS via OpenZeppelin v5.

## Resumption context (2026-07-26)

This design paused right before the Base App integration branch was built and
merged (SIWE sign-in, `baseAccount` wagmi connector, Redis-backed sessions —
see `docs/superpowers/specs/2026-07-24-base-app-integration-design.md`). That
raised a real question for Section 2 below: does Base App's own session layer
change the "only Farcaster has a completion signal" framing from decision 6?

Checked directly against Base's current docs before resuming: `composeCast`
has **no replacement in the Base App at all** ("Not needed in the Base App" —
unlike `signIn`, `sendToken`, etc., which got real migration paths). So Base
App users have no native share-completion signal, exactly like a plain
browser tab. The original two-way split (Farcaster miniapp has a signal;
everyone else doesn't) still holds — it's not a three-way split. Section 2
below reflects this.

## Section 2: Frontend Flow (APPROVED)

**One shared hook, not two.** Both contracts have identical
`intentToShare()`/`hasSharedToday()` shape and differ only in
`confirmShare(...)`'s payload, so a single generic hook does the on-chain
work, parameterized per feature:

```ts
useVerifiedShare({ contractAddress, abi, buildConfirmArgs })
```

It exposes `verifiedShare(composeCastFn)`, a `phase` (`idle | checking |
intent-pending | awaiting-share | confirm-pending | done | cancelled |
error`), and a live `hasSharedToday` read (reused for task-row done state in
Section 3). Internally it reuses `guardedWrite()` from `useMint.ts` — live
chain re-check, 20s timeout, `waitForTransactionReceipt` — for **both** the
intent and confirm transactions, the same proven pattern that made Farcaster
wallet-bridge failures fail loud instead of hanging silently (see
[[feedback_farcaster_chain_switch]] / [[feedback_farcaster_dataSuffix_break]]
memory).

`verifiedShare` sequence:
1. If `hasSharedToday` is already true, short-circuit — no transactions, the
   caller shows the existing "done today" state.
2. `intentToShare()` via `guardedWrite` — tx#1, fires before the compose
   dialog opens.
3. Call the passed `composeCastFn()` (the actual `sdk.actions.composeCast(...)`
   call — owned by `ShareButtons`, not this hook, keeping the hook
   Farcaster-SDK-agnostic).
4. `{ cast: null }` (user cancelled) → `phase: "cancelled"`, return `false`.
   No `confirmShare` call — gas from step 2 is spent, matches the
   already-approved accepted-cost decision (point 8 above).
5. A real cast → `confirmShare(...)` via `guardedWrite`, args from
   `buildConfirmArgs()` (`{ streak, exp }` for Dossier; `{ playerName,
   enemyName, won, hpPct }` for Arena). `phase: "done"`, return `true`.

Two thin wrappers instantiate it: `useDossierShareVerification({ streak, exp
})` and `useArenaBattleShareVerification({ playerName, enemyName, won, hpPct
})` — each just supplies contract address/ABI/args-builder to the shared
hook.

**`ShareButtons` changes:** one new optional prop, `verified?: {
verifiedShare: (composeCastFn) => Promise<boolean>; phase: SharePhase }`.
When present:
- Only the Farcaster button renders — X/Facebook/generic hidden (matches
  decision 7).
- Outside a Farcaster client, that button becomes a disabled explanatory
  state ("Open in Farcaster to earn EXP for this") instead of the unverified
  `window.open()` fallback it uses today.
- Clicking it calls `verified.verifiedShare(() =>
  sdk.actions.composeCast(...))` instead of firing `onShare?.()` immediately
  — the button's label reflects `phase` ("Confirming on-chain...", etc.)
  instead of the current instant-fire click (the exact bug that started this
  design).

When `verified` is **not** passed — every other `ShareButtons` usage today
(e.g. fresh-mint card share) — behavior is completely unchanged: all four
buttons, the old `onShare` callback, no on-chain calls. Purely additive.

## Section 3: `/tasks` + Dossier page integration (APPROVED)

**Dossier row** keeps its current shape (`DossierTaskRow` renders
`ShareButtons` with `dossier={...}`), but `done` now comes from
`useDossierShareVerification()`'s live `hasSharedToday` read against
`DossierShareLog`, not `useDossierShareTaskDone()`'s localStorage read, and
its `ShareButtons` gets the new `verified={...}` prop from Section 2.
`src/lib/dossierShareTask.ts` is deleted — fully superseded, not kept
alongside.

**New Arena battle-share row, `+8 EXP`** (parity with Dossier share — same
verified cost, same task category; confirmed with Joshua over the
alternative of a higher value like +12, or no row at all). Added to the
client-side `/tasks` formula: `+ (arenaBattleShared ? 8 : 0)`, alongside the
existing `dossierShared ? 8 : 0` term. Per the already-locked scope boundary
(point 10), this stays purely additive to the client-side formula — **not**
wired into the leaderboard cron's server-side EXP formula in this pass, and
no EXP reset, until Joshua has personally confirmed the on-chain tracking is
100% accurate.

**This row is status-only, not action, unlike every other row.** Every
existing task row can act directly from `/tasks` because its data (wallet
address, streak, collection) is always available there. Arena battle results
(`playerName`, `enemyName`, `won`, `hpPct`) only exist right after finishing
a battle, on the Arena page — there's nothing to share *from* `/tasks`. So
this row:
- Reads `hasSharedToday` from `ArenaBattleLog` directly (same pattern as
  Dossier).
- Shows **Done** if true, or a subtitle like "Play a battle and share the
  result to earn this" if not — no button of its own.
- The real share button stays exactly where it is today: on Arena's
  battle-result screen, where `ShareButtons` already renders for both wins
  and losses. That instance gets `verified={useArenaBattleShareVerification({
  ... })}` — the same upgrade Dossier's gets, on a different screen.

## Section 4: Error handling & edge cases (APPROVED)

**Chain mismatch and tx timeout — already solved, reused as-is.** Both
`intentToShare()` and `confirmShare()` go through `guardedWrite()` from
Section 2, so both automatically get the live chain re-check and 20s
timeout-with-actionable-message `useMint.ts` already proved out. No new work;
confirmed the reuse covers it.

**Wallet rejects the intent transaction (tx#1):** no gas spent, nothing
on-chain happened. `phase: "error"`, message `"Signature cancelled"` (matches
the existing wording convention from `useSiweSignIn`/`useSaveLineup`). Retry
is just clicking Share again.

**The one real recovery case: intent lands, then `confirmShare` (tx#2) fails
or the wallet rejects it.** By this point the user has already posted the
real cast — Farcaster's compose dialog already returned a non-null cast
before `confirmShare` was ever called. Making them re-share (a duplicate
cast) just to retry the on-chain confirmation would be wrong. So the hook
keeps the last successful `buildConfirmArgs()` result in memory after step 3
succeeds, and exposes a separate `retryConfirm()` function that replays
*only* `confirmShare()` — no new intent, no reopening the compose dialog.
The UI shows a distinct state for this ("Share posted — confirming
on-chain..." with a Retry button on failure) rather than routing back through
the full Share button.

**Contract-level reverts need friendly mapping, not raw error text.** Since
Section 1 locked in custom errors (not `require` strings), a reverted
`intentToShare()`/`confirmShare()` won't naturally decode to readable text.
The hook needs to catch and map the categories that can actually occur
through normal use: already-shared-today (if `hasSharedToday` was stale when
the button was clicked — e.g. two tabs open), and intent/confirm mismatch
(defensive fallback; shouldn't happen via our own UI). Exact Solidity error
names are an implementation-plan detail, not a design-level requirement — but
the frontend should never surface a raw revert selector to the user.

## Section 5: Testing plan (APPROVED)

**Foundry tests** for both `DossierShareLog.t.sol` and `ArenaBattleLog.t.sol`,
mirroring `DailyCheckIn.t.sol`'s exact style (`vm.warp()` for day-bucket
control, one assertion-focused test per behavior):

- `test_intentToShare_firstOfDay_succeeds`
- `test_intentToShare_sameDayTwice_succeedsIfNotYetConfirmed` (retry-after-cancel)
- `test_intentToShare_afterAlreadyConfirmedToday_reverts`
- `test_confirmShare_withoutIntent_reverts`
- `test_confirmShare_afterIntent_succeeds` (+ `confirmBattleShare` equivalent)
- `test_confirmShare_sameDayTwice_reverts` (no double-confirm)
- `test_hasSharedToday_afterConfirm_returnsTrue` / `_beforeConfirm_returnsFalse`
- `test_dayBucket_resetsNextDay` (`vm.warp(+1 days)` — fresh `intentToShare` succeeds again)
- `test_independentUsers_trackedSeparately`
- Event emission tests for `ShareIntentLogged`/`ShareConfirmed` (and `BattleShareConfirmed`)
- `test_upgrade_nonOwner_reverts` (UUPS auth, same as `DailyCheckIn.t.sol`)

**Frontend: manual live-browser verification**, no mocks — this repo has no
frontend test framework (per CLAUDE.md), consistent with the approach used
throughout this project. Scenarios to walk through live on Base mainnet:
- Full happy path: Share → intent tx confirms → compose dialog opens → post a
  real cast → confirm tx lands → row flips to Done, EXP updates.
- Cancel at the compose dialog (don't post) → confirm tx never fires, gas
  from intent is spent, row stays not-done, retry available.
- Reject the confirm transaction after actually posting the cast →
  `retryConfirm()` works without re-opening compose or re-paying intent.
- Non-Farcaster context (plain browser, Base App) → disabled explanatory
  state renders correctly, no attempt to call `composeCast`.
- Already shared today → reload the page, row correctly shows Done from the
  live `hasSharedToday` read, no stale localStorage involved anywhere.

## Already-shipped code this session that this design supersedes

- Commit `761a156` (`fix(tasks): actually award the +8 EXP for Share Your
  Dossier`) added a localStorage-based "done today" flag and wired the +8 into
  the client-side `exp` formula. This was a real improvement over the prior
  state (no tracking at all) but is exactly the gap this design closes —
  localStorage can't be trusted, doesn't feed the leaderboard, and (per the bug
  report that started this conversation) doesn't actually verify the share
  completed. `src/lib/dossierShareTask.ts`, the `onShare` callback plumbing
  through `ShareButtons`, and the DONE-badge UI in `DossierTaskRow` are all
  likely reusable scaffolding — the on-chain contract becomes the source of
  truth underneath, replacing the two `localStorage` calls
  (`isDossierSharedToday`/`markDossierSharedToday`).
