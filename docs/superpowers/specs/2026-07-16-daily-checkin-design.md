# Daily Check-In & Frame-Runner EXP — Design

## Context

Kay (SMM) proposed daily check-ins for demo-phase Arena players, matching the pattern every Farcaster miniapp already uses (TYSM, Farverse). Joshua's full daily task list is six items:

1. Check In
2. Buy a small amount of GNRM (blocked — pending Streme.fun reply)
3. Run the Arena demo and submit the Google Form (ETH wallet address + link to a screenshot of the demo battle cast) — feeds the temporary demo leaderboard
4. Mint a new Gundar-Frame
5. Stake token
6. Share a "dossier" (profile/stats card) to Farcaster, off the streak

This session already has an explicit budget constraint — the bigger backend-services brainstorm ([[project_cloudflare_hybrid]]) stayed deferred. Tasks 2 and 5 are explicit placeholders for now; the rest either already exist or are cheap to build on top of existing patterns.

## Goals

- A working daily check-in mechanism with on-chain streak tracking.
- A `/tasks` page listing all six tasks: three functional (Check In, Mint, Dossier Share), one linking out (Demo + Form), two disabled placeholders (Buy GNRM, Stake).
- "Frame-Runner EXP" as a pure client-side display number — bragging rights only.

## Non-goals (explicitly out of scope)

- No backend or database of any kind.
- No spendable/redeemable EXP balance. Unlike TYSM's "Glow" (confirmed backend-stored, spent to claim bonus NFTs), Frame-Runner EXP has no planned use beyond display — a deliberate difference, not an oversight.
- No on-chain task registry. Task metadata (names, EXP values, active/placeholder flags) lives in frontend code; changes ship through normal git/Vercel deploys, gated by repo access alone. Decided explicitly over building on-chain task config.
- Tasks 2 (Buy GNRM) and 5 (Stake) are not implemented this round — placeholder UI rows only.
- Task 3 (Demo + Form) is not fully verifiable, but is stronger than plain self-report. The form requires a link to a **Farcaster cast** (not an arbitrary image host) of the demo battle screenshot. Casts are signed and checked against the on-chain-registered public key for the poster's FID (identity/keys live on Optimism; cast content itself lives on Snapchain, Farcaster's off-chain message-ordering layer — not a blockchain ledger). That proves *who* posted the screenshot and *when*, which rules out someone claiming credit for another player's win. It does not prove the screenshot's content wasn't staged or doctored before casting — that gap has no fix at this layer, so UI copy should still avoid implying full rigor.

## Architecture

### Contract — `DailyCheckIn.sol`

New, standalone, UUPS upgradeable contract (per [[feedback_uups_default]]) — not merged into `GunplaCard`, `GundaniumGame`, or `GNDMStaking`. Check-in is functionally unrelated to any of them, and those contracts hold real value that shouldn't take on unrelated upgrade risk.

**State:**
- `mapping(address => uint256) lastCheckInDay`
- `mapping(address => uint256) currentStreak`
- `mapping(address => uint256) longestStreak`
- `mapping(address => uint256) totalCheckIns`

**Functions:**
- `checkIn() external` — computes `today = block.timestamp / 1 days`. Reverts with custom error `AlreadyCheckedInToday()` if `lastCheckInDay[msg.sender] == today`. If `lastCheckInDay[msg.sender] == today - 1`, increments `currentStreak[msg.sender]`; otherwise (a gap, or a first-ever check-in) resets `currentStreak[msg.sender] = 1`. Updates `longestStreak[msg.sender]` if the current streak exceeds it. Increments `totalCheckIns[msg.sender]`. Sets `lastCheckInDay[msg.sender] = today`. Emits `CheckedIn(address indexed user, uint256 day, uint256 streak)`.
- `getStreak(address user) external view returns (uint256 current, uint256 longest, uint256 total, uint256 lastDay)` — single-call read for the frontend.
- Standard UUPS `_authorizeUpgrade`, `onlyOwner`.
- `initialOwner` = the existing deployer wallet (`0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7`), same as every other GundariuM contract. Considered and rejected a freshly generated, segregated owner wallet for this contract specifically — the real risk concentration is on the contracts holding actual value (GunplaCard, GundaniumGame, GNDMStaking, the migration contract), all still owned by the same deployer wallet, so segregating only this low-stakes contract wouldn't meaningfully reduce blast radius. It would, however, cost the consistent "every GundariuM contract traces back to the same known, FID-linked wallet" trust signal that makes ownership easy to verify on Basescan. If real wallet segregation happens, it should be a deliberate, comprehensive move (likely a multisig for whatever actually holds value), applied consistently — not piecemeal starting with the smallest contract.

**Deploy:** new `contracts/script/DeployDailyCheckIn.s.sol`, following the existing `DeployStaking.s.sol` pattern. Base Sepolia first, mainnet after testing — same rollout convention as every other contract in this repo.

**Tests:** `contracts/test/DailyCheckIn.t.sol`, mirroring `GNDMStaking.t.sol`'s style:
- Consecutive-day check-ins increment streak.
- A missed day resets streak to 1.
- Same-day double check-in reverts `AlreadyCheckedInToday`.
- `longestStreak` tracks correctly across resets.
- `totalCheckIns` only ever increments.

### Frontend — new `/tasks` page

- New hook `src/lib/contracts/hooks/useDailyCheckIn.ts`, mirroring the existing `useStaking`/`useMint` hook patterns — wraps the `getStreak` read and `checkIn` write.
- New ABI `src/lib/contracts/abis/DailyCheckIn.ts`; new address entries (testnet + mainnet placeholder) in `src/lib/contracts/addresses.ts`.
- New page `src/app/tasks/page.tsx`:
  - Header stats block: Total EXP, Daily Streak — values computed client-side, mirroring TYSM's header pattern.
  - Six-item task checklist:
    1. **Check In** — live. Button calls `checkIn()`. Once done today, shows a countdown to the next UTC day (computed, not stored).
    2. **Buy GNRM** — disabled row, "Coming Soon" badge. No logic.
    3. **Run demo + submit form** — links out to the Google Form (URL to be filled in once written). The form's screenshot field requires a Farcaster cast link specifically, not an arbitrary image host — see Non-goals for what that does and doesn't verify. No on-chain completion tracking either way.
    4. **Mint a Gundar-Frame** — reads existing GunplaCard balance via the existing `useCollection` hook; marked done if balance > 0; links to `/mint` otherwise.
    5. **Stake token** — disabled row, "Coming Soon" badge. No logic.
    6. **Share your dossier** — new OG image route (e.g. `src/app/api/og/dossier/[address]/route.tsx`), reusing the existing Satori pipeline (`src/lib/og/generateOgImage.tsx`) to render current streak/EXP on a card, plus a "Share to Farcaster" button matching the existing per-token share-button pattern.
- Frame-Runner EXP formula: computed client-side from the three real on-chain sources (check-in contract, GunplaCard balance, GNDMStaking position). Exact weighting is an implementation detail, not an architectural fork.

## Data flow

Wallet connects on `/tasks` → page reads three on-chain sources in parallel via wagmi hooks (`DailyCheckIn.getStreak`, GunplaCard balance, GNDMStaking position) → computes EXP and per-task completion state client-side → renders header stats and checklist → user actions (`checkIn()` tx, mint/form link-outs, dossier share) trigger on-chain writes or external navigation → affected state is re-read and the page updates.

## Error handling

- `checkIn()` revert (`AlreadyCheckedInToday`) surfaces as a friendly "already checked in, come back tomorrow" state, not a raw revert message.
- Wallet not connected → connect prompt in place of the checklist.
- RPC read failure → retry state, consistent with existing patterns elsewhere in the app.

## Open items for implementation

Not architectural forks — details to fill in while building:
- Exact EXP weighting formula for the header display number.
- Final URL for the Google Form (task 3), once Joshua finishes writing it.
- Exact OG image layout for the dossier card.
- Base Sepolia address for `DailyCheckIn` once deployed (mainnet stays placeholder until tested, per existing repo convention).
