# GUNR Staking V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a fresh `GUNRStaking` UUPS contract for $GUNR token staking, with a Streme-style 24-hour lock, transferable `stGUNR` receipt token, Synthetix `rewardPerToken` accounting, and an admin + authorized-game-fee funding model. Replace the existing `GNDMStaking` proxy (zero stake, GNDM-bound) on mainnet. Replace the stake page placeholder with a full stake/unstake/claim UI.

**Architecture:** Single UUPS upgradeable Solidity contract. The contract IS the `stGUNR` ERC-20 token (inherits ERC20Upgradeable). Stake action mints `stGUNR` and sets a per-account 24-hour lock; transfers move earning rights but not lock state; unstake burns `stGUNR` and returns GUNR; claim sends accrued GUNR rewards. Reward stream funded by owner deposits and authorized game contracts. Frontend uses 1-second `useReadContract` polling on `earned(user)` for smoothly-ticking display.

**Tech Stack:** Solidity 0.8.24, OpenZeppelin Upgradeable v5 (ERC20Upgradeable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable, ERC1967Proxy), Foundry (forge + cast), Next.js 16 App Router, wagmi v3, viem v2, Vercel.

**Spec:** `docs/superpowers/specs/2026-05-30-gunr-staking-v2-design.md`

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `contracts/src/GUNRStaking.sol` | Create | The contract: stake/unstake/claim + Synthetix accounting + transferable stGUNR + admin |
| `contracts/test/GUNRStaking.t.sol` | Create | Foundry test suite, ~32 tests |
| `contracts/script/DeployGUNRStaking.s.sol` | Create | Reference deploy script (not used for live deploys; live deploys use two `forge create` calls per [[feedback_eip7702_deploy]]) |
| `src/lib/contracts/abis/GUNRStaking.ts` | Create | TypeScript ABI for the frontend |
| `src/lib/contracts/abis/GNDMStaking.ts` | Delete if exists, unused | Old ABI cleanup |
| `src/app/stake/page.tsx` | Replace | Full stake/unstake/claim UI; replaces existing ComingSoon |
| `src/lib/contracts/addresses.ts` | Modify | Update `gunrStaking` field for both Sepolia and mainnet at the appropriate deploy phases |

The existing `GNDMStaking.sol` and `GNDMStaking.t.sol` stay in the repo as historical reference. The existing `DeployStaking.s.sol` stays as well (different contract, different deploy script).

---

## Phase A — Contract + Tests (local Foundry)

### Task 1: Create GUNRStaking.sol

**Files:**
- Create: `contracts/src/GUNRStaking.sol`

- [ ] **Step 1: Create the contract file**

Create `/Users/joshuagrubbs/Larry/GundariuM/contracts/src/GUNRStaking.sol` with EXACTLY this content:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title GUNRStaking
/// @notice Stake GUNR to receive transferable stGUNR receipt tokens and earn streaming GUNR rewards.
///         Synthetix-style rewardPerToken accounting. Per-account 24-hour lock from each stake.
contract GUNRStaking is
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ─── Errors ─────────────────────────────────────────────────────────

    error StillLocked(uint256 unlockTime);
    error ZeroAmount();
    error ZeroAddress();
    error Unauthorized();
    error InsufficientStakeBalance();
    error CannotRescueStakedToken();
    error DurationTooLong();

    // ─── Events ─────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount, uint256 lockUntil);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount, uint256 duration);
    event FeeRouterSet(address indexed router, bool authorized);
    event TokenRecovered(address indexed token, address indexed to, uint256 amount);

    // ─── Constants ──────────────────────────────────────────────────────

    uint256 public constant LOCK_DURATION = 24 hours;
    uint256 private constant PRECISION = 1e18;

    // ─── State ──────────────────────────────────────────────────────────

    IERC20 public gunr;

    uint256 public rewardPerTokenStored;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public periodFinish;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    mapping(address => uint256) public lockUntil;

    mapping(address => bool) public authorizedFeeRouters;

    uint256[40] private __gap;

    // ─── Initializer ────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address gunr_) external initializer {
        if (gunr_ == address(0)) revert ZeroAddress();
        __ERC20_init("Staked GUNR", "stGUNR");
        __Ownable_init(owner_);
        __Pausable_init();
        __UUPSUpgradeable_init();
        gunr = IERC20(gunr_);
    }

    // ─── Modifier ───────────────────────────────────────────────────────

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastApplicableTime();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ─── Views ──────────────────────────────────────────────────────────

    function lastApplicableTime() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + (lastApplicableTime() - lastUpdateTime) * rewardRate * PRECISION / totalSupply();
    }

    function earned(address account) public view returns (uint256) {
        return balanceOf(account)
            * (rewardPerToken() - userRewardPerTokenPaid[account]) / PRECISION
            + rewards[account];
    }

    function lockRemaining(address account) public view returns (uint256) {
        uint256 unlock = lockUntil[account];
        return block.timestamp >= unlock ? 0 : unlock - block.timestamp;
    }

    function totalStaked() external view returns (uint256) {
        return totalSupply();
    }

    function flowRate() external view returns (uint256) {
        return block.timestamp >= periodFinish ? 0 : rewardRate;
    }

    // ─── User Actions ───────────────────────────────────────────────────

    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        _mint(msg.sender, amount);
        lockUntil[msg.sender] = block.timestamp + LOCK_DURATION;
        gunr.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount, lockUntil[msg.sender]);
    }

    function unstake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        if (balanceOf(msg.sender) < amount) revert InsufficientStakeBalance();
        if (block.timestamp < lockUntil[msg.sender]) revert StillLocked(lockUntil[msg.sender]);
        _burn(msg.sender, amount);
        gunr.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claim() external nonReentrant whenNotPaused updateReward(msg.sender) returns (uint256) {
        uint256 reward = rewards[msg.sender];
        if (reward == 0) return 0;
        rewards[msg.sender] = 0;
        gunr.safeTransfer(msg.sender, reward);
        emit Claimed(msg.sender, reward);
        return reward;
    }

    // ─── ERC-20 Hook (transfer rebalances reward checkpoints) ──────────

    function _update(address from, address to, uint256 value) internal override {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastApplicableTime();
        if (from != address(0)) {
            rewards[from] = earned(from);
            userRewardPerTokenPaid[from] = rewardPerTokenStored;
        }
        if (to != address(0)) {
            rewards[to] = earned(to);
            userRewardPerTokenPaid[to] = rewardPerTokenStored;
        }
        super._update(from, to, value);
    }

    // ─── Admin ──────────────────────────────────────────────────────────

    function notifyRewardAmount(uint256 amount, uint256 duration)
        external
        nonReentrant
        onlyOwner
        updateReward(address(0))
    {
        if (amount == 0 || duration == 0) revert ZeroAmount();
        if (duration > 365 days) revert DurationTooLong();

        gunr.safeTransferFrom(msg.sender, address(this), amount);

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / duration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (amount + leftover) / duration;
        }

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + duration;
        emit RewardAdded(amount, duration);
    }

    function receiveGameFees(uint256 amount) external nonReentrant updateReward(address(0)) {
        if (!authorizedFeeRouters[msg.sender]) revert Unauthorized();
        if (amount == 0) revert ZeroAmount();
        gunr.safeTransferFrom(msg.sender, address(this), amount);

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / 30 days;
            periodFinish = block.timestamp + 30 days;
            emit RewardAdded(amount, 30 days);
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            rewardRate = (amount + remaining * rewardRate) / remaining;
            // periodFinish unchanged — fees distributed over existing window
            emit RewardAdded(amount, remaining);
        }

        lastUpdateTime = block.timestamp;
    }

    function setFeeRouter(address router, bool authorized) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        authorizedFeeRouters[router] = authorized;
        emit FeeRouterSet(router, authorized);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function recoverToken(address token, address to, uint256 amount)
        external
        nonReentrant
        onlyOwner
    {
        if (to == address(0)) revert ZeroAddress();
        if (token == address(gunr)) {
            uint256 available = gunr.balanceOf(address(this)) - totalSupply();
            if (amount > available) revert CannotRescueStakedToken();
        }
        IERC20(token).safeTransfer(to, amount);
        emit TokenRecovered(token, to, amount);
    }

    // ─── UUPS ───────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

- [ ] **Step 2: Build the contract**

Run from `/Users/joshuagrubbs/Larry/GundariuM/contracts/`:
```bash
forge build
```
Expected: clean compile (some upstream dependency warnings about deprecated Natspec assembly comments are present in OZ libs — ignore those; the new contract itself should produce no warnings).

DO NOT commit yet (commit is in Task 4 along with the tests and deploy script).

---

### Task 2: Create GUNRStaking.t.sol

**Files:**
- Create: `contracts/test/GUNRStaking.t.sol`

- [ ] **Step 1: Create the test file**

Create `/Users/joshuagrubbs/Larry/GundariuM/contracts/test/GUNRStaking.t.sol` with EXACTLY this content:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GUNRStaking} from "../src/GUNRStaking.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract GUNRStakingTest is Test {
    GUNRStaking staking;
    MockERC20 gunr;

    address owner = address(1);
    address alice = address(2);
    address bob = address(3);
    address carol = address(4);
    address router = address(5);

    uint256 constant INITIAL_SUPPLY = 1_000_000_000e18;
    uint256 constant ALICE_GUNR = 10_000_000e18;
    uint256 constant BOB_GUNR = 5_000_000e18;
    uint256 constant OWNER_GUNR = 100_000_000e18;

    function setUp() public {
        gunr = new MockERC20("GUNR", "GUNR", INITIAL_SUPPLY, owner);

        GUNRStaking impl = new GUNRStaking();
        bytes memory initData = abi.encodeCall(GUNRStaking.initialize, (owner, address(gunr)));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        staking = GUNRStaking(address(proxy));

        vm.startPrank(owner);
        gunr.transfer(alice, ALICE_GUNR);
        gunr.transfer(bob, BOB_GUNR);
        vm.stopPrank();

        vm.prank(alice);
        gunr.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        gunr.approve(address(staking), type(uint256).max);
        vm.prank(owner);
        gunr.approve(address(staking), type(uint256).max);
    }

    // ─── Initialization ──────────────────────────────────────────────

    function test_initialize_setsState() public {
        assertEq(staking.owner(), owner);
        assertEq(address(staking.gunr()), address(gunr));
        assertEq(staking.name(), "Staked GUNR");
        assertEq(staking.symbol(), "stGUNR");
        assertEq(staking.LOCK_DURATION(), 24 hours);
    }

    function test_initialize_zeroOwner_reverts() public {
        GUNRStaking impl = new GUNRStaking();
        bytes memory initData = abi.encodeCall(GUNRStaking.initialize, (address(0), address(gunr)));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new ERC1967Proxy(address(impl), initData);
    }

    function test_initialize_zeroGunr_reverts() public {
        GUNRStaking impl = new GUNRStaking();
        bytes memory initData = abi.encodeCall(GUNRStaking.initialize, (owner, address(0)));
        vm.expectRevert(GUNRStaking.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    // ─── Stake ───────────────────────────────────────────────────────

    function test_stake_happyPath() public {
        uint256 amount = 1_000_000e18;
        vm.prank(alice);
        staking.stake(amount);

        assertEq(staking.balanceOf(alice), amount);
        assertEq(staking.totalSupply(), amount);
        assertEq(gunr.balanceOf(address(staking)), amount);
        assertEq(gunr.balanceOf(alice), ALICE_GUNR - amount);
        assertEq(staking.lockUntil(alice), block.timestamp + 24 hours);
    }

    function test_stake_zeroAmount_reverts() public {
        vm.prank(alice);
        vm.expectRevert(GUNRStaking.ZeroAmount.selector);
        staking.stake(0);
    }

    function test_stake_resetsLock() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);
        uint256 firstLock = staking.lockUntil(alice);

        vm.warp(block.timestamp + 12 hours);

        vm.prank(alice);
        staking.stake(500_000e18);
        uint256 secondLock = staking.lockUntil(alice);

        assertEq(secondLock, firstLock + 12 hours);
    }

    function test_stake_emitsEvent() public {
        uint256 amount = 500_000e18;
        uint256 expectedLock = block.timestamp + 24 hours;

        vm.expectEmit(true, false, false, true);
        emit GUNRStaking.Staked(alice, amount, expectedLock);

        vm.prank(alice);
        staking.stake(amount);
    }

    // ─── Unstake ─────────────────────────────────────────────────────

    function test_unstake_happyPath() public {
        uint256 amount = 1_000_000e18;
        vm.prank(alice);
        staking.stake(amount);

        vm.warp(block.timestamp + 24 hours);

        vm.prank(alice);
        staking.unstake(amount);

        assertEq(staking.balanceOf(alice), 0);
        assertEq(staking.totalSupply(), 0);
        assertEq(gunr.balanceOf(alice), ALICE_GUNR);
    }

    function test_unstake_revertsBeforeLock() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);

        uint256 lockTime = staking.lockUntil(alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(GUNRStaking.StillLocked.selector, lockTime));
        staking.unstake(1_000_000e18);
    }

    function test_unstake_succeedsAtExactUnlock() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);

        vm.warp(staking.lockUntil(alice));

        vm.prank(alice);
        staking.unstake(1_000_000e18);
        assertEq(staking.balanceOf(alice), 0);
    }

    function test_unstake_overBalance_reverts() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);
        vm.warp(block.timestamp + 24 hours);

        vm.prank(alice);
        vm.expectRevert(GUNRStaking.InsufficientStakeBalance.selector);
        staking.unstake(2_000_000e18);
    }

    function test_unstake_zeroAmount_reverts() public {
        vm.prank(alice);
        vm.expectRevert(GUNRStaking.ZeroAmount.selector);
        staking.unstake(0);
    }

    // ─── Transfer (transferable stGUNR) ───────────────────────────────

    function test_transfer_movesEarningRights() public {
        vm.prank(owner);
        staking.notifyRewardAmount(OWNER_GUNR, 30 days);

        vm.prank(alice);
        staking.stake(1_000_000e18);

        vm.warp(block.timestamp + 1 days);
        uint256 aliceEarnedBefore = staking.earned(alice);
        assertGt(aliceEarnedBefore, 0);

        vm.prank(alice);
        staking.transfer(carol, 1_000_000e18);

        // Alice's earned is now frozen
        uint256 aliceEarnedAfter = staking.earned(alice);
        assertEq(aliceEarnedAfter, aliceEarnedBefore);

        // Carol has zero earned at the moment of transfer
        assertEq(staking.earned(carol), 0);

        // Time passes — Carol now accrues, Alice does not
        vm.warp(block.timestamp + 1 days);
        assertEq(staking.earned(alice), aliceEarnedBefore);
        assertGt(staking.earned(carol), 0);
    }

    function test_transfer_doesNotMoveLock() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);

        vm.prank(alice);
        staking.transfer(carol, 1_000_000e18);

        // Carol has no lock — never staked
        assertEq(staking.lockUntil(carol), 0);
    }

    function test_transfer_then_unstake_byRecipient() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);

        vm.prank(alice);
        staking.transfer(carol, 1_000_000e18);

        // Carol can unstake immediately — her own lockUntil is 0
        vm.prank(carol);
        staking.unstake(1_000_000e18);

        assertEq(gunr.balanceOf(carol), 1_000_000e18);
    }

    // ─── Claim ───────────────────────────────────────────────────────

    function test_claim_sendsGUNR_zeroesReward() public {
        vm.prank(owner);
        staking.notifyRewardAmount(OWNER_GUNR, 30 days);

        vm.prank(alice);
        staking.stake(1_000_000e18);

        vm.warp(block.timestamp + 1 days);

        uint256 expected = staking.earned(alice);
        uint256 aliceBefore = gunr.balanceOf(alice);

        vm.prank(alice);
        uint256 claimed = staking.claim();

        assertEq(claimed, expected);
        assertEq(gunr.balanceOf(alice), aliceBefore + expected);
        assertEq(staking.earned(alice), 0);
        assertEq(staking.rewards(alice), 0);
    }

    function test_claim_zero_returnsZero() public {
        vm.prank(alice);
        uint256 claimed = staking.claim();
        assertEq(claimed, 0);
    }

    // ─── Reward funding: notifyRewardAmount ─────────────────────────

    function test_notifyRewardAmount_setsRate() public {
        vm.prank(owner);
        staking.notifyRewardAmount(30 days * 1e18, 30 days);
        assertEq(staking.rewardRate(), 1e18);
        assertEq(staking.periodFinish(), block.timestamp + 30 days);
    }

    function test_notifyRewardAmount_extendsActivePeriod() public {
        vm.prank(owner);
        staking.notifyRewardAmount(30 days * 1e18, 30 days);

        vm.warp(block.timestamp + 10 days);

        vm.prank(owner);
        staking.notifyRewardAmount(30 days * 1e18, 30 days);

        assertEq(staking.periodFinish(), block.timestamp + 30 days);
        // Rate folds leftover (20 days * 1e18) into the new pool (30 days worth)
        // New rate = (30 days * 1e18 + 20 days * 1e18) / 30 days
        uint256 expectedRate = (30 days * 1e18 + 20 days * 1e18) / 30 days;
        assertEq(staking.rewardRate(), expectedRate);
    }

    function test_notifyRewardAmount_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        staking.notifyRewardAmount(1e18, 30 days);
    }

    function test_notifyRewardAmount_durationTooLong_reverts() public {
        vm.prank(owner);
        vm.expectRevert(GUNRStaking.DurationTooLong.selector);
        staking.notifyRewardAmount(1e18, 366 days);
    }

    // ─── Reward funding: receiveGameFees ───────────────────────────

    function test_receiveGameFees_onlyAuthorized_reverts() public {
        vm.prank(router);
        vm.expectRevert(GUNRStaking.Unauthorized.selector);
        staking.receiveGameFees(1e18);
    }

    function test_receiveGameFees_authorized_succeeds() public {
        vm.prank(owner);
        staking.setFeeRouter(router, true);

        vm.prank(owner);
        gunr.transfer(router, 1_000_000e18);
        vm.prank(router);
        gunr.approve(address(staking), type(uint256).max);

        vm.prank(router);
        staking.receiveGameFees(100_000e18);
        assertEq(staking.periodFinish(), block.timestamp + 30 days);
    }

    function test_receiveGameFees_inActivePeriod_keepsFinish() public {
        vm.prank(owner);
        staking.setFeeRouter(router, true);
        vm.prank(owner);
        gunr.transfer(router, 1_000_000e18);
        vm.prank(router);
        gunr.approve(address(staking), type(uint256).max);

        vm.prank(owner);
        staking.notifyRewardAmount(30 days * 1e18, 30 days);
        uint256 originalFinish = staking.periodFinish();

        vm.warp(block.timestamp + 10 days);

        vm.prank(router);
        staking.receiveGameFees(100_000e18);

        assertEq(staking.periodFinish(), originalFinish);
    }

    function test_setFeeRouter_grantsAndRevokes() public {
        vm.prank(owner);
        staking.setFeeRouter(router, true);
        assertTrue(staking.authorizedFeeRouters(router));

        vm.prank(owner);
        staking.setFeeRouter(router, false);
        assertFalse(staking.authorizedFeeRouters(router));
    }

    function test_setFeeRouter_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        staking.setFeeRouter(router, true);
    }

    function test_setFeeRouter_zeroAddress_reverts() public {
        vm.prank(owner);
        vm.expectRevert(GUNRStaking.ZeroAddress.selector);
        staking.setFeeRouter(address(0), true);
    }

    // ─── Pause ───────────────────────────────────────────────────────

    function test_pause_blocksStake() public {
        vm.prank(owner);
        staking.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        staking.stake(1e18);
    }

    function test_pause_blocksUnstake() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);
        vm.warp(block.timestamp + 24 hours);
        vm.prank(owner);
        staking.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        staking.unstake(1_000_000e18);
    }

    function test_pause_blocksClaim() public {
        vm.prank(owner);
        staking.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        staking.claim();
    }

    function test_pause_doesNotBlockAdmin() public {
        vm.prank(owner);
        staking.pause();

        // notifyRewardAmount still works
        vm.prank(owner);
        staking.notifyRewardAmount(1_000_000e18, 30 days);

        // setFeeRouter still works
        vm.prank(owner);
        staking.setFeeRouter(router, true);
    }

    function test_pause_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        staking.pause();
    }

    // ─── Recover ────────────────────────────────────────────────────

    function test_recoverToken_blocksStakedGunr() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);

        vm.prank(owner);
        vm.expectRevert(GUNRStaking.CannotRescueStakedToken.selector);
        staking.recoverToken(address(gunr), owner, 1);
    }

    function test_recoverToken_allowsRewardPoolGunr() public {
        // Owner sends 500 GUNR to contract via notifyRewardAmount; no stake yet
        vm.prank(owner);
        staking.notifyRewardAmount(500e18, 30 days);
        // Recoverable = balance - totalSupply = 500e18 - 0 = 500e18
        vm.prank(owner);
        staking.recoverToken(address(gunr), owner, 500e18);
        assertEq(gunr.balanceOf(address(staking)), 0);
    }

    function test_recoverToken_arbitraryToken_works() public {
        MockERC20 other = new MockERC20("OTHER", "OTHER", 1000e18, address(staking));
        vm.prank(owner);
        staking.recoverToken(address(other), owner, 1000e18);
        assertEq(other.balanceOf(owner), 1000e18);
    }

    function test_recoverToken_zeroAddress_reverts() public {
        vm.prank(owner);
        vm.expectRevert(GUNRStaking.ZeroAddress.selector);
        staking.recoverToken(address(gunr), address(0), 1);
    }

    function test_recoverToken_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        staking.recoverToken(address(gunr), alice, 1);
    }

    // ─── Views ──────────────────────────────────────────────────────

    function test_earned_perSecond_smoothness() public {
        vm.prank(owner);
        staking.notifyRewardAmount(30 days * 1e18, 30 days);

        vm.prank(alice);
        staking.stake(1_000_000e18);

        vm.warp(block.timestamp + 100);
        uint256 earned100 = staking.earned(alice);

        vm.warp(block.timestamp + 100);
        uint256 earned200 = staking.earned(alice);

        // earned200 should be roughly 2x earned100 (linear growth)
        assertApproxEqRel(earned200, earned100 * 2, 0.01e18);
    }

    function test_lockRemaining_view() public {
        assertEq(staking.lockRemaining(alice), 0);

        vm.prank(alice);
        staking.stake(1_000_000e18);

        assertEq(staking.lockRemaining(alice), 24 hours);

        vm.warp(block.timestamp + 12 hours);
        assertEq(staking.lockRemaining(alice), 12 hours);

        vm.warp(block.timestamp + 13 hours);
        assertEq(staking.lockRemaining(alice), 0);
    }

    function test_totalStaked_aliasesTotalSupply() public {
        vm.prank(alice);
        staking.stake(1_000_000e18);
        assertEq(staking.totalStaked(), staking.totalSupply());
    }

    function test_flowRate_zeroWhenExpired() public {
        vm.prank(owner);
        staking.notifyRewardAmount(30 days * 1e18, 30 days);
        assertGt(staking.flowRate(), 0);

        vm.warp(block.timestamp + 31 days);
        assertEq(staking.flowRate(), 0);
    }

    // ─── Upgrade ────────────────────────────────────────────────────

    function test_upgrade_onlyOwner_reverts() public {
        GUNRStaking newImpl = new GUNRStaking();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        staking.upgradeToAndCall(address(newImpl), "");
    }
}
```

- [ ] **Step 2: Run the tests**

Run from `/Users/joshuagrubbs/Larry/GundariuM/contracts/`:
```bash
forge test --match-contract GUNRStakingTest -vv
```
Expected: all 42 tests pass (42 passed; 0 failed; 0 skipped).

If any fail, debug and fix BEFORE moving to Task 3.

---

### Task 3: Create DeployGUNRStaking.s.sol (reference script)

**Files:**
- Create: `contracts/script/DeployGUNRStaking.s.sol`

- [ ] **Step 1: Create the deploy script**

Create `/Users/joshuagrubbs/Larry/GundariuM/contracts/script/DeployGUNRStaking.s.sol` with EXACTLY this content:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GUNRStaking} from "../src/GUNRStaking.sol";

/**
 * @notice Reference deploy script for GUNRStaking UUPS proxy.
 *
 *         WARNING: Per [[feedback_eip7702_deploy]], multi-tx forge broadcasts
 *         hit "gapped-nonce" errors on Joshua's deployer wallet 0x9D62 due
 *         to EIP-7702 delegation. This script is for reference and dry-run
 *         (`forge script` without --broadcast) only.
 *
 *         LIVE DEPLOYS use two single-tx `forge create` calls instead:
 *           1. forge create GUNRStaking (implementation)
 *           2. forge create ERC1967Proxy with --constructor-args $IMPL_ADDR $INIT_CALLDATA
 *
 *         See the implementation plan for the exact commands.
 *
 * Required env vars:
 *   OWNER_ADDRESS — address that will own the proxy
 *   GUNR_ADDRESS  — $GUNR token address on the target chain
 *
 * Usage (dry-run only):
 *   OWNER_ADDRESS=0x... GUNR_ADDRESS=0x... \
 *     forge script script/DeployGUNRStaking.s.sol --rpc-url $BASE_RPC_URL -vvvv
 */
contract DeployGUNRStaking is Script {
    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");
        address gunr_  = vm.envAddress("GUNR_ADDRESS");

        vm.startBroadcast();

        GUNRStaking impl = new GUNRStaking();
        bytes memory initData = abi.encodeCall(GUNRStaking.initialize, (owner_, gunr_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console.log("=== GUNRStaking Deploy ===");
        console.log("Owner:          ", owner_);
        console.log("GUNR token:     ", gunr_);
        console.log("Implementation: ", address(impl));
        console.log("Proxy:          ", address(proxy));
        console.log("");
        console.log("Update src/lib/contracts/addresses.ts:");
        console.log("  gunrStaking:  ", address(proxy));
    }
}
```

- [ ] **Step 2: Build to verify the script compiles**

Run from `contracts/`:
```bash
forge build
```
Expected: clean compile.

---

### Task 4: Commit contract + tests + deploy script

- [ ] **Step 1: Stage and commit**

```bash
cd /Users/joshuagrubbs/Larry/GundariuM
git add contracts/src/GUNRStaking.sol contracts/test/GUNRStaking.t.sol contracts/script/DeployGUNRStaking.s.sol
git commit -m "$(cat <<'EOF'
feat(staking): GUNRStaking V2 contract + tests + reference deploy script

Synthetix rewardPerToken accounting in GUNR (no Superfluid). The contract
IS the stGUNR ERC-20 receipt token (transferable). Per-account 24-hour
lock from each stake, Streme-style reset on additional stakes. Funding
via owner notifyRewardAmount + authorized game-fee routing.

UUPS upgradeable. 32-test suite covers stake/unstake/claim, transfer-
moves-earning-rights semantics, reward funding paths, pause behavior,
recoverToken guards (cannot drain staked GUNR), and view helpers.

Spec: docs/superpowers/specs/2026-05-30-gunr-staking-v2-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — Sepolia rehearsal

### Task 5: Deploy GUNRStaking implementation to Base Sepolia [JOSHUA — keystore]

**Files:** none (on-chain)

Joshua runs from `contracts/`:

```bash
forge create src/GUNRStaking.sol:GUNRStaking --rpc-url https://sepolia.base.org --account deployer --broadcast
```

Expected output includes `Deployed to: 0x...` — **record this as `$SEPOLIA_IMPL`** for the next task.

If the same `--broadcast` parsing issue from migration v2 deploy occurs (output says "Dry run enabled" despite the flag), the fix is to ensure `--broadcast` comes BEFORE any variadic flag (there are no variadic flags in this command, so it should work cleanly).

---

### Task 6: Deploy proxy to Base Sepolia pointing at the implementation [JOSHUA — keystore]

**Files:** none (on-chain)

Two sub-steps:

**Step 1: Compute the initialize calldata** (run in same shell):

```bash
SEPOLIA_OWNER=0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7
SEPOLIA_GUNR=0x6Add3cF424f9D2927721B13110164a3e019efFa4
INIT_CALLDATA=$(cast calldata "initialize(address,address)" $SEPOLIA_OWNER $SEPOLIA_GUNR)
echo "Init calldata: $INIT_CALLDATA"
```

**Step 2: Deploy the proxy** (replace `<SEPOLIA_IMPL>` with the address from Task 5):

```bash
forge create lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
  --rpc-url https://sepolia.base.org \
  --account deployer \
  --broadcast \
  --constructor-args <SEPOLIA_IMPL> $INIT_CALLDATA
```

Expected: `Deployed to: 0x...` — **record this as `$SEPOLIA_PROXY`**. This is the address Joshua interacts with for everything.

---

### Task 7: Post-deploy verification via cast calls (Sepolia)

- [ ] **Step 1: Verify all initialized state**

Replace `<SEPOLIA_PROXY>` with the address from Task 6:

```bash
cd /Users/joshuagrubbs/Larry/GundariuM/contracts
echo "--- owner ---"
cast call <SEPOLIA_PROXY> "owner()(address)" --rpc-url https://sepolia.base.org
echo "Expected: 0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7"

echo "--- gunr ---"
cast call <SEPOLIA_PROXY> "gunr()(address)" --rpc-url https://sepolia.base.org
echo "Expected: 0x6Add3cF424f9D2927721B13110164a3e019efFa4"

echo "--- name ---"
cast call <SEPOLIA_PROXY> "name()(string)" --rpc-url https://sepolia.base.org
echo "Expected: Staked GUNR"

echo "--- symbol ---"
cast call <SEPOLIA_PROXY> "symbol()(string)" --rpc-url https://sepolia.base.org
echo "Expected: stGUNR"

echo "--- LOCK_DURATION ---"
cast call <SEPOLIA_PROXY> "LOCK_DURATION()(uint256)" --rpc-url https://sepolia.base.org
echo "Expected: 86400"

echo "--- totalSupply ---"
cast call <SEPOLIA_PROXY> "totalSupply()(uint256)" --rpc-url https://sepolia.base.org
echo "Expected: 0"

echo "--- paused ---"
cast call <SEPOLIA_PROXY> "paused()(bool)" --rpc-url https://sepolia.base.org
echo "Expected: false"
```

If any value does NOT match expected, STOP and investigate before proceeding.

---

### Task 8: Update addresses.ts with Sepolia gunrStaking address

**Files:**
- Modify: `src/lib/contracts/addresses.ts`

- [ ] **Step 1: Read current addresses.ts**

Read `/Users/joshuagrubbs/Larry/GundariuM/src/lib/contracts/addresses.ts` to confirm current state.

- [ ] **Step 2: Replace the Sepolia gunrStaking field**

In the `84532` (Base Sepolia) section, find:
```ts
gunrStaking: "0x4fFFF1428f49Ae73a21AA103C992533BA24E48E7",
```
Replace with the proxy address from Task 6:
```ts
gunrStaking: "<SEPOLIA_PROXY>",
```

Keep mainnet field as-is (still pointing at the old GNDMStaking address — that gets updated in Task 17).

- [ ] **Step 3: Commit**

```bash
cd /Users/joshuagrubbs/Larry/GundariuM
git add src/lib/contracts/addresses.ts
git commit -m "chore(addresses): point Sepolia gunrStaking at v2 proxy <SEPOLIA_PROXY>"
```

---

## Phase C — Frontend

### Task 9: Create the GUNRStaking ABI file

**Files:**
- Create: `src/lib/contracts/abis/GUNRStaking.ts`

- [ ] **Step 1: Create the ABI file**

Create `/Users/joshuagrubbs/Larry/GundariuM/src/lib/contracts/abis/GUNRStaking.ts` with EXACTLY this content:

```ts
export const GUNR_STAKING_ABI = [
  // ─── Views ───────────────────────────────────────────────────────
  { "type": "function", "name": "gunr", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "owner", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "paused", "inputs": [], "outputs": [{ "type": "bool" }], "stateMutability": "view" },
  { "type": "function", "name": "name", "inputs": [], "outputs": [{ "type": "string" }], "stateMutability": "view" },
  { "type": "function", "name": "symbol", "inputs": [], "outputs": [{ "type": "string" }], "stateMutability": "view" },
  { "type": "function", "name": "decimals", "inputs": [], "outputs": [{ "type": "uint8" }], "stateMutability": "view" },
  { "type": "function", "name": "totalSupply", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "totalStaked", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "balanceOf", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "earned", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "lockRemaining", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "lockUntil", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "flowRate", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "rewardRate", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "periodFinish", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "LOCK_DURATION", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },

  // ─── ERC-20 Writes ───────────────────────────────────────────────
  { "type": "function", "name": "transfer", "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "approve", "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "type": "bool" }], "stateMutability": "nonpayable" },

  // ─── User Writes ─────────────────────────────────────────────────
  { "type": "function", "name": "stake", "inputs": [{ "name": "amount", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "unstake", "inputs": [{ "name": "amount", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "claim", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "nonpayable" },

  // ─── Admin ───────────────────────────────────────────────────────
  { "type": "function", "name": "notifyRewardAmount", "inputs": [{ "name": "amount", "type": "uint256" }, { "name": "duration", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "receiveGameFees", "inputs": [{ "name": "amount", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "setFeeRouter", "inputs": [{ "name": "router", "type": "address" }, { "name": "authorized", "type": "bool" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "pause", "inputs": [], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "unpause", "inputs": [], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "recoverToken", "inputs": [{ "name": "token", "type": "address" }, { "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [], "stateMutability": "nonpayable" },

  // ─── Events ──────────────────────────────────────────────────────
  { "type": "event", "name": "Staked", "inputs": [{ "name": "user", "type": "address", "indexed": true }, { "name": "amount", "type": "uint256" }, { "name": "lockUntil", "type": "uint256" }] },
  { "type": "event", "name": "Unstaked", "inputs": [{ "name": "user", "type": "address", "indexed": true }, { "name": "amount", "type": "uint256" }] },
  { "type": "event", "name": "Claimed", "inputs": [{ "name": "user", "type": "address", "indexed": true }, { "name": "amount", "type": "uint256" }] },
  { "type": "event", "name": "RewardAdded", "inputs": [{ "name": "amount", "type": "uint256" }, { "name": "duration", "type": "uint256" }] },
  { "type": "event", "name": "FeeRouterSet", "inputs": [{ "name": "router", "type": "address", "indexed": true }, { "name": "authorized", "type": "bool" }] },
  { "type": "event", "name": "TokenRecovered", "inputs": [{ "name": "token", "type": "address", "indexed": true }, { "name": "to", "type": "address", "indexed": true }, { "name": "amount", "type": "uint256" }] },
  { "type": "event", "name": "Transfer", "inputs": [{ "name": "from", "type": "address", "indexed": true }, { "name": "to", "type": "address", "indexed": true }, { "name": "value", "type": "uint256" }] },
  { "type": "event", "name": "Approval", "inputs": [{ "name": "owner", "type": "address", "indexed": true }, { "name": "spender", "type": "address", "indexed": true }, { "name": "value", "type": "uint256" }] }
] as const;
```

---

### Task 10: Replace stake page with full stake/unstake/claim UI

**Files:**
- Modify: `src/app/stake/page.tsx`

- [ ] **Step 1: Replace the entire file**

Replace `/Users/joshuagrubbs/Larry/GundariuM/src/app/stake/page.tsx` with EXACTLY this content:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import { base } from "viem/chains";
import { GUNR_STAKING_ABI } from "@/lib/contracts/abis/GUNRStaking";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { ComingSoon } from "@/components/ui/ComingSoon";

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

type Tab = "stake" | "unstake" | "claim";
type Phase = "idle" | "approving" | "staking" | "unstaking" | "claiming" | "done" | "error";

export default function StakePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { writeContractAsync } = useWriteContract();

  let contracts: ReturnType<typeof getContracts> | null = null;
  let stakingReady = false;
  try {
    contracts = getContracts(base.id);
    stakingReady = !isPlaceholder(contracts.gunrStaking);
  } catch {}

  if (!stakingReady) {
    return (
      <ComingSoon
        title="GUNR STAKING"
        subtitle="Stake GUNR to earn rewards. Launching soon."
      />
    );
  }

  const stakingAddress = contracts!.gunrStaking;
  const gunrAddress = contracts!.gunrToken;

  return (
    <StakePageInner
      address={address}
      isConnected={isConnected}
      stakingAddress={stakingAddress}
      gunrAddress={gunrAddress}
      writeContractAsync={writeContractAsync}
      publicClient={publicClient}
    />
  );
}

function StakePageInner({
  address,
  isConnected,
  stakingAddress,
  gunrAddress,
  writeContractAsync,
  publicClient,
}: {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  stakingAddress: `0x${string}`;
  gunrAddress: `0x${string}`;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
  publicClient: ReturnType<typeof usePublicClient>;
}) {
  const [tab, setTab] = useState<Tab>("stake");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // forces re-render every second for live earned display

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Reads (all pinned to Base mainnet) ───────────────────────────

  const { data: gunrBalance } = useReadContract({
    chainId: base.id,
    address: gunrAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: stakedBalance } = useReadContract({
    chainId: base.id,
    address: stakingAddress,
    abi: GUNR_STAKING_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: earned, refetch: refetchEarned } = useReadContract({
    chainId: base.id,
    address: stakingAddress,
    abi: GUNR_STAKING_ABI,
    functionName: "earned",
    args: address ? [address] : undefined,
  });

  const { data: lockRemaining, refetch: refetchLock } = useReadContract({
    chainId: base.id,
    address: stakingAddress,
    abi: GUNR_STAKING_ABI,
    functionName: "lockRemaining",
    args: address ? [address] : undefined,
  });

  const { data: totalStaked } = useReadContract({
    chainId: base.id,
    address: stakingAddress,
    abi: GUNR_STAKING_ABI,
    functionName: "totalStaked",
  });

  const { data: flowRate } = useReadContract({
    chainId: base.id,
    address: stakingAddress,
    abi: GUNR_STAKING_ABI,
    functionName: "flowRate",
  });

  // Trigger re-fetch every second for the smooth tick (cheap because cache-aware)
  useEffect(() => {
    refetchEarned();
    refetchLock();
  }, [tick, refetchEarned, refetchLock]);

  // ─── Derived ─────────────────────────────────────────────────────

  const gunrBalanceWei = (gunrBalance as bigint) ?? 0n;
  const stakedWei = (stakedBalance as bigint) ?? 0n;
  const earnedWei = (earned as bigint) ?? 0n;
  const lockSec = (lockRemaining as bigint) ?? 0n;
  const totalStakedWei = (totalStaked as bigint) ?? 0n;
  const flowRateWei = (flowRate as bigint) ?? 0n;

  const isLocked = lockSec > 0n;
  const aprPercent =
    totalStakedWei > 0n && flowRateWei > 0n
      ? Number((flowRateWei * BigInt(SECONDS_PER_YEAR) * 10000n) / totalStakedWei) / 100
      : 0;

  function fmt(wei: bigint, fractionDigits = 0): string {
    const n = parseFloat(formatUnits(wei, 18));
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
  }

  function fmtEarned(wei: bigint): string {
    const n = parseFloat(formatUnits(wei, 18));
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  function fmtLockCountdown(sec: bigint): string {
    if (sec === 0n) return "Unlocked";
    const s = Number(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h}h ${m}m ${ss}s`;
  }

  // ─── Actions ─────────────────────────────────────────────────────

  async function handleStake() {
    if (!address || !publicClient) return;
    const amountWei = parseUnits(amount, 18);
    if (amountWei <= 0n) return;

    setPhase("approving");
    setError(null);

    try {
      const approveHash = await writeContractAsync({
        chainId: base.id,
        address: gunrAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [stakingAddress, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setPhase("staking");
      const stakeHash = await writeContractAsync({
        chainId: base.id,
        address: stakingAddress,
        abi: GUNR_STAKING_ABI,
        functionName: "stake",
        args: [amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: stakeHash });

      setTxHash(stakeHash);
      setPhase("done");
      setAmount("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Stake failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  }

  async function handleUnstake() {
    if (!address || !publicClient) return;
    const amountWei = parseUnits(amount, 18);
    if (amountWei <= 0n) return;

    setPhase("unstaking");
    setError(null);

    try {
      const hash = await writeContractAsync({
        chainId: base.id,
        address: stakingAddress,
        abi: GUNR_STAKING_ABI,
        functionName: "unstake",
        args: [amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
      setPhase("done");
      setAmount("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unstake failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  }

  async function handleClaim() {
    if (!address || !publicClient) return;
    setPhase("claiming");
    setError(null);

    try {
      const hash = await writeContractAsync({
        chainId: base.id,
        address: stakingAddress,
        abi: GUNR_STAKING_ABI,
        functionName: "claim",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
      setPhase("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Claim failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-black tracking-wider text-[var(--accent)]">
            GUNR STAKING
          </h1>
          <p className="text-sm text-[var(--foreground)]/60">
            Stake $GUNR, earn streaming $GUNR rewards
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Your Staked" value={isConnected ? fmt(stakedWei) : "—"} />
          <StatCard label="Your Earned" value={isConnected ? fmtEarned(earnedWei) : "—"} highlight />
          <StatCard label="Pool TVL" value={fmt(totalStakedWei)} />
          <StatCard
            label="APR"
            value={
              aprPercent > 0
                ? `${aprPercent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
                : "Inactive"
            }
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
          <TabButton active={tab === "stake"} onClick={() => { setTab("stake"); setPhase("idle"); setAmount(""); }}>Stake</TabButton>
          <TabButton active={tab === "unstake"} onClick={() => { setTab("unstake"); setPhase("idle"); setAmount(""); }}>Unstake</TabButton>
          <TabButton active={tab === "claim"} onClick={() => { setTab("claim"); setPhase("idle"); }}>Claim</TabButton>
        </div>

        {/* Tab content */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          {!isConnected ? (
            <p className="text-center text-sm text-[var(--foreground)]/50 py-4">
              Connect your wallet to stake
            </p>
          ) : tab === "stake" ? (
            <StakeTab
              amount={amount}
              setAmount={setAmount}
              maxAmount={gunrBalanceWei}
              phase={phase}
              error={error}
              onSubmit={handleStake}
            />
          ) : tab === "unstake" ? (
            <UnstakeTab
              amount={amount}
              setAmount={setAmount}
              maxAmount={stakedWei}
              isLocked={isLocked}
              lockCountdown={fmtLockCountdown(lockSec)}
              phase={phase}
              error={error}
              onSubmit={handleUnstake}
            />
          ) : (
            <ClaimTab
              earnedDisplay={fmtEarned(earnedWei)}
              phase={phase}
              error={error}
              onSubmit={handleClaim}
            />
          )}

          {phase === "done" && txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-[var(--foreground)]/40 hover:text-[var(--accent)] transition-colors break-all text-center"
            >
              {txHash}
            </a>
          )}
        </div>

        <p className="text-center text-xs text-[var(--foreground)]/30">
          24-hour lock from each stake · Base Mainnet
        </p>
      </div>
    </main>
  );
}

// ─── Components ───────────────────────────────────────────────────

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
      <div className="text-[10px] text-[var(--foreground)]/40 uppercase tracking-widest mb-1">{label}</div>
      <div
        className={`font-[family-name:var(--font-orbitron)] font-black text-sm tabular-nums ${
          highlight ? "text-[var(--accent)]" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-xs font-bold tracking-wider transition-all font-[family-name:var(--font-orbitron)] ${
        active
          ? "bg-[var(--accent)] text-black"
          : "text-[var(--foreground)]/60 hover:text-[var(--accent)]"
      }`}
    >
      {children}
    </button>
  );
}

function AmountInput({
  amount,
  setAmount,
  maxAmount,
}: {
  amount: string;
  setAmount: (v: string) => void;
  maxAmount: bigint;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
      <input
        type="number"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        className="flex-1 bg-transparent text-lg font-bold text-[var(--foreground)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        onClick={() => setAmount(formatUnits(maxAmount, 18))}
        className="text-xs font-bold text-[var(--accent)] hover:text-white transition-colors font-[family-name:var(--font-orbitron)]"
      >
        MAX
      </button>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  phase,
  pendingLabel,
  idleLabel,
}: {
  onClick: () => void;
  disabled: boolean;
  phase: Phase;
  pendingLabel: string;
  idleLabel: string;
}) {
  const isPending = phase === "approving" || phase === "staking" || phase === "unstaking" || phase === "claiming";
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className="w-full rounded-lg bg-[var(--accent)] text-black font-bold py-3 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        idleLabel
      )}
    </button>
  );
}

function StakeTab({
  amount,
  setAmount,
  maxAmount,
  phase,
  error,
  onSubmit,
}: {
  amount: string;
  setAmount: (v: string) => void;
  maxAmount: bigint;
  phase: Phase;
  error: string | null;
  onSubmit: () => void;
}) {
  const label = phase === "approving" ? "APPROVING..." : "STAKING...";
  return (
    <>
      <div className="space-y-2">
        <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest">
          Amount (GUNR)
        </label>
        <AmountInput amount={amount} setAmount={setAmount} maxAmount={maxAmount} />
      </div>
      {phase === "error" && error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
      <ActionButton
        onClick={onSubmit}
        disabled={!amount || parseFloat(amount) <= 0}
        phase={phase}
        pendingLabel={label}
        idleLabel="STAKE GUNR"
      />
    </>
  );
}

function UnstakeTab({
  amount,
  setAmount,
  maxAmount,
  isLocked,
  lockCountdown,
  phase,
  error,
  onSubmit,
}: {
  amount: string;
  setAmount: (v: string) => void;
  maxAmount: bigint;
  isLocked: boolean;
  lockCountdown: string;
  phase: Phase;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest">
          Amount (stGUNR)
        </label>
        <AmountInput amount={amount} setAmount={setAmount} maxAmount={maxAmount} />
      </div>
      {isLocked && (
        <p className="text-center text-xs text-[var(--accent-2)]/80 font-[family-name:var(--font-orbitron)] tabular-nums">
          Lock: {lockCountdown}
        </p>
      )}
      {phase === "error" && error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
      <ActionButton
        onClick={onSubmit}
        disabled={!amount || parseFloat(amount) <= 0 || isLocked}
        phase={phase}
        pendingLabel="UNSTAKING..."
        idleLabel={isLocked ? "LOCKED" : "UNSTAKE"}
      />
    </>
  );
}

function ClaimTab({
  earnedDisplay,
  phase,
  error,
  onSubmit,
}: {
  earnedDisplay: string;
  phase: Phase;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="text-center space-y-1">
        <div className="text-[10px] text-[var(--foreground)]/40 uppercase tracking-widest">
          Claimable
        </div>
        <div className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)] tabular-nums">
          {earnedDisplay}
        </div>
        <div className="text-xs text-[var(--foreground)]/40">GUNR</div>
      </div>
      {phase === "error" && error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
      <ActionButton
        onClick={onSubmit}
        disabled={false}
        phase={phase}
        pendingLabel="CLAIMING..."
        idleLabel="CLAIM REWARDS"
      />
    </>
  );
}
```

- [ ] **Step 2: Lint**

Run from repo root:
```bash
cd /Users/joshuagrubbs/Larry/GundariuM
npm run lint
```
Expected: no NEW errors in `src/app/stake/page.tsx` or `src/lib/contracts/abis/GUNRStaking.ts`. (Pre-existing OZ lib lint errors will appear — ignore them.)

- [ ] **Step 3: Build (TypeScript check)**

```bash
npm run build
```
Expected: clean Next.js build, no TypeScript errors.

---

### Task 11: Commit frontend code

- [ ] **Step 1: Stage and commit**

```bash
cd /Users/joshuagrubbs/Larry/GundariuM
git add src/lib/contracts/abis/GUNRStaking.ts src/app/stake/page.tsx
git commit -m "$(cat <<'EOF'
feat(stake): full stake/unstake/claim UI replaces ComingSoon

Wires the /stake page to the GUNRStaking V2 contract:
- Stake tab: amount input, MAX = user GUNR balance, two-tx approve+stake
- Unstake tab: amount input, MAX = stGUNR balance, single tx, disabled with
  countdown while lock is active
- Claim tab: live-ticking earned display, single-tx claim
- Stats grid: Your Staked / Your Earned (smooth ticking via 1s polling) /
  Pool TVL / APR (annualized from flowRate vs totalSupply)
- All reads + writes pin chainId: base.id to avoid the mini-app chain
  default issue documented in migration v2

Falls back to ComingSoon when gunrStaking address is a placeholder, so this
ships safely even before mainnet deploy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase D — Sepolia manual test

### Task 12: Live Sepolia smoke test [JOSHUA]

This is a manual happy-path test against the Sepolia deploy + Sepolia frontend.

- [ ] **Step 1: Switch app to point at Sepolia and run dev server**

The current addresses.ts has mainnet GUNR at `0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07` and Sepolia GUNR at `0x6Add3cF424f9D2927721B13110164a3e019efFa4`. The frontend reads from whichever chain the wallet is connected to via `base.id` pinning — but for Sepolia testing we need to temporarily flip the pinned chainId to `baseSepolia.id`.

For this manual test only: in `src/app/stake/page.tsx`, find-and-replace `chainId: base.id` → `chainId: baseSepolia.id` throughout the file (11 occurrences: 6 useReadContract + 4 writeContractAsync + 1 usePublicClient). Also update the import line `import { base } from "viem/chains";` → `import { base, baseSepolia } from "viem/chains";`. Do NOT commit this change — it's a local test toggle. Revert before continuing to mainnet phase.

```bash
cd /Users/joshuagrubbs/Larry/GundariuM
npm run dev
```

Open http://localhost:3000/stake in a browser with a wallet that holds Sepolia GUNR (Joshua's deployer wallet has some on Sepolia from prior testing).

- [ ] **Step 2: Acquire Sepolia GUNR if needed**

If the deployer wallet has no Sepolia GUNR, mint some via the MockERC20 contract at `0x6Add3cF424f9D2927721B13110164a3e019efFa4`:

```bash
cast send 0x6Add3cF424f9D2927721B13110164a3e019efFa4 \
  "transfer(address,uint256)" \
  0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7 \
  10000000000000000000000 \
  --account deployer \
  --rpc-url https://sepolia.base.org
```

This transfers 10,000 GUNR from the deployer (who owns the supply per MockERC20 constructor) to themselves — a no-op, but use the existing balance directly instead.

- [ ] **Step 3: Run the full happy path through the UI**

In the browser:
1. **Stake**: enter 100 GUNR → click MAX → click STAKE → approve → confirm stake → verify `Your Staked: 100` after confirmation
2. **Lock display**: confirm the Unstake tab shows "Lock: ~23h 59m" countdown
3. **Owner notify**: in a terminal, run `cast send <SEPOLIA_PROXY> "notifyRewardAmount(uint256,uint256)" 1000000000000000000000 86400 --account deployer --rpc-url https://sepolia.base.org` (1000 GUNR over 1 day)
4. **Watch earned**: refresh the page; the "Your Earned" card should start ticking up per second
5. **Transfer test**: send 50 stGUNR to a different test wallet via `cast send <SEPOLIA_PROXY> "transfer(address,uint256)" <test_wallet> 50000000000000000000 --account deployer --rpc-url https://sepolia.base.org` — verify recipient's earned begins increasing and sender's freezes
6. **Claim**: switch to Claim tab → confirm displayed claimable looks right → CLAIM → verify GUNR balance increases by the claimed amount and earned drops to ~0
7. **Unstake (after lock expires)**: warp not possible on real chain; either wait 24h OR for testing speed, redeploy the contract with a shorter LOCK_DURATION constant just for Sepolia.

Note any UI glitches (per-second tick stalls, math errors, button states) and fix in a follow-up commit before mainnet.

- [ ] **Step 4: Revert the chainId test toggle**

In `src/app/stake/page.tsx`, find-and-replace `chainId: baseSepolia.id` → `chainId: base.id` (all 11 occurrences). Restore the import line to `import { base } from "viem/chains";`. Do NOT commit — this returns the file to the main-branch state.

Verify with: `cd /Users/joshuagrubbs/Larry/GundariuM && git diff src/app/stake/page.tsx` — expected: no output.

---

## Phase E — Mainnet deploy

### Task 13: Pre-deploy: verify deployer GUNR balance [JOSHUA]

- [ ] **Step 1: Check deployer GUNR holdings**

```bash
cast call 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07 \
  "balanceOf(address)(uint256)" \
  0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7 \
  --rpc-url https://mainnet.base.org
```

The deploy itself doesn't require any GUNR (no funding at deploy). Reward funding is a separate optional step. As long as the deployer has enough ETH on Base mainnet to cover the two deploy gas fees (~0.005 ETH should be plenty), proceed.

---

### Task 14: Deploy GUNRStaking implementation to Base mainnet [JOSHUA — keystore]

**Files:** none (on-chain)

Run from `contracts/`:

```bash
forge create src/GUNRStaking.sol:GUNRStaking --rpc-url https://mainnet.base.org --account deployer --broadcast
```

Record the address as `$MAINNET_IMPL`.

---

### Task 15: Deploy proxy to Base mainnet pointing at the implementation [JOSHUA — keystore]

**Files:** none (on-chain)

- [ ] **Step 1: Compute initialize calldata**

```bash
MAINNET_OWNER=0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7
MAINNET_GUNR=0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07
INIT_CALLDATA=$(cast calldata "initialize(address,address)" $MAINNET_OWNER $MAINNET_GUNR)
echo "Init calldata: $INIT_CALLDATA"
```

- [ ] **Step 2: Deploy the proxy** (replace `<MAINNET_IMPL>` with address from Task 14)

```bash
forge create lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
  --rpc-url https://mainnet.base.org \
  --account deployer \
  --broadcast \
  --constructor-args <MAINNET_IMPL> $INIT_CALLDATA
```

Record the address as `$MAINNET_PROXY`. This is the user-facing staking contract address.

---

### Task 16: Post-deploy verification via cast calls (mainnet)

- [ ] **Step 1: Verify all initialized state**

Replace `<MAINNET_PROXY>` with the proxy from Task 15:

```bash
echo "--- owner ---"
cast call <MAINNET_PROXY> "owner()(address)" --rpc-url https://mainnet.base.org
echo "Expected: 0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7"

echo "--- gunr ---"
cast call <MAINNET_PROXY> "gunr()(address)" --rpc-url https://mainnet.base.org
echo "Expected: 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07"

echo "--- name ---"
cast call <MAINNET_PROXY> "name()(string)" --rpc-url https://mainnet.base.org
echo "Expected: Staked GUNR"

echo "--- symbol ---"
cast call <MAINNET_PROXY> "symbol()(string)" --rpc-url https://mainnet.base.org
echo "Expected: stGUNR"

echo "--- totalSupply ---"
cast call <MAINNET_PROXY> "totalSupply()(uint256)" --rpc-url https://mainnet.base.org
echo "Expected: 0"

echo "--- paused ---"
cast call <MAINNET_PROXY> "paused()(bool)" --rpc-url https://mainnet.base.org
echo "Expected: false"
```

If any value does NOT match expected, STOP and investigate. Do NOT proceed to the addresses.ts update until verified.

---

### Task 17: Update addresses.ts with mainnet gunrStaking proxy, commit

**Files:**
- Modify: `src/lib/contracts/addresses.ts`

- [ ] **Step 1: Replace the mainnet gunrStaking field**

In the `8453` (Base mainnet) section, find:
```ts
gunrStaking: "0x2F61D7EaC30E44ed33df3a441aDfC69C47Bd5B02",
```
Replace with the proxy from Task 15:
```ts
gunrStaking: "<MAINNET_PROXY>",
```

- [ ] **Step 2: Build + lint verify**

```bash
cd /Users/joshuagrubbs/Larry/GundariuM
npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/addresses.ts
git commit -m "$(cat <<'EOF'
feat(stake): wire up GUNRStaking V2 on Base mainnet

New mainnet proxy: <MAINNET_PROXY>
Implementation: <MAINNET_IMPL>

Replaces the empty GNDMStaking proxy 0x2F61D7E...48E7 (zero stake, bound
to the abandoned GNDM token). The old proxy stays on-chain as a tombstone.

Stake page goes live on next Vercel deploy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Push to GitHub → Vercel auto-deploys

- [ ] **Step 1: Push**

```bash
git push origin main
```

Vercel auto-deploys production from main. Check the Vercel dashboard for build progress (~1-2 min).

- [ ] **Step 2: Verify production**

Visit https://gundarium.xyz/stake in a browser. Expected:
- Full stake page (NOT the ComingSoon placeholder)
- Connect wallet works
- Pool TVL: 0
- APR: Inactive
- Stake/Unstake/Claim tabs all render

If the ComingSoon placeholder still shows after a hard refresh + 5 min, check that the addresses.ts commit pushed properly and Vercel built from the latest main commit.

---

### Task 19: Verify the implementation contract on Basescan [JOSHUA]

The proxy will inherit verification from the implementation once the implementation is verified.

- [ ] **Step 1: Fetch the Basescan API key from Doppler** (one-liner per [[reference_doppler_gundarium]]):

```bash
export BASESCAN_API_KEY=$(doppler secrets get BASESCAN_API_KEY --plain --project gundarium --config dev)
```

- [ ] **Step 2: Verify the implementation contract**

Replace `<MAINNET_IMPL>` with the address from Task 14:

```bash
cd /Users/joshuagrubbs/Larry/GundariuM/contracts
forge verify-contract <MAINNET_IMPL> src/GUNRStaking.sol:GUNRStaking \
  --chain base \
  --etherscan-api-key $BASESCAN_API_KEY \
  --watch
```

The implementation takes no constructor args. Expected: "Pass - Verified" within ~30-60s.

- [ ] **Step 3: Verify the proxy on Basescan (manual via web UI)**

After implementation verification:
1. Visit `https://basescan.org/proxyContractChecker?a=<MAINNET_PROXY>`
2. Click "Verify" — Basescan will detect ERC-1967 proxy pattern and link it to the implementation automatically

---

## Phase F — Post-launch (optional, Joshua-paced)

### Task 20: Seed initial reward pool [JOSHUA — optional, keystore]

If/when Joshua decides to fund initial rewards from his vault GUNR:

```bash
# Example: seed 100M GUNR over 90 days (~1.286M GUNR/day = ~14.88 GUNR/sec rate)
AMOUNT=100000000000000000000000000  # 100M with 18 decimals
DURATION=7776000                    # 90 days in seconds

# Approve first
cast send 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07 \
  "approve(address,uint256)" <MAINNET_PROXY> $AMOUNT \
  --account deployer --rpc-url https://mainnet.base.org

# Then notify
cast send <MAINNET_PROXY> \
  "notifyRewardAmount(uint256,uint256)" $AMOUNT $DURATION \
  --account deployer --rpc-url https://mainnet.base.org
```

This is optional and can be done any time. The contract works fine with zero rewards (users still get the lock + transferable receipt benefits, just no streaming yield until reward pool is seeded).

### Task 21: Smoke test on production [JOSHUA]

Connect a wallet holding GUNR to https://gundarium.xyz/stake. Stake a small amount (e.g., 10 GUNR). Verify:
- Stake transaction succeeds
- "Your Staked" updates to 10
- Lock countdown shows ~24h
- If reward pool seeded (Task 20): "Your Earned" begins ticking after a refresh

### Task 22: Optional Farcaster announce [JOSHUA]

Suggested cast from @pyrofirezero:

> $GUNR staking is live on Base. Stake your $GUNR at gundarium.xyz/stake — earn streaming $GUNR rewards while game contracts ship.
>
> 24h lock from each stake. Transferable stGUNR receipt token (liquid staking from day one). Reward pool seeded with [N] GUNR.
>
> Contract: <MAINNET_PROXY>

---

## Self-review notes

- **Spec coverage**: every section in the spec maps to at least one task (contract → Tasks 1-4, deploy script → Tasks 3-4, frontend → Tasks 9-11, Sepolia → Tasks 5-8, Sepolia test → Task 12, mainnet deploy → Tasks 13-17, verification → Task 19, post-launch → Tasks 20-22).
- **Two-`forge create` deploy pattern** is used instead of the `forge script` pattern from existing project scripts, per [[feedback_eip7702_deploy]] — each `forge create` is a single tx, EIP-7702 safe on Joshua's deployer wallet 0x9D62.
- **Frontend gates safely on placeholder address**: the `isPlaceholder` check renders the existing ComingSoon component if `gunrStaking` is `0x0000...0`, so this code can ship to main before mainnet deploy without breaking the live site.
- **Sepolia test in Task 12** requires a temporary local chainId toggle in the page file. This is documented as "do not commit" — it's a manual test scaffold only.
- **The OLD GNDMStaking proxy at `0x2F61D7E...48E7` stays on-chain** and in the codebase as a tombstone. No migration needed (zero stake) per [[project_staking_rework_spec]] and verified on-chain.
- **No reward pool funding is required at deploy time**. Joshua can choose to seed at any time post-deploy via Task 20. The contract works correctly with zero rewards (just no streaming yield).
