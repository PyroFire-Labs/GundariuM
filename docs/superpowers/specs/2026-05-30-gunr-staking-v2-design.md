# GUNR Staking V2 — Design Spec

**Date:** 2026-05-30
**Status:** Awaiting Joshua review (pivot from Superfluid noted below)
**Supersedes:** [[project_staking_rework_spec]] (the May 22 design intent)

---

## Pivot note — please read first

The May 22 design intent was "Superfluid-from-day-one." During this brainstorm I worked through the technical reality with Joshua. The fork that forced the pivot:

**Superfluid GDA's `pool.claimAll(member)` always sends GUNRx to the member's wallet.** There is no "claim on behalf, to a different address" function. Combined with Joshua's UX requirement that **rewards must arrive in the user's wallet as clean GUNR (not GUNRx)**, this leaves only awkward implementation paths:

| Path | Trade-off |
|---|---|
| User receives GUNRx in wallet | Wallets don't display GUNRx well. Worse UX than auto-unwrap. Joshua rejected. |
| Extra `approve+pull` after each claim | UX wart — user needs a second wallet transaction every claim. |
| Contract is sole pool member, re-implements distribution math | Defeats purpose of using GDA. |

**Pivot decision:** drop Superfluid for V2. Use Synthetix-style `rewardPerToken` accounting in GUNR directly. Per-second UI updates still work (computed from time + rate). Clean GUNR on claim with no wrap/unwrap user-facing. Superfluid integration becomes a possible V3 if streaming-to-wallet is ever desired for advanced wallets (e.g., Streme-aware ones).

**Joshua can override on review** and I'll redo with the awkward `approve+pull` flow if Superfluid is non-negotiable.

---

## Overview

A fresh `GUNRStaking` contract that lets GUNR holders stake for streaming GUNR rewards. Replaces the empty `GNDMStaking` proxy at `0x2F61D7E...48E7` (which is bound to the abandoned GNDM token and has zero stake) with a new deploy at a new address. The contract IS the `stGUNR` receipt token: fully transferable, 1:1 with the user's stake.

Reward distribution uses Synthetix `rewardPerToken` accounting — per-second math derived from time + rate, so the frontend can poll once a second and show smoothly ticking earnings. Reward source: owner can deposit GUNR directly, and authorized game contracts (future GundaniumGame, PrizePool, etc.) can route fees in.

## Locked decisions

| Decision | Value | Rationale |
|---|---|---|
| **Architecture** | Synthetix `rewardPerToken` (no Superfluid) | See pivot note above |
| **Receipt token** | The contract itself IS `stGUNR`; transferable ERC-20 | User-visible artifact; composable; recovery-friendly per [[user_joshua]]'s wallet-corruption story |
| **Lock rule** | 24h from stake; resets on every additional stake (Streme.fun model) | Joshua confirmed pure Streme model |
| **Lock semantics** | Per-account `lockUntil`; transfers do not carry lock state | Prioritizes transferability and wallet-recovery use cases. A user who transfers stGUNR to a fresh address can unstake there without inheriting the original lock; the trade-off is accepted as part of the transferable-receipt design. |
| **Funding sources** | Owner `notifyRewardAmount` + authorized `receiveGameFees` | Same dual-source pattern as v1 |
| **No 7-day eligibility window** | Rewards accrue per-second from stake-block | Discrete cycle concept gone; streaming math handles continuous accrual |
| **Code structure** | Single contract: `GUNRStaking` inherits ERC20+Ownable+Pausable+UUPS | Direct, fewer cross-contract calls |
| **Deploy strategy** | Fresh address (don't UUPS-upgrade the empty GNDMStaking proxy) | The existing proxy is GNDM-bound; clean break is simpler than reinitializer dance |
| **Pre-deploy strategy** | Sepolia rehearsal before mainnet | Lower risk; existing Sepolia infra in place |
| **Old GNDMStaking proxy** | Leave as tombstone | Has zero stake, zero balance; harmless |
| **UUPS policy** | Per [[feedback_uups_default]] this contract IS UUPS | Established policy |

---

## Contract design

### Inheritance

```solidity
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GUNRStaking is
    ERC20Upgradeable,        // stGUNR
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
```

`ReentrancyGuard` (not upgradeable variant) is safe per existing project pattern (see GNDMStaking.sol comment) — OZ v5 ReentrancyGuard uses ERC-7201 namespaced storage.

### State

```solidity
IERC20 public gunr;

// Synthetix yield accounting
uint256 public rewardPerTokenStored;
uint256 public rewardRate;              // GUNR per second
uint256 public lastUpdateTime;
uint256 public periodFinish;

mapping(address => uint256) public userRewardPerTokenPaid;
mapping(address => uint256) public rewards;

// Per-account lock
mapping(address => uint256) public lockUntil;

// Fee router authorization
mapping(address => bool) public authorizedFeeRouters;

// Constants
uint256 public constant LOCK_DURATION = 24 hours;
uint256 private constant PRECISION = 1e18;

// Storage gap
uint256[40] private __gap;
```

No `stakedBalance` mapping — replaced by inherited `balanceOf`. No `totalStaked` field — replaced by inherited `totalSupply` (alias view provided for v1 compatibility).

### Events

```solidity
event Staked(address indexed user, uint256 amount, uint256 lockUntil);
event Unstaked(address indexed user, uint256 amount);
event Claimed(address indexed user, uint256 amount);
event RewardAdded(uint256 amount, uint256 duration);
event FeeRouterSet(address indexed router, bool authorized);
event TokenRecovered(address indexed token, address indexed to, uint256 amount);
```

ERC-20 `Transfer` and `Approval` events come from inheritance. `Paused/Unpaused/OwnershipTransferred` come from inheritance.

### Custom errors

```solidity
error StillLocked(uint256 unlockTime);
error ZeroAmount();
error ZeroAddress();
error Unauthorized();
error InsufficientStakeBalance();
error CannotRescueStakedToken();
error DurationTooLong();
```

### Initializer

```solidity
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
```

OZ Ownable v5 catches `owner_ == address(0)` itself via `OwnableInvalidOwner`.

### Modifier — `updateReward`

```solidity
modifier updateReward(address account) {
    rewardPerTokenStored = rewardPerToken();
    lastUpdateTime = lastApplicableTime();
    if (account != address(0)) {
        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
    _;
}
```

Standard Synthetix pattern. Reads current accounting, updates checkpoint, then runs the function body.

### Views

```solidity
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
```

### User functions

```solidity
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
```

### ERC-20 transfer hook

```solidity
function _update(address from, address to, uint256 value) internal override {
    // updateReward semantics for both parties; address(0) on mint/burn handled by skipping
    if (from != address(0)) {
        rewards[from] = earned(from);
        userRewardPerTokenPaid[from] = rewardPerToken();
    }
    if (to != address(0)) {
        rewards[to] = earned(to);
        userRewardPerTokenPaid[to] = rewardPerToken();
    }
    // Update global checkpoint before balance changes so the math above is consistent
    rewardPerTokenStored = rewardPerToken();
    lastUpdateTime = lastApplicableTime();
    super._update(from, to, value);
}
```

This is the load-bearing hook for transferable stGUNR. Every transfer (including stake-mint and unstake-burn) snapshots both parties' earned rewards BEFORE the balance change, then commits the global checkpoint. After the parent's `_update` runs, balances are correct and the next interaction will compute from the new state.

Note: transfers do not modify `lockUntil`. The lock follows the account, not the tokens. The recipient is bound by their own `lockUntil` (or none, if they have never staked). See the locked decisions table for the rationale.

### Admin functions

```solidity
function notifyRewardAmount(uint256 amount, uint256 duration)
    external nonReentrant onlyOwner updateReward(address(0))
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
    } else {
        uint256 remaining = periodFinish - block.timestamp;
        rewardRate = (amount + remaining * rewardRate) / remaining;
        // periodFinish stays the same — fees distributed over existing window
    }

    lastUpdateTime = block.timestamp;
    emit RewardAdded(amount, periodFinish - block.timestamp);
}

function setFeeRouter(address router, bool authorized) external onlyOwner {
    if (router == address(0)) revert ZeroAddress();
    authorizedFeeRouters[router] = authorized;
    emit FeeRouterSet(router, authorized);
}

function pause() external onlyOwner { _pause(); }
function unpause() external onlyOwner { _unpause(); }

function recoverToken(address token, address to, uint256 amount)
    external nonReentrant onlyOwner
{
    if (to == address(0)) revert ZeroAddress();
    // Block draining staked GUNR — staked balance = totalSupply of stGUNR.
    // GUNR held above totalSupply is reward pool, free to recover.
    if (token == address(gunr)) {
        uint256 available = gunr.balanceOf(address(this)) - totalSupply();
        if (amount > available) revert CannotRescueStakedToken();
    }
    IERC20(token).safeTransfer(to, amount);
    emit TokenRecovered(token, to, amount);
}

function _authorizeUpgrade(address) internal override onlyOwner {}
```

`recoverToken`'s gunr-guard math: `gunr.balanceOf(this) = staked_gunr + reward_pool`. Since 1 stGUNR = 1 staked GUNR, `staked_gunr = totalSupply()`. So `reward_pool = balance - totalSupply()`. Owner can rescue any amount up to that pool but cannot dip into the staked principal.

---

## Tests (Foundry)

`contracts/test/GUNRStaking.t.sol`:

| Test | Asserts |
|---|---|
| `test_initialize_setsState` | gunr, owner, name/symbol all correct |
| `test_initialize_zeroOwner_reverts` | OZ Ownable selector |
| `test_initialize_zeroGunr_reverts` | ZeroAddress |
| `test_stake_happyPath` | balance, totalSupply, gunr transfer, lock set, event |
| `test_stake_zeroAmount_reverts` | ZeroAmount |
| `test_stake_resetsLock` | second stake pushes lockUntil forward (Streme rule) |
| `test_unstake_happyPath` | burn, gunr transfer back, event |
| `test_unstake_revertsBeforeLock` | StillLocked with correct unlock time |
| `test_unstake_succeedsAtExactUnlock` | block.timestamp == lockUntil works |
| `test_unstake_overBalance_reverts` | InsufficientStakeBalance |
| `test_transfer_movesEarningRights` | A stakes, accrues, transfers to B; A's earned freezes, B's begins |
| `test_transfer_doesNotMoveLock` | B inherits no lock from A; can unstake immediately if their own lock is clear |
| `test_transfer_then_unstake_byRecipient` | B receives stGUNR via transfer; unstakes it; gets GUNR |
| `test_claim_sendsGUNR_zeroesReward` | gunr sent, rewards[user] = 0, event fired |
| `test_claim_zero_returnsZero` | no revert, returns 0 |
| `test_notifyRewardAmount_setsRate` | rate = amount/duration when no active period |
| `test_notifyRewardAmount_extendsActivePeriod` | mid-period notify rolls leftover into new rate |
| `test_notifyRewardAmount_onlyOwner_reverts` | OwnableUnauthorizedAccount |
| `test_notifyRewardAmount_durationTooLong_reverts` | DurationTooLong over 365 days |
| `test_receiveGameFees_onlyAuthorized_reverts` | Unauthorized |
| `test_receiveGameFees_inActivePeriod_keepsFinish` | periodFinish unchanged, rate adjusts |
| `test_setFeeRouter_grantsAndRevokes` | authorizedFeeRouters mapping updates, event |
| `test_pause_blocksUserFunctions` | EnforcedPause for stake/unstake/claim |
| `test_pause_doesNotBlockAdmin` | notifyReward and setFeeRouter still work |
| `test_recoverToken_blocksStakedGunr` | when balance == totalSupply, cannot recover any gunr |
| `test_recoverToken_allowsRewardPoolGunr` | when balance > totalSupply, can recover the surplus |
| `test_recoverToken_arbitraryToken_works` | other tokens can be drained anytime |
| `test_recoverToken_zeroAddress_reverts` | ZeroAddress |
| `test_upgrade_onlyOwner_reverts` | OwnableUnauthorizedAccount on _authorizeUpgrade |
| `test_earned_perSecond_smoothness` | warp by N seconds, earned grows linearly with rate |
| `test_lockRemaining_view` | returns 0 if unlocked, otherwise remaining seconds |
| `test_storageLayout_upgradeSafe` | __gap is in expected slot (for future UUPS upgrades) |

---

## Frontend changes

**File:** `src/app/stake/page.tsx` (currently a `ComingSoon` placeholder)

Replace with full stake/unstake/claim UI:

- **Header**: page title "GUNR STAKING", connected wallet badge
- **Stats grid (4 cards)**:
  - Your Staked (stGUNR balance)
  - Your Earned (live ticking via 1s polling of `earned(user)` view)
  - Pool TVL (totalSupply)
  - Stream Rate (annualized as APR if periodFinish > now, else "Inactive")
- **Tabs**: Stake / Unstake / Claim
  - **Stake tab**: amount input, MAX = user's GUNR balance, two-tx flow (Approve → Stake)
  - **Unstake tab**: amount input, MAX = user's stGUNR balance, single Unstake tx, disabled-with-countdown if locked
  - **Claim tab**: shows current earned (live), Claim button (single tx, sends GUNR)
- **Lock countdown widget** shown when applicable (under Unstake tab)
- **Mobile-first layout** matching existing site patterns

All `useReadContract` and `useWriteContract` calls pin `chainId: base.id` per [[feedback]] from the migration v2 mini-app bug.

**Frontend ABI file:** `src/lib/contracts/abis/GUNRStaking.ts` — new file (the old GNDMStaking ABI stays if anything else uses it; remove if not).

**Addresses registry:** `src/lib/contracts/addresses.ts` — `gunrStaking` field replaced with new V2 mainnet address post-deploy. Old GNDMStaking proxy address moved to a comment as a tombstone.

---

## Sepolia rehearsal (separate from mainnet plan)

Before mainnet, deploy to Base Sepolia and run the full happy + edge-case suite against the real chain:

1. Deploy `GUNRStaking` to Sepolia via `forge create` with `--account deployer`
2. Update Sepolia `addresses.ts` field, deploy frontend to a Sepolia preview branch
3. Use existing Sepolia mock GUNR (`0x6Add3cF424f9D2927721B13110164a3e019efFa4`) for testing
4. Manual test pass: stake, transfer stGUNR between two test wallets, transfer-then-unstake by recipient, claim, pause/unpause, owner notifyRewardAmount, recoverToken edge cases
5. Verify storage layout is upgrade-safe (capture state hash, redeploy implementation, verify state survives)
6. Only after all Sepolia tests pass: deploy to mainnet

---

## Migration / coordination

**Nothing to migrate.** The current GNDMStaking proxy has zero stake and zero balance. Old proxy stays on-chain as a tombstone. Frontend cuts over to new address at deploy time.

**Existing GUNR holders** can stake as soon as the contract is deployed and frontend is updated. No coordination needed beyond a Farcaster announce.

---

## Out of scope (explicit non-goals)

- **Superfluid integration** — possible V3 if streaming-to-wallet UX ever becomes valuable for Streme-aware wallets
- **Cross-chain staking** — Base mainnet only
- **NFT-backed staking** — Gundar-Frame NFTs as collateral / tier modifiers — separate feature
- **Variable lock duration tiers** — flat 24h for V2, tiered locks could be V3
- **Auto-compounding** — claim is manual; user decides when to claim

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Owner key compromise** | Same as all other admin-gated contracts. Mitigated by Joshua's keystore practice per [[feedback_deploy_safety]]. |
| **Math precision loss in rewardPerToken** | PRECISION = 1e18 standard; matches v1 GNDMStaking which has been deployed without issue |
| **Pause leaves rewards accruing while users can't claim** | Acceptable — pause is for emergency only. Owner unpauses or recovers. |
| **Lock bypass via transfer to a fresh address** | Explicit design choice. The 24-hour lock is per-account; transferring stGUNR to an address with no prior stake permits immediate unstake by the recipient. This is the accepted trade-off for transferability and wallet-recovery use cases. |
| **Reward pool runs dry mid-period** | rewardRate continues math-wise; safeTransfer reverts on actual claim if contract has insufficient GUNR. Owner can top up via notifyReward. |
| **First mainnet contract with this rewards-distribution pattern at scale on the project** | Sepolia rehearsal catches integration issues before mainnet |

---

## Affected files

| File | Action |
|---|---|
| `contracts/src/GUNRStaking.sol` | New file |
| `contracts/test/GUNRStaking.t.sol` | New file |
| `contracts/script/DeployGUNRStaking.s.sol` | New file (or extend existing DeployStaking.s.sol) |
| `contracts/src/GNDMStaking.sol` | Leave (tombstone reference; not deleted) |
| `contracts/test/GNDMStaking.t.sol` | Leave (still passes against v1; not deleted) |
| `src/app/stake/page.tsx` | Replace `ComingSoon` with full UI |
| `src/lib/contracts/abis/GUNRStaking.ts` | New file |
| `src/lib/contracts/abis/GNDMStaking.ts` | Delete if exists and is unused |
| `src/lib/contracts/addresses.ts` | Update `gunrStaking` field post-deploy on both Sepolia and mainnet |
