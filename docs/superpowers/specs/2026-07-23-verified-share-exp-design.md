# Verified Share EXP — Design (IN PROGRESS, paused overnight 2026-07-23)

**Status:** Section 1 (Smart Contracts) presented and approved. Sections 2–5 not yet
presented. Paused at ~12AM by Joshua's request ("finish tomorrow") — resume by
presenting Section 2 (Frontend Flow) below.

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

## Remaining sections — NOT YET PRESENTED (resume here)

- **Section 2: Frontend Flow.** Hook design (built on `guardedWrite()`), the
  `ShareButtons` integration changes, and an open nuance not yet raised with
  Joshua: `composeCast()`'s real/null completion signal only exists **inside
  the actual Farcaster miniapp context** (`isFarcaster === true`). Outside that
  context (plain browser tab), `ShareButtons` currently falls back to
  `window.open()` to a Warpcast compose URL — same zero-signal problem as
  X/Facebook. Need to decide: does the verified/EXP-earning flow require being
  inside the Farcaster miniapp, with browser-tab users getting an unverified
  fallback (no EXP) or a disabled state with an explanatory message?
- **Section 3: `/tasks` + Dossier page integration.** Replace the localStorage
  flag (shipped earlier today, commit `761a156`) with on-chain
  `hasSharedToday()`-style reads. **Open scope question not yet resolved with
  Joshua:** does Arena battle-share get a *new* EXP-earning task row on
  `/tasks` (mirroring "Share Your Dossier"), and if so what EXP value? No such
  row exists today — only the Dossier-share row does. Must decide before this
  section is final. Explicitly exclude wiring into the leaderboard cron's EXP
  formula and any EXP reset per point 10 above.
- **Section 4: Error handling & edge cases.** Wallet rejection, chain
  mismatch/switch mid-flow, tx timeout, partial-failure recovery (e.g. intent
  confirmed but `confirmShare` fails or times out — should the UI let them
  retry `confirmShare` directly without re-paying for `intentToShare`?).
- **Section 5: Testing plan.** Foundry tests for both contracts (mirroring
  `DailyCheckIn.t.sol`'s day-bucketing test style); manual live-browser
  verification for the frontend flow, matching the testing approach used
  throughout today's session (real production requests, not mocks).

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
