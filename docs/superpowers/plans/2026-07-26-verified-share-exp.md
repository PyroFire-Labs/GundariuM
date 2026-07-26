# Verified Share EXP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the localStorage-based "Share Your Dossier" EXP task with a real, on-chain-verified two-transaction (intent + confirm) flow, and extend the same verified flow to a new Arena battle-share EXP task — so EXP can never be granted for a share that didn't actually happen.

**Architecture:** Two new lightweight UUPS logging contracts (`DossierShareLog`, `ArenaBattleLog`), a shared frontend hook (`useVerifiedShare`) that drives an intent-tx → `composeCast()` → confirm-tx sequence reusing the existing `guardedWrite()` chain-safety pattern from `useMint.ts`, and `ShareButtons` gaining an opt-in `verified` mode that only ever applies inside a real Farcaster client.

**Tech Stack:** Solidity ^0.8.24 (Foundry, OpenZeppelin v5 upgradeable UUPS), Next.js 16 / React 19, wagmi v3 / viem v2, `@farcaster/miniapp-sdk`.

## Global Constraints

- Real on-chain paid transactions only — never a free EIP-191 signature for this feature.
- Two separate contracts (`DossierShareLog`, `ArenaBattleLog`), not one shared contract, not an extension of an existing contract.
- Intent → Confirm model: `intentToShare()` fires before the compose dialog opens; the confirm transaction (`confirmShare`/`confirmBattleShare`) fires only after a real, non-null cast result. EXP is granted only once the confirm tx lands.
- Only the Farcaster share button ever gets the verified flow. X, Facebook, and the generic Web Share button are never wired to on-chain calls and never earn EXP, in any context.
- On the two EXP-earning rows (Dossier share, Arena battle-share), X/Facebook/generic buttons are hidden entirely — only the Farcaster button (real or disabled) shows there. All four buttons remain available, unchanged, everywhere else `ShareButtons` is used (e.g. a freshly minted card).
- Outside a real Farcaster client (plain browser, Base App — confirmed via Base's own docs to have no `composeCast` equivalent), the verified button renders disabled with the exact copy `"Open in Farcaster to earn EXP for this"`.
- Gas spent on `intentToShare()` is never refunded or protected against — cancelling after tx#1 lands is an accepted, intentional cost.
- Arena's battle log records real result fields (`playerName`, `enemyName`, `won`, `hpPct`), not just a boolean. This is cost-gated self-attestation, not cryptographic fairness proof — Arena has no trusted server resolver.
- Rate limit: one intent/confirm cycle per UTC day per address, per contract. Day bucket is `block.timestamp / 1 days`, identical convention to `DailyCheckIn.sol`.
- Custom errors (not `require` strings), `// ─── Section ────` header dividers, UUPS via OpenZeppelin v5 — matches every existing contract in `contracts/src/`.
- This pass is explicitly **not** wired into the leaderboard cron's server-side EXP formula (`src/app/api/cron/refresh-leaderboard/route.ts`), and does **not** reset any EXP numbers. That happens in a future pass, only once Joshua has personally confirmed the on-chain tracking is fully accurate.
- The new Arena battle-share task row is `+8 EXP` (parity with Dossier share) and is **status-only** — it has no button of its own, since battle-result data doesn't exist on the `/tasks` page. The actual share button stays on Arena's battle-result screen.
- Deploying the two new contracts to Base mainnet is a manual step Joshua runs himself (`--account deployer` keystore, never an env-var private key — matches every existing deploy script in this repo). No task in this plan performs a real deploy broadcast.

---

### Task 1: `DossierShareLog` contract + tests

**Files:**
- Create: `contracts/src/DossierShareLog.sol`
- Create: `contracts/test/DossierShareLog.t.sol`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `DossierShareLog` contract with `intentToShare()`, `confirmShare(uint256 streak, uint256 exp)`, `hasSharedToday(address) view returns (bool)`, `pendingIntentDay(address) view returns (uint256)` (public mapping getter), `lastConfirmedDay(address) view returns (uint256)` (public mapping getter). Later tasks (Task 3) need these exact names for the ABI file.

- [ ] **Step 1: Write the contract**

```solidity
// contracts/src/DossierShareLog.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DossierShareLog
 * @notice Verifies a Dossier share actually completed before EXP is granted.
 *         Two-transaction intent/confirm model: intentToShare() fires the
 *         moment Share is clicked, confirmShare() fires only after a real
 *         composeCast() result. Standalone contract — does not touch
 *         GunplaCard, GundaniumGame, or DailyCheckIn.
 */
contract DossierShareLog is OwnableUpgradeable, UUPSUpgradeable {
    // ─── Errors ─────────────────────────────────────────────────────────────

    error AlreadySharedToday();
    error NoIntentForToday();
    error AlreadyConfirmedToday();

    // ─── Events ─────────────────────────────────────────────────────────────

    event ShareIntentLogged(address indexed user, uint256 day);
    event ShareConfirmed(address indexed user, uint256 day, uint256 streak, uint256 exp);

    // ─── State ──────────────────────────────────────────────────────────────

    mapping(address => uint256) public pendingIntentDay;
    mapping(address => uint256) public lastConfirmedDay;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /// @notice Logs intent to share. Callable repeatedly the same day (covers
    ///         retry-after-cancel) as long as today isn't already confirmed.
    function intentToShare() external {
        uint256 today = block.timestamp / 1 days;
        if (lastConfirmedDay[msg.sender] == today) revert AlreadySharedToday();

        pendingIntentDay[msg.sender] = today;
        emit ShareIntentLogged(msg.sender, today);
    }

    /// @notice Confirms a share actually completed. Reverts unless intent was
    ///         logged today first, and unless today isn't already confirmed.
    function confirmShare(uint256 streak, uint256 exp) external {
        uint256 today = block.timestamp / 1 days;
        if (pendingIntentDay[msg.sender] != today) revert NoIntentForToday();
        if (lastConfirmedDay[msg.sender] == today) revert AlreadyConfirmedToday();

        lastConfirmedDay[msg.sender] = today;
        emit ShareConfirmed(msg.sender, today, streak, exp);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function hasSharedToday(address user) external view returns (bool) {
        return lastConfirmedDay[user] == block.timestamp / 1 days;
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

- [ ] **Step 2: Write the test file**

```solidity
// contracts/test/DossierShareLog.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DossierShareLog} from "../src/DossierShareLog.sol";

contract DossierShareLogTest is Test {
    DossierShareLog log;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    function setUp() public {
        vm.warp(1_000_000 days);

        DossierShareLog impl = new DossierShareLog();
        bytes memory init = abi.encodeCall(DossierShareLog.initialize, (owner));
        log = DossierShareLog(address(new ERC1967Proxy(address(impl), init)));
    }

    // ─── Intent ──────────────────────────────────────────────────────────────

    function test_intentToShare_firstOfDay_succeeds() public {
        vm.prank(alice);
        log.intentToShare();

        assertEq(log.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    function test_intentToShare_sameDayTwice_succeedsIfNotYetConfirmed() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.intentToShare(); // retry-after-cancel — must not revert
        vm.stopPrank();

        assertEq(log.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    function test_intentToShare_afterAlreadyConfirmedToday_reverts() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmShare(5, 100);

        vm.expectRevert(DossierShareLog.AlreadySharedToday.selector);
        log.intentToShare();
        vm.stopPrank();
    }

    // ─── Confirm ─────────────────────────────────────────────────────────────

    function test_confirmShare_withoutIntent_reverts() public {
        vm.prank(alice);
        vm.expectRevert(DossierShareLog.NoIntentForToday.selector);
        log.confirmShare(5, 100);
    }

    function test_confirmShare_afterIntent_succeeds() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmShare(5, 100);
        vm.stopPrank();

        assertEq(log.lastConfirmedDay(alice), block.timestamp / 1 days);
    }

    function test_confirmShare_sameDayTwice_reverts() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmShare(5, 100);

        vm.expectRevert(DossierShareLog.AlreadyConfirmedToday.selector);
        log.confirmShare(5, 100);
        vm.stopPrank();
    }

    // ─── hasSharedToday ──────────────────────────────────────────────────────

    function test_hasSharedToday_beforeConfirm_returnsFalse() public {
        assertFalse(log.hasSharedToday(alice));
    }

    function test_hasSharedToday_afterConfirm_returnsTrue() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmShare(5, 100);
        vm.stopPrank();

        assertTrue(log.hasSharedToday(alice));
    }

    // ─── Day bucket reset ────────────────────────────────────────────────────

    function test_dayBucket_resetsNextDay() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmShare(5, 100);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        assertFalse(log.hasSharedToday(alice));

        vm.prank(alice);
        log.intentToShare(); // must succeed again on the new day
        assertEq(log.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    // ─── Independent users ───────────────────────────────────────────────────

    function test_independentUsers_trackedSeparately() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmShare(5, 100);
        vm.stopPrank();

        assertTrue(log.hasSharedToday(alice));
        assertFalse(log.hasSharedToday(bob));
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    function test_intentToShare_emitsShareIntentLogged() public {
        vm.expectEmit(true, false, false, true);
        emit DossierShareLog.ShareIntentLogged(alice, block.timestamp / 1 days);

        vm.prank(alice);
        log.intentToShare();
    }

    function test_confirmShare_emitsShareConfirmed() public {
        vm.prank(alice);
        log.intentToShare();

        vm.expectEmit(true, false, false, true);
        emit DossierShareLog.ShareConfirmed(alice, block.timestamp / 1 days, 5, 100);

        vm.prank(alice);
        log.confirmShare(5, 100);
    }

    // ─── Upgrade authorization ───────────────────────────────────────────────

    function test_upgrade_nonOwner_reverts() public {
        DossierShareLog newImpl = new DossierShareLog();
        vm.prank(alice);
        vm.expectRevert();
        log.upgradeToAndCall(address(newImpl), "");
    }
}
```

- [ ] **Step 3: Run the tests**

Run (from the `contracts/` directory): `forge test --match-contract DossierShareLogTest -vvv`
Expected: all tests PASS (13 tests).

- [ ] **Step 4: Commit**

```bash
git add contracts/src/DossierShareLog.sol contracts/test/DossierShareLog.t.sol
git commit -m "feat(contracts): add DossierShareLog for verified-share EXP"
```

---

### Task 2: `ArenaBattleLog` contract + tests

**Files:**
- Create: `contracts/src/ArenaBattleLog.sol`
- Create: `contracts/test/ArenaBattleLog.t.sol`

**Interfaces:**
- Consumes: nothing from other tasks (independent of Task 1; identical shape, different confirm payload).
- Produces: `ArenaBattleLog` contract with `intentToShare()`, `confirmBattleShare(string playerName, string enemyName, bool won, uint16 hpPct)`, `hasSharedToday(address) view returns (bool)`, `pendingIntentDay(address)`, `lastConfirmedDay(address)`. Task 3 needs these exact names for the ABI file.

- [ ] **Step 1: Write the contract**

```solidity
// contracts/src/ArenaBattleLog.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ArenaBattleLog
 * @notice Verifies an Arena battle-result share actually completed before
 *         EXP is granted. Same two-transaction intent/confirm shape as
 *         DossierShareLog. Records real result fields (player, enemy,
 *         won/lost, HP% remaining) — cost-gated self-attestation, not
 *         cryptographic proof, since Arena has no trusted server resolver.
 *         Standalone contract — does not touch GunplaCard, GundaniumGame,
 *         DailyCheckIn, or DossierShareLog.
 */
contract ArenaBattleLog is OwnableUpgradeable, UUPSUpgradeable {
    // ─── Errors ─────────────────────────────────────────────────────────────

    error AlreadySharedToday();
    error NoIntentForToday();
    error AlreadyConfirmedToday();

    // ─── Events ─────────────────────────────────────────────────────────────

    event ShareIntentLogged(address indexed user, uint256 day);
    event BattleShareConfirmed(
        address indexed user,
        uint256 day,
        string playerName,
        string enemyName,
        bool won,
        uint16 hpPct
    );

    // ─── State ──────────────────────────────────────────────────────────────

    mapping(address => uint256) public pendingIntentDay;
    mapping(address => uint256) public lastConfirmedDay;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /// @notice Logs intent to share. Callable repeatedly the same day (covers
    ///         retry-after-cancel) as long as today isn't already confirmed.
    function intentToShare() external {
        uint256 today = block.timestamp / 1 days;
        if (lastConfirmedDay[msg.sender] == today) revert AlreadySharedToday();

        pendingIntentDay[msg.sender] = today;
        emit ShareIntentLogged(msg.sender, today);
    }

    /// @notice Confirms a battle-result share actually completed. Reverts
    ///         unless intent was logged today first, and unless today isn't
    ///         already confirmed.
    function confirmBattleShare(
        string calldata playerName,
        string calldata enemyName,
        bool won,
        uint16 hpPct
    ) external {
        uint256 today = block.timestamp / 1 days;
        if (pendingIntentDay[msg.sender] != today) revert NoIntentForToday();
        if (lastConfirmedDay[msg.sender] == today) revert AlreadyConfirmedToday();

        lastConfirmedDay[msg.sender] = today;
        emit BattleShareConfirmed(msg.sender, today, playerName, enemyName, won, hpPct);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function hasSharedToday(address user) external view returns (bool) {
        return lastConfirmedDay[user] == block.timestamp / 1 days;
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

- [ ] **Step 2: Write the test file**

```solidity
// contracts/test/ArenaBattleLog.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ArenaBattleLog} from "../src/ArenaBattleLog.sol";

contract ArenaBattleLogTest is Test {
    ArenaBattleLog log;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    function setUp() public {
        vm.warp(1_000_000 days);

        ArenaBattleLog impl = new ArenaBattleLog();
        bytes memory init = abi.encodeCall(ArenaBattleLog.initialize, (owner));
        log = ArenaBattleLog(address(new ERC1967Proxy(address(impl), init)));
    }

    // ─── Intent ──────────────────────────────────────────────────────────────

    function test_intentToShare_firstOfDay_succeeds() public {
        vm.prank(alice);
        log.intentToShare();

        assertEq(log.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    function test_intentToShare_sameDayTwice_succeedsIfNotYetConfirmed() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.intentToShare();
        vm.stopPrank();

        assertEq(log.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    function test_intentToShare_afterAlreadyConfirmedToday_reverts() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);

        vm.expectRevert(ArenaBattleLog.AlreadySharedToday.selector);
        log.intentToShare();
        vm.stopPrank();
    }

    // ─── Confirm ─────────────────────────────────────────────────────────────

    function test_confirmBattleShare_withoutIntent_reverts() public {
        vm.prank(alice);
        vm.expectRevert(ArenaBattleLog.NoIntentForToday.selector);
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
    }

    function test_confirmBattleShare_afterIntent_succeeds() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();

        assertEq(log.lastConfirmedDay(alice), block.timestamp / 1 days);
    }

    function test_confirmBattleShare_sameDayTwice_reverts() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);

        vm.expectRevert(ArenaBattleLog.AlreadyConfirmedToday.selector);
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();
    }

    function test_confirmBattleShare_recordsLossCorrectly() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmBattleShare("Alice", "Zeon Grunt", false, 0);
        vm.stopPrank();

        assertTrue(log.hasSharedToday(alice));
    }

    // ─── hasSharedToday ──────────────────────────────────────────────────────

    function test_hasSharedToday_beforeConfirm_returnsFalse() public {
        assertFalse(log.hasSharedToday(alice));
    }

    function test_hasSharedToday_afterConfirm_returnsTrue() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();

        assertTrue(log.hasSharedToday(alice));
    }

    // ─── Day bucket reset ────────────────────────────────────────────────────

    function test_dayBucket_resetsNextDay() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        assertFalse(log.hasSharedToday(alice));

        vm.prank(alice);
        log.intentToShare();
        assertEq(log.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    // ─── Independent users ───────────────────────────────────────────────────

    function test_independentUsers_trackedSeparately() public {
        vm.startPrank(alice);
        log.intentToShare();
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();

        assertTrue(log.hasSharedToday(alice));
        assertFalse(log.hasSharedToday(bob));
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    function test_intentToShare_emitsShareIntentLogged() public {
        vm.expectEmit(true, false, false, true);
        emit ArenaBattleLog.ShareIntentLogged(alice, block.timestamp / 1 days);

        vm.prank(alice);
        log.intentToShare();
    }

    function test_confirmBattleShare_emitsBattleShareConfirmed() public {
        vm.prank(alice);
        log.intentToShare();

        vm.expectEmit(true, false, false, true);
        emit ArenaBattleLog.BattleShareConfirmed(alice, block.timestamp / 1 days, "Alice", "Zeon Grunt", true, 87);

        vm.prank(alice);
        log.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
    }

    // ─── Upgrade authorization ───────────────────────────────────────────────

    function test_upgrade_nonOwner_reverts() public {
        ArenaBattleLog newImpl = new ArenaBattleLog();
        vm.prank(alice);
        vm.expectRevert();
        log.upgradeToAndCall(address(newImpl), "");
    }
}
```

- [ ] **Step 3: Run the tests**

Run (from the `contracts/` directory): `forge test --match-contract ArenaBattleLogTest -vvv`
Expected: all tests PASS (14 tests).

- [ ] **Step 4: Commit**

```bash
git add contracts/src/ArenaBattleLog.sol contracts/test/ArenaBattleLog.t.sol
git commit -m "feat(contracts): add ArenaBattleLog for verified-share EXP"
```

---

### Task 3: Deploy scripts, ABIs, and address slots

**Files:**
- Create: `contracts/script/DeployDossierShareLog.s.sol`
- Create: `contracts/script/DeployArenaBattleLog.s.sol`
- Create: `src/lib/contracts/abis/DossierShareLog.ts`
- Create: `src/lib/contracts/abis/ArenaBattleLog.ts`
- Modify: `src/lib/contracts/addresses.ts`

**Interfaces:**
- Consumes: `DossierShareLog`'s and `ArenaBattleLog`'s exact function/event/error names from Tasks 1 and 2.
- Produces: `DOSSIER_SHARE_LOG_ABI`, `ARENA_BATTLE_LOG_ABI` (both `as const` arrays), and two new keys on `CONTRACT_ADDRESSES`' record type — `dossierShareLog` and `arenaBattleLog` — that Task 5's hooks read via `getContracts(chainId)`.

- [ ] **Step 1: Write the DossierShareLog deploy script**

```solidity
// contracts/script/DeployDossierShareLog.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DossierShareLog} from "../src/DossierShareLog.sol";

/**
 * @notice Deploys DossierShareLog as a UUPS proxy. Standalone — does not
 *         touch GunplaCard, GundaniumGame, DailyCheckIn, or PrizePool.
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
 *     forge script script/DeployDossierShareLog.s.sol \
 *     --rpc-url https://sepolia.base.org --account deployer --broadcast --verify -vvvv
 *
 * After deploy: paste the logged proxy address into
 *   src/lib/contracts/addresses.ts  (dossierShareLog key, matching chain entry)
 * then redeploy the frontend.
 */
contract DeployDossierShareLog is Script {
    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");

        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        console.log("=== DossierShareLog Deploy ===");
        console.log("Owner: ", owner_);

        DossierShareLog impl = new DossierShareLog();
        bytes memory init = abi.encodeCall(DossierShareLog.initialize, (owner_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);

        vm.stopBroadcast();

        console.log("Implementation:    ", address(impl));
        console.log("Proxy (use this):  ", address(proxy));
        console.log("");
        console.log("Next step: add proxy address to src/lib/contracts/addresses.ts (dossierShareLog)");
    }
}
```

- [ ] **Step 2: Write the ArenaBattleLog deploy script**

```solidity
// contracts/script/DeployArenaBattleLog.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ArenaBattleLog} from "../src/ArenaBattleLog.sol";

/**
 * @notice Deploys ArenaBattleLog as a UUPS proxy. Standalone — does not
 *         touch GunplaCard, GundaniumGame, DailyCheckIn, or DossierShareLog.
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
 *     forge script script/DeployArenaBattleLog.s.sol \
 *     --rpc-url https://sepolia.base.org --account deployer --broadcast --verify -vvvv
 *
 * After deploy: paste the logged proxy address into
 *   src/lib/contracts/addresses.ts  (arenaBattleLog key, matching chain entry)
 * then redeploy the frontend.
 */
contract DeployArenaBattleLog is Script {
    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");

        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        console.log("=== ArenaBattleLog Deploy ===");
        console.log("Owner: ", owner_);

        ArenaBattleLog impl = new ArenaBattleLog();
        bytes memory init = abi.encodeCall(ArenaBattleLog.initialize, (owner_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);

        vm.stopBroadcast();

        console.log("Implementation:    ", address(impl));
        console.log("Proxy (use this):  ", address(proxy));
        console.log("");
        console.log("Next step: add proxy address to src/lib/contracts/addresses.ts (arenaBattleLog)");
    }
}
```

- [ ] **Step 3: Run `forge build` to confirm both scripts compile**

Run (from `contracts/`): `forge build`
Expected: `Compiler run successful` with no errors.

- [ ] **Step 4: Write the DossierShareLog ABI file**

```ts
// src/lib/contracts/abis/DossierShareLog.ts
export const DOSSIER_SHARE_LOG_ABI = [
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "intentToShare",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "confirmShare",
    inputs: [
      { name: "streak", type: "uint256" },
      { name: "exp", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "hasSharedToday",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "ShareIntentLogged",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ShareConfirmed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
      { name: "streak", type: "uint256", indexed: false },
      { name: "exp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },

  // ─── Errors ───────────────────────────────────────────────────────────────
  { type: "error", name: "AlreadySharedToday", inputs: [] },
  { type: "error", name: "NoIntentForToday", inputs: [] },
  { type: "error", name: "AlreadyConfirmedToday", inputs: [] },
] as const;
```

- [ ] **Step 5: Write the ArenaBattleLog ABI file**

```ts
// src/lib/contracts/abis/ArenaBattleLog.ts
export const ARENA_BATTLE_LOG_ABI = [
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "intentToShare",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "confirmBattleShare",
    inputs: [
      { name: "playerName", type: "string" },
      { name: "enemyName", type: "string" },
      { name: "won", type: "bool" },
      { name: "hpPct", type: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "hasSharedToday",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "ShareIntentLogged",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BattleShareConfirmed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
      { name: "playerName", type: "string", indexed: false },
      { name: "enemyName", type: "string", indexed: false },
      { name: "won", type: "bool", indexed: false },
      { name: "hpPct", type: "uint16", indexed: false },
    ],
    anonymous: false,
  },

  // ─── Errors ───────────────────────────────────────────────────────────────
  { type: "error", name: "AlreadySharedToday", inputs: [] },
  { type: "error", name: "NoIntentForToday", inputs: [] },
  { type: "error", name: "AlreadyConfirmedToday", inputs: [] },
] as const;
```

- [ ] **Step 6: Add the two new address slots**

In `src/lib/contracts/addresses.ts`, update the `CONTRACT_ADDRESSES` type and both chain entries:

```ts
// src/lib/contracts/addresses.ts
// Contract addresses by chainId
// Fill in after deploying with Foundry

export const CONTRACT_ADDRESSES: Record<
  number,
  {
    gunplaCard: `0x${string}`;
    gundaniumGame: `0x${string}`;
    prizePool: `0x${string}`;
    migration: `0x${string}`;
    dailyCheckIn: `0x${string}`;
    dossierShareLog: `0x${string}`;
    arenaBattleLog: `0x${string}`;
  }
> = {
  // Base Sepolia (testnet)
  84532: {
    gunplaCard: "0x7475CeA2680ddaF22B914F45290e22a75e29fF4c",
    gundaniumGame: "0x310767a15fD906C3F702d54B565904dE6Aca6be7",
    prizePool: "0xa5670c2dD9916BE1DB9974977844228Cfc3bA731",
    migration: "0x0000000000000000000000000000000000000000",
    dailyCheckIn: "0x4a444d13Cb7f23E7F91C88BE5F858DCDe8706a67",
    dossierShareLog: "0x0000000000000000000000000000000000000000",
    arenaBattleLog: "0x0000000000000000000000000000000000000000",
  },
  // Base mainnet
  8453: {
    gunplaCard: "0xA7bc3d31A4863b33854F2d73C77BAf31c4f27a6C",
    gundaniumGame: "0x0000000000000000000000000000000000000000",
    prizePool: "0x0000000000000000000000000000000000000000",
    migration: "0x8CCbd8EEA766d564fC0AD09D2cB99e4cD4107230",
    dailyCheckIn: "0xCA600477594Ddc414210204af03c6DF37e05d9D8",
    dossierShareLog: "0x0000000000000000000000000000000000000000",
    arenaBattleLog: "0x0000000000000000000000000000000000000000",
  },
};

export function getContracts(chainId: number) {
  const addrs = CONTRACT_ADDRESSES[chainId];
  if (!addrs) throw new Error(`No contracts deployed for chainId ${chainId}`);
  return addrs;
}

export function isPlaceholder(address: `0x${string}`) {
  return address === "0x0000000000000000000000000000000000000000";
}
```

- [ ] **Step 7: Verify the frontend still typechecks**

Run (from repo root): `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean) — the two new keys are additive to the type, nothing existing references them yet.

- [ ] **Step 8: Commit**

```bash
git add contracts/script/DeployDossierShareLog.s.sol contracts/script/DeployArenaBattleLog.s.sol \
        src/lib/contracts/abis/DossierShareLog.ts src/lib/contracts/abis/ArenaBattleLog.ts \
        src/lib/contracts/addresses.ts
git commit -m "feat(contracts): deploy scripts, ABIs, and address slots for verified-share logs"
```

**Note for Joshua (not part of this task's execution):** once this task is merged, deploy both contracts yourself the same way `DailyCheckIn` was deployed — `forge script script/DeployDossierShareLog.s.sol --account deployer --broadcast --verify` and the same for `DeployArenaBattleLog.s.sol`, on whichever chain you're testing on first (Sepolia, then mainnet), then paste the real proxy addresses into `addresses.ts` in place of the placeholder zero-addresses. Until that happens, `isPlaceholder()` keeps the verified-share flow inert (Tasks 5-8 all check this), so there's no rush and no risk in merging Tasks 4-8 before you deploy.

---

### Task 4: Extract `guardedWrite` into a shared helper

**Files:**
- Create: `src/lib/contracts/guardedWrite.ts`
- Modify: `src/lib/contracts/hooks/useMint.ts`

**Interfaces:**
- Consumes: nothing new — this is a pure refactor of existing, already-live code.
- Produces: `createGuardedWrite(account, chainId, writeContractAsync)` — a factory function Task 5's `useVerifiedShare` hook will import and call the same way `useMint.ts` does after this task.

`useMint.ts`'s `guardedWrite` (re-checks the connector's live chain ID, races `writeContractAsync` against a 20s timeout) is currently defined inline, closing over that hook's own `account`/`chainId`/`writeContractAsync`. Task 5 needs the exact same pattern for two more contracts. Extracting it once now avoids a second copy-pasted implementation of the Farcaster-bridge-safety logic.

- [ ] **Step 1: Read the current `useMint.ts` to confirm the exact block being moved**

Run: `sed -n '1,20p;108,135p' src/lib/contracts/hooks/useMint.ts`
Expected: shows the current imports and the inline `withTimeout`/`WALLET_REQUEST_TIMEOUT_MS`/`WALLET_TIMEOUT_MESSAGE`/`guardedWrite` block — confirms nothing has drifted since this plan was written.

- [ ] **Step 2: Create the shared helper**

```ts
// src/lib/contracts/guardedWrite.ts
"use client";

import type { useAccount, useWriteContract } from "wagmi";

// Some wallet bridges (notably Farcaster's, which hands off to whichever
// wallet is behind it) can silently fail to complete a chain switch and then
// never surface a signature prompt at all — see feedback_farcaster_chain_switch.
// Without a timeout, writeContractAsync just hangs forever with no error.
const WALLET_REQUEST_TIMEOUT_MS = 20_000;
const WALLET_TIMEOUT_MESSAGE =
  "Wallet didn't respond in time. This can happen when a wallet bridge (e.g. Farcaster's) loses sync with the connected network — try reconnecting your wallet or reopening the app.";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Wraps writeContractAsync with two safety nets proven necessary by real
 * Farcaster wallet-bridge failures: re-checks the connector's own live chain
 * ID right before sending (wagmi's reactive chainId can go stale if a bridge
 * silently fails to actually switch), then races the request against a hard
 * timeout instead of letting it hang forever.
 */
export function createGuardedWrite(
  account: ReturnType<typeof useAccount>,
  chainId: number,
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"]
) {
  return async (params: Parameters<typeof writeContractAsync>[0]) => {
    if (account.connector?.getChainId) {
      const liveChainId = await account.connector.getChainId().catch(() => chainId);
      if (liveChainId !== chainId) {
        throw new Error(
          `Wallet reports it's on chain ${liveChainId}, but this needs chain ${chainId}. Try reconnecting your wallet.`
        );
      }
    }
    return withTimeout(
      writeContractAsync(params),
      WALLET_REQUEST_TIMEOUT_MS,
      WALLET_TIMEOUT_MESSAGE
    );
  };
}
```

- [ ] **Step 3: Update `useMint.ts` to use the shared helper**

Remove these from `src/lib/contracts/hooks/useMint.ts`: the `withTimeout` function, the `WALLET_REQUEST_TIMEOUT_MS`/`WALLET_TIMEOUT_MESSAGE` constants, and the inline `guardedWrite` definition (the comment block right above it can move with it or be dropped — the shared file now carries the explanation). Add the import and replace the definition:

```ts
// near the other imports at the top of useMint.ts
import { createGuardedWrite } from "@/lib/contracts/guardedWrite";
```

```ts
// replacing the old inline "const guardedWrite = async (...) => {...}" block,
// right after "const account = useAccount();"
const guardedWrite = createGuardedWrite(account, chainId, writeContractAsync);
```

Everything else in `useMint.ts` (`approveMint`, `executeMint`, `executeWhitelistMint`, `executeAutoVipMint`, all of which call `guardedWrite({...})`) stays completely unchanged — same call sites, same behavior.

- [ ] **Step 4: Verify nothing broke**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

Run: `npx eslint src/lib/contracts/hooks/useMint.ts src/lib/contracts/guardedWrite.ts`
Expected: no new errors (this file has no pre-existing lint issues today, so expect a clean pass).

Run: `npm run build`
Expected: build succeeds, `/mint` page compiles.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/guardedWrite.ts src/lib/contracts/hooks/useMint.ts
git commit -m "refactor(contracts): extract guardedWrite into a shared helper"
```

---

### Task 5: `useVerifiedShare` hook + Dossier/Arena wrappers

**Files:**
- Create: `src/lib/contracts/hooks/useVerifiedShare.ts`
- Create: `src/lib/contracts/hooks/useDossierShareVerification.ts`
- Create: `src/lib/contracts/hooks/useArenaBattleShareVerification.ts`

**Interfaces:**
- Consumes: `createGuardedWrite` from Task 4 (`src/lib/contracts/guardedWrite.ts`); `DOSSIER_SHARE_LOG_ABI`/`ARENA_BATTLE_LOG_ABI` and the `dossierShareLog`/`arenaBattleLog` address keys from Task 3.
- Produces: `useVerifiedShare(config)` returning `{ phase: VerifiedSharePhase, error: string | null, hasSharedToday: boolean, canRetryConfirm: boolean, verifiedShare: (composeCastFn) => Promise<boolean>, retryConfirm: () => Promise<boolean> }`. `useDossierShareVerification({ streak, exp })` and `useArenaBattleShareVerification({ playerName, enemyName, won, hpPct })` — both return exactly that same shape. Task 6 (`ShareButtons`) consumes this exact shape as its new `verified` prop.

- [ ] **Step 1: Write the shared hook**

```ts
// src/lib/contracts/hooks/useVerifiedShare.ts
"use client";

import { useRef, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import type { Abi } from "viem";
import { createGuardedWrite } from "@/lib/contracts/guardedWrite";

export type VerifiedSharePhase =
  | "idle"
  | "intent-pending"
  | "awaiting-share"
  | "confirm-pending"
  | "done"
  | "cancelled"
  | "error";

function mapError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Share verification failed";
  if (msg.includes("User rejected")) return "Signature cancelled";
  if (msg.includes("AlreadySharedToday") || msg.includes("AlreadyConfirmedToday")) {
    return "Already shared today";
  }
  if (msg.includes("NoIntentForToday")) {
    return "Share session expired — click Share again to restart";
  }
  return msg;
}

/**
 * Drives the two-transaction intent/confirm flow shared by DossierShareLog
 * and ArenaBattleLog: intentToShare() fires before the compose dialog opens,
 * the confirm transaction only fires after a real (non-null) cast result.
 * Reuses guardedWrite() for both transactions — same chain-recheck and
 * 20s-timeout safety net proven necessary for Farcaster's wallet bridge.
 */
export function useVerifiedShare(config: {
  contractAddress: `0x${string}` | undefined;
  abi: Abi;
  confirmFunctionName: string;
  buildConfirmArgs: () => readonly unknown[];
}) {
  const { contractAddress, abi, confirmFunctionName, buildConfirmArgs } = config;
  const [phase, setPhase] = useState<VerifiedSharePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastConfirmArgsRef = useRef<readonly unknown[] | null>(null);

  const account = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const guardedWrite = createGuardedWrite(account, chainId, writeContractAsync);

  const { data: hasSharedTodayData, refetch: refetchHasSharedToday } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "hasSharedToday",
    args: account.address ? [account.address] : undefined,
    query: { enabled: !!contractAddress && !!account.address },
  });
  const hasSharedToday = !!hasSharedTodayData;

  const verifiedShare = async (
    composeCastFn: () => Promise<{ cast: unknown } | null>
  ): Promise<boolean> => {
    if (!contractAddress || !publicClient) return false;
    if (hasSharedToday) {
      setPhase("done");
      return false;
    }
    setError(null);
    try {
      setPhase("intent-pending");
      const intentHash = await guardedWrite({
        address: contractAddress,
        abi,
        functionName: "intentToShare",
        args: [],
      });
      await publicClient.waitForTransactionReceipt({ hash: intentHash });

      setPhase("awaiting-share");
      const result = await composeCastFn();
      if (!result?.cast) {
        setPhase("cancelled");
        return false;
      }

      const confirmArgs = buildConfirmArgs();
      lastConfirmArgsRef.current = confirmArgs;
      setPhase("confirm-pending");
      const confirmHash = await guardedWrite({
        address: contractAddress,
        abi,
        functionName: confirmFunctionName,
        args: confirmArgs,
      });
      await publicClient.waitForTransactionReceipt({ hash: confirmHash });

      setPhase("done");
      refetchHasSharedToday();
      return true;
    } catch (e) {
      setError(mapError(e));
      setPhase("error");
      return false;
    }
  };

  const retryConfirm = async (): Promise<boolean> => {
    if (!contractAddress || !publicClient || !lastConfirmArgsRef.current) return false;
    setError(null);
    try {
      setPhase("confirm-pending");
      const confirmHash = await guardedWrite({
        address: contractAddress,
        abi,
        functionName: confirmFunctionName,
        args: lastConfirmArgsRef.current,
      });
      await publicClient.waitForTransactionReceipt({ hash: confirmHash });
      setPhase("done");
      refetchHasSharedToday();
      return true;
    } catch (e) {
      setError(mapError(e));
      setPhase("error");
      return false;
    }
  };

  return {
    phase,
    error,
    hasSharedToday,
    canRetryConfirm: lastConfirmArgsRef.current !== null,
    verifiedShare,
    retryConfirm,
  };
}
```

- [ ] **Step 2: Write the Dossier wrapper**

```ts
// src/lib/contracts/hooks/useDossierShareVerification.ts
"use client";

import { useChainId } from "wagmi";
import { DOSSIER_SHARE_LOG_ABI } from "@/lib/contracts/abis/DossierShareLog";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { useVerifiedShare } from "@/lib/contracts/hooks/useVerifiedShare";

export function useDossierShareVerification({ streak, exp }: { streak: number; exp: number }) {
  const chainId = useChainId();

  let contractAddress: `0x${string}` | undefined;
  try {
    const contracts = getContracts(chainId);
    contractAddress = isPlaceholder(contracts.dossierShareLog) ? undefined : contracts.dossierShareLog;
  } catch {
    contractAddress = undefined;
  }

  return useVerifiedShare({
    contractAddress,
    abi: DOSSIER_SHARE_LOG_ABI,
    confirmFunctionName: "confirmShare",
    buildConfirmArgs: () => [BigInt(streak), BigInt(exp)] as const,
  });
}
```

- [ ] **Step 3: Write the Arena wrapper**

```ts
// src/lib/contracts/hooks/useArenaBattleShareVerification.ts
"use client";

import { useChainId } from "wagmi";
import { ARENA_BATTLE_LOG_ABI } from "@/lib/contracts/abis/ArenaBattleLog";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { useVerifiedShare } from "@/lib/contracts/hooks/useVerifiedShare";

export function useArenaBattleShareVerification({
  playerName,
  enemyName,
  won,
  hpPct,
}: {
  playerName: string;
  enemyName: string;
  won: boolean;
  hpPct: number;
}) {
  const chainId = useChainId();

  let contractAddress: `0x${string}` | undefined;
  try {
    const contracts = getContracts(chainId);
    contractAddress = isPlaceholder(contracts.arenaBattleLog) ? undefined : contracts.arenaBattleLog;
  } catch {
    contractAddress = undefined;
  }

  return useVerifiedShare({
    contractAddress,
    abi: ARENA_BATTLE_LOG_ABI,
    confirmFunctionName: "confirmBattleShare",
    buildConfirmArgs: () => [playerName, enemyName, won, Math.round(hpPct)] as const,
  });
}
```

- [ ] **Step 4: Verify it typechecks and lints**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

Run: `npx eslint src/lib/contracts/hooks/useVerifiedShare.ts src/lib/contracts/hooks/useDossierShareVerification.ts src/lib/contracts/hooks/useArenaBattleShareVerification.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/hooks/useVerifiedShare.ts \
        src/lib/contracts/hooks/useDossierShareVerification.ts \
        src/lib/contracts/hooks/useArenaBattleShareVerification.ts
git commit -m "feat(hooks): add useVerifiedShare and Dossier/Arena wrapper hooks"
```

---

### Task 6: `ShareButtons` verified mode

**Files:**
- Modify: `src/components/ui/ShareButtons.tsx`

**Interfaces:**
- Consumes: the exact return shape of `useVerifiedShare` from Task 5 — `{ phase: VerifiedSharePhase, hasSharedToday, canRetryConfirm, verifiedShare, retryConfirm }` — passed in as the new `verified` prop.
- Produces: `ShareButtonsProps.verified?: ReturnType<typeof useVerifiedShare>` (the hook's full return type — `phase`, `error`, `hasSharedToday`, `canRetryConfirm`, `verifiedShare`, `retryConfirm` — referenced by type, not re-typed by hand, so this can't drift out of sync). Task 7 and Task 8 both pass this prop.

- [ ] **Step 1: Add the `verified` prop and phase-to-label mapping**

In `src/components/ui/ShareButtons.tsx`, add the import and extend the props interface:

```ts
import type { VerifiedSharePhase, useVerifiedShare } from "@/lib/contracts/hooks/useVerifiedShare";
```

```ts
interface ShareButtonsProps {
  card?: {
    name: string;
    rarity: Rarity;
    tokenId: bigint | null;
  };
  battle?: {
    playerName: string;
    enemyName: string;
    hpPct: number;
    won: boolean;
  };
  dossier?: {
    address: `0x${string}`;
    streak: number;
    exp: number;
  };
  onShare?: () => void;
  /** Opt-in verified flow — only ever passed from EXP-earning task rows. */
  verified?: ReturnType<typeof useVerifiedShare>;
}

function verifiedButtonLabel(phase: VerifiedSharePhase, canRetryConfirm: boolean): string {
  switch (phase) {
    case "intent-pending":
      return "Confirming Share Intent...";
    case "awaiting-share":
      return "Opening Farcaster...";
    case "confirm-pending":
      return "Confirming On-Chain...";
    case "done":
      return "Shared!";
    case "error":
      return canRetryConfirm ? "Retry Confirm" : "Farcaster";
    default:
      return "Farcaster";
  }
}
```

- [ ] **Step 2: Wire `verified` into the component body and render branch**

Update the function signature and add the verified click handler, right after the existing `shareOnFarcaster` callback:

```ts
export function ShareButtons({ card, battle, dossier, onShare, verified }: ShareButtonsProps = {}) {
  // ...existing isFarcaster/farcasterUsername/text/embedUrl/useEffect unchanged...

  const shareOnFarcaster = useCallback(async () => {
    // ...existing body unchanged, still used when verified is not passed...
  }, [isFarcaster, text, embedUrl, onShare]);

  const verifiedShareOnFarcaster = useCallback(async () => {
    if (!verified) return;
    if (verified.phase === "error" && verified.canRetryConfirm) {
      await verified.retryConfirm();
      return;
    }
    await verified.verifiedShare(async () => {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      return sdk.actions.composeCast({ text: `${text}\n\n`, embeds: [embedUrl] });
    });
  }, [verified, text, embedUrl]);
```

Replace the returned JSX's opening (everything up to the closing `</div>`) with a branch on `verified`:

```tsx
  if (verified) {
    if (verified.hasSharedToday) {
      return (
        <div className="flex items-center justify-center">
          <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-widest text-[var(--accent)] uppercase">
            Already Shared Today
          </span>
        </div>
      );
    }
    if (!isFarcaster) {
      return (
        <div className="flex items-center justify-center">
          <button
            disabled
            title="Open in Farcaster to earn EXP for this"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--foreground)]/40 cursor-not-allowed"
          >
            Open in Farcaster to earn EXP for this
          </button>
        </div>
      );
    }
    const busy = verified.phase !== "idle" && verified.phase !== "error" && verified.phase !== "cancelled";
    return (
      <div className="flex items-center justify-center">
        <button
          onClick={verifiedShareOnFarcaster}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-400 transition-all hover:bg-purple-500/20 hover:border-purple-500/50 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.24 1.2H5.76A4.56 4.56 0 001.2 5.76v12.48a4.56 4.56 0 004.56 4.56h12.48a4.56 4.56 0 004.56-4.56V5.76a4.56 4.56 0 00-4.56-4.56zm.72 16.08h-.96l-.24-3.36h-.01c-.48 1.92-1.68 3.6-3.84 3.6-2.04 0-3.36-1.56-3.36-3.84 0-3.24 2.16-6.48 5.52-6.48.84 0 1.56.12 2.04.36l-.6 2.64c-.36-.12-.72-.24-1.2-.24-1.8 0-3.12 2.04-3.12 3.96 0 1.08.48 1.8 1.32 1.8 1.08 0 2.04-1.32 2.28-2.76l.48-2.52h-1.8l.36-1.68h4.68l-1.44 8.52z" /></svg>
          {verifiedButtonLabel(verified.phase, verified.canRetryConfirm)}
        </button>
        {verified.error && <p className="ml-2 text-[10px] text-red-400">{verified.error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {/* ...existing four-button JSX, completely unchanged... */}
    </div>
  );
}
```

The existing `shareOnFarcaster`/`shareOnX`/`shareOnFacebook`/`shareGeneric` callbacks and the four-button JSX block stay byte-for-byte as they are today — this only adds an early-return branch above them.

- [ ] **Step 3: Verify it typechecks, lints, and builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

Run: `npx eslint src/components/ui/ShareButtons.tsx`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ShareButtons.tsx
git commit -m "feat(share): add verified on-chain share mode to ShareButtons"
```

---

### Task 7: Dossier retrofit — `/tasks` row + Dossier page

**Files:**
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/app/dossier/[address]/DossierClient.tsx`
- Delete: `src/lib/dossierShareTask.ts`

**Interfaces:**
- Consumes: `useDossierShareVerification` from Task 5; `ShareButtons`' `verified` prop from Task 6.
- Produces: `dossierShared` (in `tasks/page.tsx`'s `exp` formula) now sourced from `useDossierShareVerification(...).hasSharedToday` instead of localStorage — no new export other tasks depend on.

- [ ] **Step 1: Update `tasks/page.tsx` — replace the localStorage hook with the verified hook**

Remove the `useDossierShareTaskDone` function (lines 55-69) and its import of `isDossierSharedToday`/`markDossierSharedToday`:

```ts
// remove this import line:
import { isDossierSharedToday, markDossierSharedToday } from "@/lib/dossierShareTask";
```

Add the new import:

```ts
import { useDossierShareVerification } from "@/lib/contracts/hooks/useDossierShareVerification";
```

**Watch out for a circular dependency here:** `exp` currently includes `(dossierShared ? 8 : 0)`, but `useDossierShareVerification` needs an `exp` value to pass into its eventual `confirmShare(streak, exp)` call — `exp` can't depend on `dossierShared` while `dossierShared`'s hook call also depends on `exp`. Fix this by splitting `exp` into a `preShareExp` (everything except the two share bonuses) computed first, then deriving the final `exp` after the hooks run.

First, delete the line `const [dossierShared, markDossierShared] = useDossierShareTaskDone();` entirely from where it sits today (right after `const [formDone, markFormDone] = useFormTaskDone();`) — don't leave it in place.

Then, at the *original* location of the `const exp = ...` block (right after `const countdown = useCountdownToNextUtcDay(checkedInToday);`), delete that whole block and replace it with:

```ts
  const preShareExp =
    currentStreak * 10 +
    totalCheckIns * 5 +
    mintedCount * 25 +
    (stakedToday ? 50 : 0) +
    (gnrmVerified ? 12 : 0) +
    (formDone ? 15 : 0) +
    (perfectWeek ? 200 : 0);

  const dossierShareVerification = useDossierShareVerification({ streak: currentStreak, exp: preShareExp });
  const dossierShared = dossierShareVerification.hasSharedToday;

  const exp = preShareExp + (dossierShared ? 8 : 0);
```

(Task 8 will extend this same `preShareExp`/`exp` pair to add the Arena battle-share bonus — don't reintroduce the flat single-formula shape.)

Update the `DossierTaskRow` call site to pass the verification object instead of `onShare`:

```tsx
          <DossierTaskRow
            address={address}
            streak={currentStreak}
            exp={exp}
            done={dossierShared}
            verification={dossierShareVerification}
          />
```

- [ ] **Step 2: Update the `DossierTaskRow` component**

Replace its props and body:

```tsx
function DossierTaskRow({
  address,
  streak,
  exp,
  done,
  verification,
}: {
  address: `0x${string}` | undefined;
  streak: number;
  exp: number;
  done: boolean;
  verification: ReturnType<typeof useDossierShareVerification>;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <div className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-white">Share Your Dossier</div>
        <div className="font-mono text-[10px] text-[var(--accent)]">+8 EXP</div>
      </div>
      {done ? (
        <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-widest text-[var(--accent)] uppercase">
          Done
        </span>
      ) : (
        address && <ShareButtons dossier={{ address, streak, exp }} verified={verification} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `DossierClient.tsx`**

Remove the import:

```ts
// remove:
import { markDossierSharedToday } from "@/lib/dossierShareTask";
```

Add:

```ts
import { useDossierShareVerification } from "@/lib/contracts/hooks/useDossierShareVerification";
```

Inside `DossierClient`, add the hook call (needs `stats.currentStreak` and `exp`, both already in scope by the point `ShareButtons` renders — add it near the top of the component body alongside the other hooks):

```ts
  const dossierShareVerification = useDossierShareVerification({ streak: stats.currentStreak, exp });
```

Replace the `ShareButtons` usage:

```tsx
      {isOwner && !editing && (
        <ShareButtons
          dossier={{ address, streak: stats.currentStreak, exp }}
          verified={dossierShareVerification}
        />
      )}
```

- [ ] **Step 4: Delete the superseded localStorage helper**

```bash
rm src/lib/dossierShareTask.ts
```

- [ ] **Step 5: Verify it typechecks, lints, and builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean) — confirms nothing else in the codebase still imports the deleted `dossierShareTask.ts`.

Run: `npx eslint src/app/tasks/page.tsx "src/app/dossier/[address]/DossierClient.tsx"`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds, `/tasks` and `/dossier/[address]` compile.

- [ ] **Step 6: Commit**

```bash
git add src/app/tasks/page.tsx "src/app/dossier/[address]/DossierClient.tsx"
git rm src/lib/dossierShareTask.ts
git commit -m "feat(tasks): wire Dossier share to on-chain verification, drop localStorage flag"
```

---

### Task 8: Arena battle-share row + battle-result screen

**Files:**
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/app/arena/page.tsx`

**Interfaces:**
- Consumes: `useArenaBattleShareVerification` from Task 5; `ShareButtons`' `verified` prop from Task 6.
- Produces: `arenaBattleShared` term added to `tasks/page.tsx`'s `exp` formula. No other task depends on this task's output.

**Important scope note:** unlike every other row on `/tasks`, this one has no button of its own — there's no live battle result available on the `/tasks` page to share. It only reads `hasSharedToday` from `ArenaBattleLog` directly (via a lightweight on-chain read, not the full `useVerifiedShare` hook, since this row never calls `verifiedShare()` itself).

- [ ] **Step 1: Add a read-only status hook for the Arena row**

Add this to `src/lib/contracts/hooks/useArenaBattleShareVerification.ts`, right after the existing `useArenaBattleShareVerification` export (same file — it's a small, closely related read-only sibling, not worth a new file):

```ts
import { useAccount, useChainId, useReadContract } from "wagmi";
import { ARENA_BATTLE_LOG_ABI } from "@/lib/contracts/abis/ArenaBattleLog";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";

/** Read-only status for the /tasks Arena row — no button lives there. */
export function useArenaBattleShareStatus() {
  const chainId = useChainId();
  const { address } = useAccount();

  let contractAddress: `0x${string}` | undefined;
  try {
    const contracts = getContracts(chainId);
    contractAddress = isPlaceholder(contracts.arenaBattleLog) ? undefined : contracts.arenaBattleLog;
  } catch {
    contractAddress = undefined;
  }

  const { data } = useReadContract({
    address: contractAddress,
    abi: ARENA_BATTLE_LOG_ABI,
    functionName: "hasSharedToday",
    args: address ? [address] : undefined,
    query: { enabled: !!contractAddress && !!address },
  });

  return !!data;
}
```

(The `useAccount`/`useChainId`/`useReadContract` import at the top of this file already exists via the earlier `useChainId` import from Step 3 of Task 5 — extend that existing wagmi import line to include `useAccount` and `useReadContract` rather than adding a second import line.)

- [ ] **Step 2: Add the new row to `tasks/page.tsx`**

Add the import:

```ts
import { useArenaBattleShareStatus } from "@/lib/contracts/hooks/useArenaBattleShareVerification";
```

Add the hook call and extend the `preShareExp`/`exp` pair Task 7 introduced (replace Task 7's `const exp = preShareExp + (dossierShared ? 8 : 0);` line — `preShareExp` itself is untouched, since Arena's bonus doesn't create the same circularity `useArenaBattleShareStatus` is a read-only status check, not something that needs `exp` passed into it):

```ts
  const arenaBattleShared = useArenaBattleShareStatus();
  const exp = preShareExp + (dossierShared ? 8 : 0) + (arenaBattleShared ? 8 : 0);
```

Add the new row after `DossierTaskRow` in the JSX:

```tsx
          <TaskRow
            title="Share an Arena Battle"
            subtitle="Play a battle and share the result to earn this"
            expLabel="+8 EXP"
            done={arenaBattleShared}
          />
```

(`TaskRow` already supports a done-only, buttonless state — passing no `onAction`/`linkHref` renders neither, matching this row's status-only nature. Confirm this by re-reading `TaskRow`'s render branches: `done && countdown` → countdown pill, `done` → Done pill, `linkHref` → link button, else → action button. With no `linkHref`/`onAction` and `done: false`, it falls to the final `<button onClick={undefined} disabled={undefined}>{undefined}</button>` branch, which would render an empty enabled button — **not acceptable**. Add an explicit `placeholder` case instead: pass `subtitle` and leave `actionLabel` unset, but add a fifth branch to `TaskRow` for "no action available, not done" reusing the existing `placeholder` styling minus the "Coming Soon" text.)

Update `TaskRow` to add this real branch (it currently only has `placeholder`, `done`, `linkHref`, and default-button branches):

```tsx
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
          rel={linkHref.startsWith("http") ? "noopener noreferrer" : undefined}
          onClick={onLinkClick}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-wider text-black transition-all hover:scale-105"
        >
          {linkLabel}
        </Link>
      ) : onAction ? (
        <button
          onClick={onAction}
          disabled={disabled}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-wider text-black transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {actionLabel}
        </button>
      ) : null}
```

(Only change: the final unconditional `<button>` branch becomes `onAction ? <button>...</button> : null` — a row with no `onAction`, no `linkHref`, and `done: false` now correctly renders nothing on the right side instead of a broken empty button. Every existing row already passes `onAction`, so this is not a behavior change for any of them.)

- [ ] **Step 3: Wire the verified flow into Arena's battle-result share button**

In `src/app/arena/page.tsx`, add the import:

```ts
import { useArenaBattleShareVerification } from "@/lib/contracts/hooks/useArenaBattleShareVerification";
```

Inside the `BattleOutcome` component, add the hook call and pass it to `ShareButtons`:

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
  const battleShareVerification = useArenaBattleShareVerification({
    playerName,
    enemyName,
    won: playerWon,
    hpPct: playerHpPct,
  });
  return (
    <div className="text-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 md:p-10">
      {/* ...existing Victory/Defeat heading, message, and buttons unchanged... */}
      <div className="mt-4">
        <ShareButtons
          battle={{ playerName, enemyName, hpPct: playerHpPct, won: playerWon }}
          verified={battleShareVerification}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it typechecks, lints, and builds**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

Run: `npx eslint src/app/tasks/page.tsx src/app/arena/page.tsx src/lib/contracts/hooks/useArenaBattleShareVerification.ts`
Expected: no new errors.

Run: `npm run build`
Expected: build succeeds, `/tasks` and `/arena` compile.

- [ ] **Step 5: Manual live-browser verification (no test framework for the frontend)**

With both contracts deployed and their addresses filled into `addresses.ts` (Joshua's manual step from Task 3), walk through, on Base mainnet, inside a real Farcaster client:
- Dossier: full happy path (Share → intent confirms → compose opens → post a real cast → confirm lands → row flips to Done, EXP updates by +8).
- Dossier: cancel at the compose dialog — confirm never fires, row stays not-done, gas from intent alone was spent.
- Arena: finish a battle (win or loss), share from the battle-result screen, confirm the `/tasks` "Share an Arena Battle" row flips to Done afterward (reload `/tasks` to confirm the on-chain read reflects it).
- Outside Farcaster (plain browser tab, and inside Base App): confirm the disabled "Open in Farcaster to earn EXP for this" state renders on both the Dossier and Arena share buttons, with no attempt to call `composeCast`.
- Reload `/tasks` and `/dossier/[address]` after a confirmed share on either feature: both surfaces show Done from the live on-chain read, with no reliance on browser storage.

- [ ] **Step 6: Commit**

```bash
git add src/app/tasks/page.tsx src/app/arena/page.tsx src/lib/contracts/hooks/useArenaBattleShareVerification.ts
git commit -m "feat(arena): add verified battle-share EXP row and wire battle-result screen"
```
