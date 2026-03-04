# GNDMStaking Contract — Design Doc
_2026-03-03_

## Overview

A UUPS-upgradeable staking contract on Base mainnet. Users lock GNDM to earn tier-based access to PVP, leaderboards, and future community features. Yield is hybrid: owner can top up a reward pool manually, and authorized game contracts can route fees in automatically. Staking is designed to signal long-term commitment — tokens are locked for 24 hours and rewards require a full 7-day stake before becoming claimable.

---

## Architecture

- **Pattern:** UUPS upgradeable proxy (ERC1967), same as GunplaCard, GundaniumGame, PrizePool
- **Yield mechanics:** Synthetix staking rewards pattern — O(1) per user, no loops
- **Chain:** Base mainnet (8453)
- **Token:** GNDM — `0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3`

---

## State

```solidity
IERC20 public gndm;

mapping(address => uint256) public stakedBalance;
uint256 public totalStaked;

// Lockup
mapping(address => uint256) public lockUntil;          // timestamp: can't unstake before this
mapping(address => uint256) public rewardEligibleAt;   // timestamp: rewards claimable after this

// Synthetix yield
uint256 public rewardPerTokenStored;
uint256 public rewardRate;          // tokens per second currently emitting
uint256 public lastUpdateTime;
uint256 public periodFinish;        // when current reward period ends

mapping(address => uint256) public userRewardPerTokenPaid;
mapping(address => uint256) public rewards;

// Fee routing
mapping(address => bool) public authorizedFeeRouters;
```

---

## Functions

### User-facing

| Function | Description |
|----------|-------------|
| `stake(uint256 amount)` | Transfer GNDM in. Sets `lockUntil = now + 24h`, `rewardEligibleAt = now + 7d`. Re-staking resets both clocks. |
| `unstake(uint256 amount)` | Reverts if `block.timestamp < lockUntil`. Transfers tokens back immediately. Tier drops automatically (derived from `stakedBalance`). |
| `claimRewards()` | Reverts if `block.timestamp < rewardEligibleAt`. Transfers accrued GNDM rewards to caller. |
| `earned(address)` | View: returns 0 if before `rewardEligibleAt`, else accumulated rewards. |

### Admin

| Function | Description |
|----------|-------------|
| `notifyRewardAmount(uint256, uint256 duration)` | Owner deposits GNDM reward pool. Sets `rewardRate = amount / duration`. |
| `receiveGameFees(uint256 amount)` | Called by authorized contracts to route game fees into rewards. |
| `setFeeRouter(address, bool)` | Owner grants/revokes fee routing authorization. |
| `emergencyWithdraw(address token, uint256 amount)` | Owner rescue for stuck tokens. |

---

## Lockup & Reward Eligibility

**24-hour lock:**
- Starts at `stake()` time, not unstake time
- `unstake()` reverts with `StillLocked(unlockTime)` if too early
- Re-staking resets the 24hr clock

**7-day reward eligibility:**
- `claimRewards()` reverts with `NotEligibleYet(eligibleAt)` if < 7 days since last stake
- Re-staking resets the 7-day clock
- Designed to filter out mercenary stakers and reward committed holders

**Unstake is immediate** — single call, no two-step request/withdraw pattern.

---

## Events

```solidity
event Staked(address indexed user, uint256 amount, uint256 lockUntil, uint256 rewardEligibleAt);
event Unstaked(address indexed user, uint256 amount);
event RewardClaimed(address indexed user, uint256 amount);
event RewardAdded(uint256 amount);
event FeeRouterSet(address indexed addr, bool authorized);
```

## Custom Errors

```solidity
error StillLocked(uint256 unlockTime);
error NotEligibleYet(uint256 eligibleAt);
error NoPendingRewards();
error NoStakeToUnstake();
error Unauthorized();
```

---

## Deployment

- New script: `contracts/script/DeployStaking.s.sol`
- Standalone — does not redeploy other contracts
- Reads `DEPLOYER_PRIVATE_KEY` and `GNDM_ADDRESS` from env
- Deploys implementation + ERC1967Proxy, logs proxy address
- After deploy: paste address into `src/lib/contracts/addresses.ts` and redeploy frontend

**Deploy order:**
1. Deploy to Base Sepolia, verify contract on Basescan
2. Manual smoke test (stake, wait 24h, unstake; stake, wait 7d, claim)
3. Deploy to Base mainnet

---

## Out of Scope

- Unit tests (manual verification on testnet first)
- Fee split percentages from game contracts (wired up after game launches)
- Community page gating (frontend, separate task)
- Farcaster mini app (next major phase after community pages)
