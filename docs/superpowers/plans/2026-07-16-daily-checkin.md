# Daily Check-In & Frame-Runner EXP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an on-chain daily check-in contract with streak tracking, a `/tasks` page showing all six daily tasks (three live, one link-out, two placeholders), and a "Share Victory" button on the Arena's battle-outcome screen.

**Architecture:** A new standalone UUPS-upgradeable `DailyCheckIn.sol` contract (owned by the existing deployer wallet, no new keys) tracks per-address streaks with simple day-index arithmetic. The frontend reads that contract plus two existing ones (`GunplaCard`, `GNDMStaking`) to compute a client-side-only "Frame-Runner EXP" display number — no backend, no stored/spendable balance. Two new Satori OG-image routes power Farcaster share cards for battle victories and check-in streaks, reusing the existing per-token OG pipeline and the existing `ShareButtons` component (extended with two new variants).

**Tech Stack:** Foundry (Solidity ^0.8.24, OpenZeppelin Upgradeable v5, UUPS), Next.js 16 App Router, wagmi v3, viem v2, `next/og` (Satori).

## Global Constraints

- Solidity: `// ─── Section ────` divider comments (box-drawing `─`, matching `contracts/src/GNDMStaking.sol`'s exact style), custom errors only (no `require` strings) in all new Solidity code, UUPS upgradeable pattern for every new contract.
- Contract owner for `DailyCheckIn` is the existing deployer wallet (`0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7`) — same as every other GundariuM contract, per the approved spec. No new keystore involved in this plan.
- TypeScript everywhere in `src/`, path alias `@/` → `src/`.
- No new backend, database, or stored EXP balance — Frame-Runner EXP is computed client-side on every page load from on-chain reads only.
- Task "Stake Token" is a UI placeholder only in this plan — no logic, no contract calls. "Buy GNRM" is live (Task 5) — GNRM staking's Streme-side indexing bug was fixed, and Joshua confirmed the buy flow should go live too, verified against a real on-chain purchase (30,000 GNRM/day minimum) rather than trusted on claim.
- React 19 + React Compiler is enabled (`reactCompiler: true`) — avoid new manual `useMemo`/`useCallback` in freshly-written files. The existing `ShareButtons.tsx` already uses `useCallback`; when modifying that file, match its existing style rather than removing it.
- Every new/modified Solidity file must compile with `forge build` (run from `contracts/`) before its task is considered done. Every new/modified TypeScript file must pass `npx tsc --noEmit` (run from repo root) before its task is considered done.

---

### Task 1: `DailyCheckIn.sol` contract

**Files:**
- Create: `contracts/src/DailyCheckIn.sol`

**Interfaces:**
- Produces: `DailyCheckIn.checkIn() external`, `DailyCheckIn.getStreak(address user) external view returns (uint256 current, uint256 longest, uint256 total, uint256 lastDay)`, `DailyCheckIn.initialize(address owner_) external`, custom error `DailyCheckIn.AlreadyCheckedInToday()`, event `DailyCheckIn.CheckedIn(address indexed user, uint256 day, uint256 streak)`.

- [ ] **Step 1: Write the contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DailyCheckIn
 * @notice Tracks daily check-in streaks per address. Bragging-rights only —
 *         no rewards, no token transfers, no spendable balance. Standalone
 *         contract, does not touch GunplaCard, GundaniumGame, or GNDMStaking.
 */
contract DailyCheckIn is OwnableUpgradeable, UUPSUpgradeable {
    // ─── Errors ─────────────────────────────────────────────────────────────

    error AlreadyCheckedInToday();

    // ─── Events ─────────────────────────────────────────────────────────────

    event CheckedIn(address indexed user, uint256 day, uint256 streak);

    // ─── State ──────────────────────────────────────────────────────────────

    mapping(address => uint256) public lastCheckInDay;
    mapping(address => uint256) public currentStreak;
    mapping(address => uint256) public longestStreak;
    mapping(address => uint256) public totalCheckIns;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /// @notice Check in for the current UTC day. Reverts if already checked
    ///         in today. Increments the streak if yesterday was the last
    ///         check-in; resets to 1 on any gap (or a first-ever check-in).
    function checkIn() external {
        uint256 today = block.timestamp / 1 days;
        if (lastCheckInDay[msg.sender] == today) revert AlreadyCheckedInToday();

        uint256 newStreak = (lastCheckInDay[msg.sender] == today - 1)
            ? currentStreak[msg.sender] + 1
            : 1;

        currentStreak[msg.sender] = newStreak;
        if (newStreak > longestStreak[msg.sender]) {
            longestStreak[msg.sender] = newStreak;
        }
        totalCheckIns[msg.sender] += 1;
        lastCheckInDay[msg.sender] = today;

        emit CheckedIn(msg.sender, today, newStreak);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    /// @notice Single-call read of a user's full check-in state.
    function getStreak(address user)
        external
        view
        returns (uint256 current, uint256 longest, uint256 total, uint256 lastDay)
    {
        return (currentStreak[user], longestStreak[user], totalCheckIns[user], lastCheckInDay[user]);
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

- [ ] **Step 2: Compile**

Run (from `contracts/`): `forge build`
Expected: `Compiler run successful` with no errors or warnings referencing `DailyCheckIn.sol`.

- [ ] **Step 3: Commit**

```bash
cd contracts && git add src/DailyCheckIn.sol && git commit -m "$(cat <<'EOF'
feat(contracts): add DailyCheckIn streak-tracking contract

Standalone UUPS contract, bragging-rights only — no rewards or
token transfers. Day-index arithmetic (block.timestamp / 1 days)
for check-in cooldown and streak continuity.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `DailyCheckIn.t.sol` test suite

**Files:**
- Create: `contracts/test/DailyCheckIn.t.sol`

**Interfaces:**
- Consumes: everything produced in Task 1.

- [ ] **Step 1: Write the failing test file**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DailyCheckIn} from "../src/DailyCheckIn.sol";

contract DailyCheckInTest is Test {
    DailyCheckIn checkIn;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    function setUp() public {
        // Start at a large, realistic day count to avoid T=0 edge cases.
        vm.warp(1_000_000 days);

        DailyCheckIn impl = new DailyCheckIn();
        bytes memory init = abi.encodeCall(DailyCheckIn.initialize, (owner));
        checkIn = DailyCheckIn(address(new ERC1967Proxy(address(impl), init)));
    }

    // ─── First check-in ─────────────────────────────────────────────────────

    function test_checkIn_firstEver_setsStreakToOne() public {
        vm.prank(alice);
        checkIn.checkIn();

        (uint256 current, uint256 longest, uint256 total, uint256 lastDay) = checkIn.getStreak(alice);
        assertEq(current, 1);
        assertEq(longest, 1);
        assertEq(total, 1);
        assertEq(lastDay, block.timestamp / 1 days);
    }

    // ─── Consecutive days ────────────────────────────────────────────────────

    function test_checkIn_consecutiveDays_incrementsStreak() public {
        vm.prank(alice);
        checkIn.checkIn();

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        checkIn.checkIn();

        (uint256 current,,,) = checkIn.getStreak(alice);
        assertEq(current, 2);
    }

    // ─── Gap resets streak ───────────────────────────────────────────────────

    function test_checkIn_gapOfTwoDays_resetsStreakToOne() public {
        vm.prank(alice);
        checkIn.checkIn();

        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        checkIn.checkIn();

        (uint256 current,,,) = checkIn.getStreak(alice);
        assertEq(current, 1);
    }

    // ─── Same-day double check-in reverts ────────────────────────────────────

    function test_checkIn_sameDayTwice_reverts() public {
        vm.prank(alice);
        checkIn.checkIn();

        vm.prank(alice);
        vm.expectRevert(DailyCheckIn.AlreadyCheckedInToday.selector);
        checkIn.checkIn();
    }

    // ─── Longest streak survives a reset ─────────────────────────────────────

    function test_checkIn_longestStreak_survivesReset() public {
        // Pure numeric-literal warp targets, matching setUp()'s own
        // 1_000_000 days literal exactly — no arithmetic expression, no
        // re-read of block.timestamp, no accumulated local. Two prior
        // attempts using block.timestamp-derived expressions produced
        // wrong values on the 3rd/4th warp in this function specifically
        // (verified via trace) despite working in every single-warp test
        // elsewhere in this file; literals are the only pattern confirmed
        // reliable here.
        vm.prank(alice);
        checkIn.checkIn(); // streak = 1

        vm.warp(1_000_001 days);
        vm.prank(alice);
        checkIn.checkIn(); // streak = 2

        vm.warp(1_000_002 days);
        vm.prank(alice);
        checkIn.checkIn(); // streak = 3

        vm.warp(1_000_005 days); // gap
        vm.prank(alice);
        checkIn.checkIn(); // streak resets to 1

        (uint256 current, uint256 longest,,) = checkIn.getStreak(alice);
        assertEq(current, 1);
        assertEq(longest, 3);
    }

    // ─── totalCheckIns only ever increments ──────────────────────────────────

    function test_checkIn_totalCheckIns_incrementsEveryTime() public {
        vm.prank(alice);
        checkIn.checkIn();
        vm.warp(block.timestamp + 5 days); // big gap, streak resets, total still climbs
        vm.prank(alice);
        checkIn.checkIn();

        (,, uint256 total,) = checkIn.getStreak(alice);
        assertEq(total, 2);
    }

    // ─── Independent users tracked separately ────────────────────────────────

    function test_checkIn_independentUsers_trackedSeparately() public {
        vm.prank(alice);
        checkIn.checkIn();

        (uint256 aliceStreak,,,) = checkIn.getStreak(alice);
        (uint256 bobStreak,,,) = checkIn.getStreak(bob);
        assertEq(aliceStreak, 1);
        assertEq(bobStreak, 0);
    }

    // ─── Upgrade authorization ────────────────────────────────────────────────

    function test_upgrade_nonOwner_reverts() public {
        DailyCheckIn newImpl = new DailyCheckIn();
        vm.prank(alice);
        vm.expectRevert();
        checkIn.upgradeToAndCall(address(newImpl), "");
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run (from `contracts/`): `forge test --match-contract DailyCheckInTest -vv`
Expected: `8 passed; 0 failed` (all eight test functions above).

If `test_checkIn_firstEver_setsStreakToOne` fails on the `lastDay` assertion, double check `vm.warp(1_000_000 days)` landed before `setUp()`'s proxy deployment — the day count must be large enough that `today - 1` never equals a fresh user's default `lastCheckInDay` of `0`.

- [ ] **Step 3: Commit**

```bash
cd contracts && git add test/DailyCheckIn.t.sol && git commit -m "$(cat <<'EOF'
test(contracts): cover DailyCheckIn streak, reset, and revert paths

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `DeployDailyCheckIn.s.sol` deploy script

**Files:**
- Create: `contracts/script/DeployDailyCheckIn.s.sol`

**Interfaces:**
- Consumes: `DailyCheckIn.initialize(address)` from Task 1.

- [ ] **Step 1: Write the script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DailyCheckIn} from "../src/DailyCheckIn.sol";

/**
 * @notice Deploys DailyCheckIn as a UUPS proxy. Standalone — does not touch
 *         GunplaCard, GundaniumGame, GNDMStaking, or PrizePool.
 *
 * Key injection (two options — pick one):
 *   A) cast wallet keystore (recommended):
 *        forge script ... --account deployer
 *      (no DEPLOYER_PRIVATE_KEY needed in .env)
 *
 *   B) env var fallback (pass at runtime, not stored):
 *        DEPLOYER_PRIVATE_KEY=0x... forge script ...
 *
 * Required env vars:
 *   OWNER_ADDRESS — address that will own the proxy (the existing deployer wallet)
 *
 * Usage (Base Sepolia):
 *   OWNER_ADDRESS=0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7 \
 *     forge script script/DeployDailyCheckIn.s.sol \
 *     --rpc-url https://sepolia.base.org --account deployer --broadcast --verify -vvvv
 *
 * After deploy: paste the logged proxy address into
 *   src/lib/contracts/addresses.ts  (dailyCheckIn key, 84532 entry)
 * then redeploy the frontend.
 */
contract DeployDailyCheckIn is Script {
    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");

        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        console.log("=== DailyCheckIn Deploy ===");
        console.log("Owner: ", owner_);

        DailyCheckIn impl = new DailyCheckIn();
        bytes memory init = abi.encodeCall(DailyCheckIn.initialize, (owner_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);

        vm.stopBroadcast();

        console.log("Implementation:    ", address(impl));
        console.log("Proxy (use this):  ", address(proxy));
        console.log("");
        console.log("Next step: add proxy address to src/lib/contracts/addresses.ts (dailyCheckIn)");
    }
}
```

- [ ] **Step 2: Compile**

Run (from `contracts/`): `forge build`
Expected: `Compiler run successful`, no errors referencing `DeployDailyCheckIn.s.sol`.

- [ ] **Step 3: Commit**

```bash
cd contracts && git add script/DeployDailyCheckIn.s.sol && git commit -m "$(cat <<'EOF'
feat(contracts): add DailyCheckIn deploy script

Mirrors DeployStaking.s.sol's UUPS proxy pattern exactly —
implementation deploy, abi.encodeCall init, ERC1967Proxy wrap.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Frontend contract wiring — ABI, addresses, hook

**Files:**
- Create: `src/lib/contracts/abis/DailyCheckIn.ts`
- Create: `src/lib/contracts/hooks/useDailyCheckIn.ts`
- Modify: `src/lib/contracts/addresses.ts`

**Interfaces:**
- Produces: `DAILY_CHECKIN_ABI`, `useDailyCheckIn()` returning `{ currentStreak: number, longestStreak: number, totalCheckIns: number, checkedInToday: boolean, phase: "idle"|"checking-in"|"done"|"error", error: string|null, contractReady: boolean, checkIn: () => Promise<void>, reset: () => void }`.
- Consumes: `getContracts`, `isPlaceholder` from `addresses.ts`.

- [ ] **Step 1: Write the ABI file**

```typescript
export const DAILY_CHECKIN_ABI = [
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "checkIn",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "getStreak",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "current", type: "uint256" },
      { name: "longest", type: "uint256" },
      { name: "total", type: "uint256" },
      { name: "lastDay", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
      { name: "streak", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },

  // ─── Errors ───────────────────────────────────────────────────────────────
  {
    type: "error",
    name: "AlreadyCheckedInToday",
    inputs: [],
  },
] as const;
```

- [ ] **Step 2: Add `dailyCheckIn` to `addresses.ts`**

Modify `src/lib/contracts/addresses.ts` — add the field to the type and to both chain entries (placeholder zero address for now; Task 8 replaces the 84532 value with the real deployed address):

```typescript
export const CONTRACT_ADDRESSES: Record<
  number,
  {
    gunplaCard: `0x${string}`;
    gundaniumGame: `0x${string}`;
    prizePool: `0x${string}`;
    gunrStaking: `0x${string}`;
    gunrToken: `0x${string}`;
    migration: `0x${string}`;
    dailyCheckIn: `0x${string}`;
  }
> = {
  // Base Sepolia (testnet)
  84532: {
    gunplaCard: "0x7475CeA2680ddaF22B914F45290e22a75e29fF4c",
    gundaniumGame: "0x310767a15fD906C3F702d54B565904dE6Aca6be7",
    prizePool: "0xa5670c2dD9916BE1DB9974977844228Cfc3bA731",
    gunrStaking: "0x4fFFF1428f49Ae73a21AA103C992533BA24E48E7",
    gunrToken: "0x6Add3cF424f9D2927721B13110164a3e019efFa4",
    migration: "0x0000000000000000000000000000000000000000",
    dailyCheckIn: "0x0000000000000000000000000000000000000000",
  },
  // Base mainnet
  8453: {
    gunplaCard: "0xA7bc3d31A4863b33854F2d73C77BAf31c4f27a6C",
    gundaniumGame: "0x0000000000000000000000000000000000000000",
    prizePool: "0x0000000000000000000000000000000000000000",
    gunrStaking: "0x2F61D7EaC30E44ed33df3a441aDfC69C47Bd5B02",
    gunrToken: "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07",
    migration: "0x8CCbd8EEA766d564fC0AD09D2cB99e4cD4107230",
    dailyCheckIn: "0x0000000000000000000000000000000000000000",
  },
};
```

Leave everything else in the file (the `GUNR_TOKEN_ADDRESS` deprecated export, `getContracts`, `isPlaceholder`) unchanged.

- [ ] **Step 3: Write the hook**

```typescript
"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, usePublicClient, useAccount, useChainId } from "wagmi";
import { DAILY_CHECKIN_ABI } from "@/lib/contracts/abis/DailyCheckIn";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";

export type CheckInPhase = "idle" | "checking-in" | "done" | "error";

export function useDailyCheckIn() {
  const [phase, setPhase] = useState<CheckInPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try {
    contracts = getContracts(chainId);
  } catch {
    /* unsupported chain */
  }

  const checkInAddress = contracts?.dailyCheckIn;
  const contractReady = !!checkInAddress && !isPlaceholder(checkInAddress);

  const { data: streakData, refetch: refetchStreak } = useReadContract({
    address: checkInAddress,
    abi: DAILY_CHECKIN_ABI,
    functionName: "getStreak",
    args: address ? [address] : undefined,
    query: { enabled: contractReady && !!address },
  });

  const [current, longest, total, lastDay] = streakData ?? [0n, 0n, 0n, 0n];
  const today = BigInt(Math.floor(Date.now() / 86_400_000));
  const checkedInToday = lastDay === today;

  const checkIn = async () => {
    if (!contracts || !contractReady) return;
    setPhase("checking-in");
    setError(null);
    if (!publicClient) {
      setError("Wallet not connected to a supported network");
      setPhase("error");
      return;
    }
    try {
      const tx = await writeContractAsync({
        address: contracts.dailyCheckIn,
        abi: DAILY_CHECKIN_ABI,
        functionName: "checkIn",
        args: [],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 60_000 * 5 });

      setPhase("done");
      refetchStreak();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check-in failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  };

  return {
    currentStreak: Number(current),
    longestStreak: Number(longest),
    totalCheckIns: Number(total),
    checkedInToday,
    phase,
    error,
    contractReady,
    checkIn,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
  };
}
```

- [ ] **Step 4: Typecheck**

Run (from repo root): `npx tsc --noEmit`
Expected: no errors referencing `abis/DailyCheckIn.ts`, `addresses.ts`, or `hooks/useDailyCheckIn.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/abis/DailyCheckIn.ts src/lib/contracts/hooks/useDailyCheckIn.ts src/lib/contracts/addresses.ts
git commit -m "$(cat <<'EOF'
feat(contracts-frontend): wire DailyCheckIn ABI, address slot, and hook

Mirrors useStaking's phase/error/contractReady shape. Address entries
are placeholder zero addresses until Task 10's Sepolia deploy.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: GNRM daily-buy verification hook

**Files:**
- Create: `src/lib/contracts/hooks/useGnrmPurchaseCheck.ts`

**Interfaces:**
- Produces: `useGnrmPurchaseCheck()` returning `{ phase: "idle"|"checking"|"verified"|"not-met"|"error", error: string|null, check: () => Promise<void>, reset: () => void }`.
- Consumes: nothing from earlier tasks — GNRM is a Streme-launched token independent of the GundariuM contract suite in `addresses.ts`, so the token and pool addresses are hardcoded constants in this hook, not read from `getContracts()`.

GNRM/WETH pool: `0x72d3338600cf47766e4f9e435be4879593870181` (confirmed on-chain, see [[project_gnrm_streme_launch]]). GNRM token: `0x271b01cc11032a4e23f0200f8f57eb45176ab491`. Minimum daily buy: 30,000 GNRM (18 decimals).

- [ ] **Step 1: Write the hook**

```typescript
"use client";

import { useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import { parseAbiItem } from "viem";

const GNRM_ADDRESS = "0x271b01cc11032a4e23f0200f8f57eb45176ab491" as const;
const GNRM_POOL_ADDRESS = "0x72d3338600cf47766e4f9e435be4879593870181" as const;
const MIN_DAILY_BUY = 30_000n * 10n ** 18n; // 30,000 GNRM, 18 decimals
const BASE_BLOCKS_PER_DAY = 45_000n; // ~2s blocks on Base, buffered above the exact 43,200

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export type GnrmCheckPhase = "idle" | "checking" | "verified" | "not-met" | "error";

/**
 * Verifies a GNRM purchase by checking for a Transfer event from the
 * GNRM/WETH pool directly to the connected wallet — proves a real swap,
 * not just any incoming transfer. Window is an approximate rolling ~24h
 * (Base block times make exact UTC-midnight boundaries impractical to
 * pin down without an indexer), not a precise calendar-day check.
 */
export function useGnrmPurchaseCheck() {
  const [phase, setPhase] = useState<GnrmCheckPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const { address } = useAccount();
  const publicClient = usePublicClient();

  const check = async () => {
    if (!address || !publicClient) {
      setError("Wallet not connected");
      setPhase("error");
      return;
    }
    setPhase("checking");
    setError(null);
    try {
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > BASE_BLOCKS_PER_DAY ? currentBlock - BASE_BLOCKS_PER_DAY : 0n;

      const logs = await publicClient.getLogs({
        address: GNRM_ADDRESS,
        event: TRANSFER_EVENT,
        args: { from: GNRM_POOL_ADDRESS, to: address },
        fromBlock,
        toBlock: "latest",
      });

      const total = logs.reduce((sum, log) => sum + (log.args.value ?? 0n), 0n);
      setPhase(total >= MIN_DAILY_BUY ? "verified" : "not-met");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check failed";
      setError(msg);
      setPhase("error");
    }
  };

  return {
    phase,
    error,
    check,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run (from repo root): `npx tsc --noEmit`
Expected: no errors in `useGnrmPurchaseCheck.ts`.

- [ ] **Step 3: Manual sanity check**

Run `npm run dev`. Since this hook has no UI yet (Task 6 wires the button), exercise it directly: open the browser console on any page while connected as `0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7` (bought ~100.02M GNRM at launch — comfortably over the 30,000 minimum) and temporarily call the hook from a throwaway test component, or just confirm `publicClient.getLogs(...)` with the same parameters returns at least one log with `args.value` when run ad hoc in the console. Whether `phase` lands on `"verified"` depends on whether that launch-day purchase is still inside the ~45,000-block rolling window by the time you test — if it's aged out, that's expected, not a bug; a fresh small purchase (30,000+ GNRM) from any wallet is the reliable way to confirm `"verified"` end-to-end.

- [ ] **Step 4: Commit**

```bash
git add src/lib/contracts/hooks/useGnrmPurchaseCheck.ts
git commit -m "$(cat <<'EOF'
feat(tasks): add GNRM daily-buy verification hook

Confirms a real purchase via Transfer-from-pool event, not just any
incoming transfer. Rolling ~24h window (block-estimated, not exact
UTC-midnight) and a 30,000 GNRM/day minimum, per Joshua's spec.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `/tasks` page

**Files:**
- Create: `src/app/tasks/page.tsx`

**Interfaces:**
- Consumes: `useDailyCheckIn()` (Task 4), `useGnrmPurchaseCheck()` (Task 5), `useCollection()` (existing — returns `{ cards, isLoading, isConnected, count }`), `useStaking()` (existing — returns includes `staked: string`).

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useDailyCheckIn } from "@/lib/contracts/hooks/useDailyCheckIn";
import { useGnrmPurchaseCheck } from "@/lib/contracts/hooks/useGnrmPurchaseCheck";
import { useCollection } from "@/lib/contracts/hooks/useCollection";
import { useStaking } from "@/lib/contracts/hooks/useStaking";
import { ShareButtons } from "@/components/ui/ShareButtons";

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf0XmuUIJ9IC4CymaSdLv761No_U9o5GOMTK71bmdyyC3R9zA/viewform";

function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function useCountdownToNextUtcDay(active: boolean): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const ms = nextUtcMidnight().getTime() - Date.now();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setLabel(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  return label;
}

export default function TasksPage() {
  const { address, isConnected } = useAccount();
  const { currentStreak, totalCheckIns, checkedInToday, phase, checkIn, contractReady } = useDailyCheckIn();
  const { count: mintedCount } = useCollection();
  const { staked } = useStaking();
  const { phase: gnrmPhase, check: checkGnrmBuy } = useGnrmPurchaseCheck();

  const hasStaked = parseFloat(staked || "0") > 0;
  const gnrmVerified = gnrmPhase === "verified";
  const countdown = useCountdownToNextUtcDay(checkedInToday);
  const exp =
    currentStreak * 10 + totalCheckIns * 5 + mintedCount * 25 + (hasStaked ? 50 : 0) + (gnrmVerified ? 12 : 0);

  if (!isConnected) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-[var(--foreground)]/50 font-[family-name:var(--font-orbitron)] text-sm tracking-widest">
          CONNECT YOUR WALLET TO VIEW DAILY TASKS
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <div className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-[0.3em] text-[var(--accent)]/60 uppercase">
            Frame-Runner
          </div>
          <h1 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl font-black tracking-wider text-white md:text-3xl">
            DAILY TASKS
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-center">
            <div className="text-[10px] font-[family-name:var(--font-orbitron)] tracking-widest text-[var(--foreground)]/50 uppercase">
              Total EXP
            </div>
            <div className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)]">
              {exp.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-[family-name:var(--font-orbitron)] tracking-widest text-[var(--foreground)]/50 uppercase">
              Daily Streak
            </div>
            <div className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)]">
              {currentStreak}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <TaskRow
            title="Check In"
            expLabel="+10 EXP"
            done={checkedInToday}
            countdown={checkedInToday ? countdown : undefined}
            actionLabel={contractReady ? (phase === "checking-in" ? "Checking In..." : "Check In") : "Unavailable"}
            onAction={checkIn}
            disabled={!contractReady || phase === "checking-in"}
          />
          <TaskRow
            title="Buy GNRM"
            subtitle="Buy 30,000+ GNRM today"
            expLabel="+12 EXP"
            done={gnrmVerified}
            actionLabel={
              gnrmPhase === "checking" ? "Checking..." : gnrmPhase === "not-met" ? "Not Met — Recheck" : "Check"
            }
            onAction={checkGnrmBuy}
            disabled={gnrmPhase === "checking"}
          />
          <TaskRow
            title="Run Demo + Submit Form"
            expLabel="+15 EXP"
            linkHref={GOOGLE_FORM_URL}
            linkLabel="Open Form"
          />
          <TaskRow
            title="Mint a Gundar-Frame"
            expLabel="+25 EXP"
            done={mintedCount > 0}
            linkHref={mintedCount > 0 ? undefined : "/mint"}
            linkLabel="Mint Now"
          />
          <TaskRow title="Stake Token" expLabel="+10 EXP" placeholder />
          <DossierTaskRow address={address} streak={currentStreak} exp={exp} />
        </div>
      </div>
    </main>
  );
}

function TaskRow({
  title,
  subtitle,
  expLabel,
  done,
  countdown,
  actionLabel,
  onAction,
  disabled,
  linkHref,
  linkLabel,
  placeholder,
}: {
  title: string;
  subtitle?: string;
  expLabel: string;
  done?: boolean;
  countdown?: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  linkHref?: string;
  linkLabel?: string;
  placeholder?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-4 ${
        placeholder ? "border-[var(--border)] bg-[var(--surface)]/50 opacity-50" : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div>
        <div className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-white">{title}</div>
        {subtitle && <div className="text-[10px] text-[var(--foreground)]/50">{subtitle}</div>}
        <div className="font-mono text-[10px] text-[var(--accent)]">{expLabel}</div>
      </div>
      {placeholder ? (
        <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-widest text-[var(--foreground)]/40 uppercase">
          Coming Soon
        </span>
      ) : done && countdown ? (
        <span className="font-mono text-xs text-[var(--foreground)]/60 border border-[var(--border)] rounded-full px-3 py-1">
          {countdown}
        </span>
      ) : done ? (
        <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-widest text-[var(--accent)] uppercase">
          Done
        </span>
      ) : linkHref ? (
        <Link
          href={linkHref}
          target={linkHref.startsWith("http") ? "_blank" : undefined}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-wider text-black transition-all hover:scale-105"
        >
          {linkLabel}
        </Link>
      ) : (
        <button
          onClick={onAction}
          disabled={disabled}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-wider text-black transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function DossierTaskRow({ address, streak, exp }: { address: `0x${string}` | undefined; streak: number; exp: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <div className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-white">Share Your Dossier</div>
        <div className="font-mono text-[10px] text-[var(--accent)]">+8 EXP</div>
      </div>
      {address && <ShareButtons dossier={{ address, streak, exp }} />}
    </div>
  );
}
```

`ShareButtons` doesn't have a `dossier` prop yet at this point in the plan — that's added in Task 7. Typechecking this file will show one error (`Property 'dossier' does not exist...`) until Task 7 is done; that's expected, not a bug in this task.

- [ ] **Step 2: Typecheck**

Run (from repo root): `npx tsc --noEmit`
Expected: errors only about `ShareButtons`'s missing `dossier` prop (resolved by Task 8) — no other errors in `tasks/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/tasks/page.tsx
git commit -m "$(cat <<'EOF'
feat(tasks): add /tasks page with six-item daily checklist

Three live (check-in, mint, dossier share), one link-out (demo+form),
two disabled placeholders (buy GNRM, stake). EXP computed client-side,
no storage.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: OG image routes (dossier + victory)

**Files:**
- Create: `src/app/api/og/dossier/[address]/route.tsx`
- Create: `src/app/api/og/victory/route.tsx`

**Interfaces:**
- Consumes: `DAILY_CHECKIN_ABI`, `getContracts`, `isPlaceholder` (Task 4).
- Produces: `GET /api/og/dossier/:address` and `GET /api/og/victory?player=&enemy=&hp=`, both returning `image/png`.

- [ ] **Step 1: Write the dossier route**

```tsx
import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { DAILY_CHECKIN_ABI } from "@/lib/contracts/abis/DailyCheckIn";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const contentType = "image/png";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

interface RouteContext {
  params: Promise<{ address: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return new Response("Invalid address", { status: 400 });
  }

  const contracts = getContracts(base.id);
  let streak = 0;
  let total = 0;

  if (!isPlaceholder(contracts.dailyCheckIn)) {
    try {
      const result = await publicClient.readContract({
        address: contracts.dailyCheckIn,
        abi: DAILY_CHECKIN_ABI,
        functionName: "getStreak",
        args: [address as `0x${string}`],
      });
      streak = Number(result[0]);
      total = Number(result[2]);
    } catch {
      // fall through with zeros
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0a0f",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 8, color: "#00d4ff", textTransform: "uppercase" }}>
          Frame-Runner Dossier
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 900, marginTop: 24 }}>{streak} DAY STREAK</div>
        <div style={{ display: "flex", fontSize: 28, color: "#888", marginTop: 16 }}>{total} total check-ins</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

- [ ] **Step 2: Write the victory route**

```tsx
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const contentType = "image/png";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const player = searchParams.get("player") ?? "Unknown Frame";
  const enemy = searchParams.get("enemy") ?? "Unknown Frame";
  const hp = searchParams.get("hp") ?? "0";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0a0f",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 8, color: "#00d4ff", textTransform: "uppercase" }}>
          Victory
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 900, marginTop: 16 }}>{player}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#888", marginTop: 8 }}>defeated {enemy}</div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 24, color: "#00d4ff" }}>{hp}% HP remaining</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

- [ ] **Step 3: Verify locally**

Run: `npm run dev`, then in another terminal:
```bash
curl -s -o /tmp/victory.png -w "%{http_code}\n" "http://localhost:3000/api/og/victory?player=Aegis-Titan&enemy=Iron-Duke&hp=42"
curl -s -o /tmp/dossier.png -w "%{http_code}\n" "http://localhost:3000/api/og/dossier/0x0000000000000000000000000000000000000001"
```
Expected: both print `200`, and `/tmp/victory.png` / `/tmp/dossier.png` are valid PNG files (`file /tmp/victory.png` reports `PNG image data`).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/og/dossier src/app/api/og/victory
git commit -m "$(cat <<'EOF'
feat(og): add dossier and victory OG image routes

Dossier reads DailyCheckIn on-chain (server-side, verifiable).
Victory is fully param-driven — there's no persisted battle state
to look up, matching the spec's noted limitation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Extend `ShareButtons` with `battle` and `dossier` variants

**Files:**
- Modify: `src/components/ui/ShareButtons.tsx`

**Interfaces:**
- Produces: `ShareButtonsProps` gains two new optional fields: `battle?: { playerName: string; enemyName: string; hpPct: number }` and `dossier?: { address: \`0x${string}\`; streak: number; exp: number }`.
- Consumes: nothing new from other tasks (uses `useAccount` from `wagmi`, already a dependency).

- [ ] **Step 1: Extend the props interface**

Find the existing `ShareButtonsProps` interface (near the top of the file, currently just `{ card?: {...} }`) and replace it:

```typescript
interface ShareButtonsProps {
  /** Optional minted card context — when provided, the share line is personalized. */
  card?: {
    name: string;
    rarity: Rarity;
    tokenId: bigint | null;
  };
  /** Optional Arena battle context — shown as a Share Victory button. */
  battle?: {
    playerName: string;
    enemyName: string;
    hpPct: number;
  };
  /** Optional Frame-Runner dossier context. */
  dossier?: {
    address: `0x${string}`;
    streak: number;
    exp: number;
  };
}
```

- [ ] **Step 2: Extend `buildShareText`**

Find the existing `buildShareText(card)` function and replace its signature and body to branch on all three variants:

```typescript
function buildShareText(props: Pick<ShareButtonsProps, "card" | "battle" | "dossier">): string {
  if (props.battle) {
    const { playerName, enemyName, hpPct } = props.battle;
    return `${playerName} just defeated ${enemyName} in the GundariuM Arena — ${Math.round(hpPct)}% HP remaining. Battle your own Gundar-Frame at gundarium.xyz/arena`;
  }
  if (props.dossier) {
    return `${props.dossier.streak}-day check-in streak, ${props.dossier.exp.toLocaleString()} Frame-Runner EXP. Building mine at gundarium.xyz/tasks`;
  }
  if (!props.card) return DEFAULT_TEXT;
  const tokenSuffix = props.card.tokenId !== null ? ` (#${props.card.tokenId.toString()})` : "";
  return `Just forged ${props.card.name}${tokenSuffix} — ${displayRarity(props.card.rarity)} tier — on GundariuM. Mint your own Gundar-Frame at gundarium.xyz/mint`;
}
```

- [ ] **Step 3: Update the component body**

Find where `ShareButtons({ card }: ShareButtonsProps = {})` destructures props and computes `text`/`embedUrl`. Replace with:

```typescript
export function ShareButtons({ card, battle, dossier }: ShareButtonsProps = {}) {
  const [isFarcaster, setIsFarcaster] = useState(false);
  const text = buildShareText({ card, battle, dossier });
  const embedUrl = battle
    ? `${SITE_URL}/api/og/victory?player=${encodeURIComponent(battle.playerName)}&enemy=${encodeURIComponent(battle.enemyName)}&hp=${Math.round(battle.hpPct)}`
    : dossier
      ? `${SITE_URL}/api/og/dossier/${dossier.address}`
      : card?.tokenId !== undefined && card?.tokenId !== null
        ? `${SITE_URL}/card/${card.tokenId.toString()}`
        : SITE_URL;
```

Leave everything below this (the `useEffect` Farcaster-context detection, `shareOnFarcaster`, `shareOnX`, `shareOnFacebook`, `shareGeneric`, and the render/JSX) unchanged — they already close over `text` and `embedUrl` by name, so the new branches flow through automatically. Update the `useCallback` dependency arrays that reference `card` to also include `battle` and `dossier` if `card` is currently listed there (check each `useCallback([..., card])` in the file and add the two new props alongside it, since they now also affect `text`/`embedUrl`).

- [ ] **Step 4: Typecheck**

Run (from repo root): `npx tsc --noEmit`
Expected: no errors in `ShareButtons.tsx`, and the errors from Task 6's `tasks/page.tsx` (missing `dossier` prop) are now gone.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ShareButtons.tsx
git commit -m "$(cat <<'EOF'
feat(share): add battle and dossier variants to ShareButtons

Reuses the existing Farcaster-detection and compose-cast logic
unchanged — only text/embedUrl construction branches per variant.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: "Share Victory" button on the Arena outcome screen

**Files:**
- Modify: `src/app/arena/page.tsx`

**Interfaces:**
- Consumes: `ShareButtons` with the `battle` variant (Task 8).

- [ ] **Step 1: Add the import**

At the top of `src/app/arena/page.tsx`, alongside the existing `import Link from "next/link";`:

```tsx
import { ShareButtons } from "@/components/ui/ShareButtons";
```

- [ ] **Step 2: Pass `playerHpPct` into `BattleOutcome`**

Find this block (currently around line 376-383):

```tsx
          {b.phase === "complete" && b.winner && (
            <BattleOutcome
              winner={b.winner}
              playerName={b.player.name}
              enemyName={b.enemy.name}
              onAgain={pickRandomBattle}
            />
          )}
```

Replace with:

```tsx
          {b.phase === "complete" && b.winner && (
            <BattleOutcome
              winner={b.winner}
              playerName={b.player.name}
              enemyName={b.enemy.name}
              playerHpPct={playerHpPct}
              onAgain={pickRandomBattle}
            />
          )}
```

(`playerHpPct` is already computed earlier in the component, at `const playerHpPct = (b.playerHp / b.player.hp) * 100;` — no new computation needed.)

- [ ] **Step 3: Update the `BattleOutcome` component**

Find the `BattleOutcome` function (currently around line 560-601) and replace it entirely:

```tsx
function BattleOutcome({
  winner,
  playerName,
  enemyName,
  playerHpPct,
  onAgain,
}: {
  winner: "player" | "enemy";
  playerName: string;
  enemyName: string;
  playerHpPct: number;
  onAgain: () => void;
}) {
  const playerWon = winner === "player";
  return (
    <div className="text-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 md:p-10">
      <div className={`mb-3 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-[0.3em] uppercase ${playerWon ? "text-[var(--accent)]" : "text-orange-300"}`}>
        {playerWon ? "Victory" : "Defeat"}
      </div>
      <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-black text-white tracking-wider mb-2 md:text-4xl">
        {playerWon ? playerName : enemyName} WINS
      </h2>
      <p className="text-sm text-[var(--foreground)]/50 mb-8">
        {playerWon
          ? "You routed your opponent. The arena recognizes your frame."
          : "Your frame fell. The opponent stands. Adjust the rotation, try again."}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onAgain}
          className="rounded-full bg-[var(--accent)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_24px_var(--accent)]"
        >
          BATTLE AGAIN
        </button>
        <Link
          href="/mint"
          className="rounded-full border border-[var(--accent-2)] bg-[var(--background)]/40 px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-[var(--accent-2)] backdrop-blur-sm transition-all hover:bg-[var(--accent-2)] hover:text-white"
        >
          MINT YOUR OWN
        </Link>
      </div>
      {playerWon && (
        <div className="mt-4">
          <ShareButtons battle={{ playerName, enemyName, hpPct: playerHpPct }} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/arena`, click BEGIN BATTLE, and play until the battle completes.
- If you win: confirm a Share Victory control renders below MINT YOUR OWN, and clicking it opens either the Farcaster miniapp composer or a `warpcast.com/~/compose` tab (depending on whether you're in a Farcaster miniapp context) with text mentioning your card's name and the opponent's, and an embed pointing at `/api/og/victory?...`.
- If you lose: confirm no Share button renders (retry with RESHUFFLE + BEGIN BATTLE until you get a win to check the above).

- [ ] **Step 5: Typecheck**

Run (from repo root): `npx tsc --noEmit`
Expected: no errors in `arena/page.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/app/arena/page.tsx
git commit -m "$(cat <<'EOF'
feat(arena): add Share Victory button to the battle outcome screen

Shown only on a win. Removes the manual screenshot-then-compose
friction from the daily task-3 flow.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Deploy `DailyCheckIn` to Base Sepolia (user-executed)

This task involves broadcasting a real transaction from the deployer keystore — run it yourself rather than having it executed on your behalf, same as tonight's earlier `setMerkleRoot` broadcast.

**Files:**
- Modify: `src/lib/contracts/addresses.ts` (84532 entry's `dailyCheckIn` field, after deploy)

- [ ] **Step 1: Deploy**

```bash
cd contracts
OWNER_ADDRESS=0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7 \
  forge script script/DeployDailyCheckIn.s.sol \
  --rpc-url https://sepolia.base.org --account deployer --broadcast -vvvv
```

It'll prompt for the `deployer` keystore password, then print `Implementation:` and `Proxy (use this):` addresses. Copy the proxy address.

- [ ] **Step 2: Update `addresses.ts`**

Replace the `84532` entry's `dailyCheckIn: "0x0000000000000000000000000000000000000000"` with the real proxy address from Step 1.

- [ ] **Step 3: Verify on-chain**

```bash
cast call <PROXY_ADDRESS> "getStreak(address)(uint256,uint256,uint256,uint256)" 0x0000000000000000000000000000000000000001 --rpc-url https://sepolia.base.org
```
Expected: `0 0 0 0` (a never-checked-in address reads all zeros — confirms the contract is live and readable).

- [ ] **Step 4: Commit**

```bash
git add src/lib/contracts/addresses.ts
git commit -m "$(cat <<'EOF'
chore(contracts): add DailyCheckIn Sepolia proxy address

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Mainnet deploy follows the same script with `--rpc-url https://mainnet.base.org` once Sepolia testing looks good — not included as a plan step since it should happen deliberately, not as part of a batch.
