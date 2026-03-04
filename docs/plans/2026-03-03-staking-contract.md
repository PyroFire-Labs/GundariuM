# GNDMStaking Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy a UUPS-upgradeable GNDM staking contract with 24hr unstake lock, 7-day reward eligibility, and hybrid yield (owner top-up + game fee routing).

**Architecture:** Synthetix staking rewards pattern for O(1) yield accounting. 24hr lock enforced at stake time (not unstake). Rewards only claimable after 7 continuous days staked; re-staking resets the clock. Deployed as ERC1967Proxy, same pattern as PrizePool and GundaniumGame.

**Tech Stack:** Solidity ^0.8.24, Foundry, OpenZeppelin Upgradeable v5 (already in `contracts/lib/`), `forge script` for deployment.

---

### Task 1: Write GNDMStaking.sol

**Files:**
- Create: `contracts/src/GNDMStaking.sol`

**Step 1: Create the contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GNDMStaking
 * @notice Lock GNDM to earn tier access and staking rewards.
 *
 * Rules:
 *  - 24-hour lock: tokens cannot be unstaked within 24h of staking. Re-staking resets the clock.
 *  - 7-day reward eligibility: rewards only claimable after 7 days of continuous stake. Re-staking resets the clock.
 *  - Yield: Synthetix pattern. Owner can deposit reward pools; authorized contracts can route game fees in.
 */
contract GNDMStaking is OwnableUpgradeable, UUPSUpgradeable {

    // ─── Errors ─────────────────────────────────────────────────────────────

    error StillLocked(uint256 unlockTime);
    error NotEligibleYet(uint256 eligibleAt);
    error NoPendingRewards();
    error NoStakeToUnstake();
    error Unauthorized();
    error ZeroAmount();

    // ─── Events ─────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount, uint256 lockUntil, uint256 rewardEligibleAt);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount);
    event FeeRouterSet(address indexed addr, bool authorized);

    // ─── Constants ──────────────────────────────────────────────────────────

    uint256 private constant LOCK_DURATION    = 24 hours;
    uint256 private constant REWARD_DELAY     = 7 days;
    uint256 private constant PRECISION        = 1e18;

    // ─── State ──────────────────────────────────────────────────────────────

    IERC20 public gndm;

    // Staking balances
    mapping(address => uint256) public stakedBalance;
    uint256 public totalStaked;

    // Lockup timestamps
    mapping(address => uint256) public lockUntil;
    mapping(address => uint256) public rewardEligibleAt;

    // Synthetix yield accounting
    uint256 public rewardPerTokenStored;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public periodFinish;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // Fee routing
    mapping(address => bool) public authorizedFeeRouters;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address gndm_) external initializer {
        __Ownable_init(owner_);
        gndm = IERC20(gndm_);
    }

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastApplicableTime();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function lastApplicableTime() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + (lastApplicableTime() - lastUpdateTime) * rewardRate * PRECISION / totalStaked;
    }

    /**
     * @notice Returns 0 if user is not yet past their 7-day eligibility window.
     */
    function earned(address account) public view returns (uint256) {
        if (block.timestamp < rewardEligibleAt[account]) return 0;
        return stakedBalance[account]
            * (rewardPerToken() - userRewardPerTokenPaid[account]) / PRECISION
            + rewards[account];
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /**
     * @notice Stake GNDM. Resets 24h lock and 7-day reward eligibility.
     */
    function stake(uint256 amount) external updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();

        stakedBalance[msg.sender] += amount;
        totalStaked += amount;

        lockUntil[msg.sender]        = block.timestamp + LOCK_DURATION;
        rewardEligibleAt[msg.sender] = block.timestamp + REWARD_DELAY;

        // Reset pending reward snapshot so they don't get credit for the new 7-day window
        rewards[msg.sender] = 0;
        userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;

        require(gndm.transferFrom(msg.sender, address(this), amount), "GNDMStaking: transfer failed");

        emit Staked(msg.sender, amount, lockUntil[msg.sender], rewardEligibleAt[msg.sender]);
    }

    /**
     * @notice Unstake GNDM. Reverts if within 24h lock window.
     */
    function unstake(uint256 amount) external updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        if (stakedBalance[msg.sender] < amount) revert NoStakeToUnstake();
        if (block.timestamp < lockUntil[msg.sender]) revert StillLocked(lockUntil[msg.sender]);

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;

        require(gndm.transfer(msg.sender, amount), "GNDMStaking: transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Claim accrued rewards. Reverts if < 7 days since last stake.
     */
    function claimRewards() external updateReward(msg.sender) {
        if (block.timestamp < rewardEligibleAt[msg.sender]) {
            revert NotEligibleYet(rewardEligibleAt[msg.sender]);
        }
        uint256 reward = rewards[msg.sender];
        if (reward == 0) revert NoPendingRewards();

        rewards[msg.sender] = 0;
        require(gndm.transfer(msg.sender, reward), "GNDMStaking: reward transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit a reward pool. duration in seconds (e.g. 30 days = 2_592_000).
     *         Can be called again before period ends — remaining rewards roll over.
     */
    function notifyRewardAmount(uint256 amount, uint256 duration)
        external
        onlyOwner
        updateReward(address(0))
    {
        require(gndm.transferFrom(msg.sender, address(this), amount), "GNDMStaking: transfer failed");

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / duration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover  = remaining * rewardRate;
            rewardRate = (amount + leftover) / duration;
        }

        lastUpdateTime = block.timestamp;
        periodFinish   = block.timestamp + duration;

        emit RewardAdded(amount);
    }

    /**
     * @notice Route game fees into the reward pool (extends current period by fee amount).
     *         Called by authorized contracts (GundaniumGame, PrizePool).
     */
    function receiveGameFees(uint256 amount) external updateReward(address(0)) {
        if (!authorizedFeeRouters[msg.sender]) revert Unauthorized();
        require(gndm.transferFrom(msg.sender, address(this), amount), "GNDMStaking: transfer failed");

        // Treat like a top-up to current period (or start a 30-day period if none active)
        uint256 duration = block.timestamp >= periodFinish
            ? 30 days
            : periodFinish - block.timestamp;

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / duration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover  = remaining * rewardRate;
            rewardRate = (amount + leftover) / duration;
        }

        lastUpdateTime = block.timestamp;
        periodFinish   = block.timestamp + duration;

        emit RewardAdded(amount);
    }

    /**
     * @notice Grant or revoke fee routing authorization.
     */
    function setFeeRouter(address addr, bool authorized) external onlyOwner {
        authorizedFeeRouters[addr] = authorized;
        emit FeeRouterSet(addr, authorized);
    }

    /**
     * @notice Emergency token rescue (does not affect staking accounting).
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(owner(), amount), "GNDMStaking: withdraw failed");
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

**Step 2: Build to check for compile errors**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next/contracts && forge build 2>&1
```
Expected: `Compiler run successful` with no errors.

**Step 3: Commit**

```bash
git add contracts/src/GNDMStaking.sol
git commit -m "feat: GNDMStaking contract — 24hr lock, 7d reward eligibility, Synthetix yield"
```

---

### Task 2: Write DeployStaking.s.sol

**Files:**
- Create: `contracts/script/DeployStaking.s.sol`

**Step 1: Create the deploy script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GNDMStaking} from "../src/GNDMStaking.sol";

/**
 * @notice Deploys GNDMStaking as a UUPS proxy.
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY  — deployer / owner wallet
 *   GNDM_ADDRESS          — GNDM token address on target chain
 *
 * Usage (Base Sepolia):
 *   forge script script/DeployStaking.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Usage (Base Mainnet):
 *   forge script script/DeployStaking.s.sol \
 *     --rpc-url $BASE_MAINNET_RPC \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract DeployStaking is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);
        address gndm        = vm.envAddress("GNDM_ADDRESS");

        console.log("=== GNDMStaking Deploy ===");
        console.log("Deployer: ", deployer);
        console.log("GNDM:     ", gndm);
        console.log("Chain ID: ", block.chainid);

        vm.startBroadcast(deployerKey);

        GNDMStaking impl = new GNDMStaking();
        bytes memory initData = abi.encodeCall(GNDMStaking.initialize, (deployer, gndm));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console.log("\n=== Deployment complete ===");
        console.log("GNDMStaking proxy: ", address(proxy));
        console.log("\nNext steps:");
        console.log("1. Paste proxy address into src/lib/contracts/addresses.ts");
        console.log("2. Update frontend ABI (GNDMStaking.ts)");
        console.log("3. Deploy frontend");
    }
}
```

**Step 2: Build to verify script compiles**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next/contracts && forge build 2>&1
```
Expected: `Compiler run successful`

**Step 3: Commit**

```bash
git add contracts/script/DeployStaking.s.sol
git commit -m "feat: DeployStaking script for Base Sepolia and mainnet"
```

---

### Task 3: Update Frontend ABI

The existing `GNDMStaking.ts` ABI only has `stake`, `unstake`, `stakedBalance`, `totalStaked`. Expand it to include all new functions and events.

**Files:**
- Modify: `src/lib/contracts/abis/GNDMStaking.ts`

**Step 1: Replace the file**

```ts
export const GNDM_STAKING_ABI = [
  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "stakedBalance",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalStaked",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "earned",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lockUntil",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rewardEligibleAt",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rewardPerToken",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "periodFinish",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "stake",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unstake",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRewards",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Staked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "lockUntil", type: "uint256", indexed: false },
      { name: "rewardEligibleAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Unstaked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
```

**Step 2: Type-check**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next && npx tsc --noEmit 2>&1
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/lib/contracts/abis/GNDMStaking.ts
git commit -m "feat: expand GNDMStaking ABI with earned, lockUntil, rewardEligibleAt, claimRewards, events"
```

---

### Task 4: Update useStaking Hook

Add `earned`, `lockUntil`, `rewardEligibleAt` reads and expose `claimRewards`.

**Files:**
- Modify: `src/lib/contracts/hooks/useStaking.ts`

**Step 1: Replace the hook**

```ts
"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, usePublicClient, useAccount, useChainId } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { ERC20_ABI } from "@/lib/contracts/abis/ERC20";
import { GNDM_STAKING_ABI } from "@/lib/contracts/abis/GNDMStaking";
import { getContracts, GNDM_TOKEN_ADDRESS, isPlaceholder } from "@/lib/contracts/addresses";

export const TIERS = [
  { name: "Recruit",   min: 1_000_000,   unlocks: ["Dashboard access"] },
  { name: "Sergeant",  min: 5_000_000,   unlocks: ["⚔️ PVP", "🏆 Leaderboard"] },
  { name: "Commander", min: 25_000_000,  unlocks: ["Prize pool multiplier"] },
  { name: "Legend",    min: 100_000_000, unlocks: ["Exclusive status", "All perks"] },
] as const;

export type TierName = typeof TIERS[number]["name"];

export function getTier(stakedGndm: number): TierName | null {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (stakedGndm >= TIERS[i].min) return TIERS[i].name;
  }
  return null;
}

export type StakePhase =
  | "idle"
  | "approving"
  | "staking"
  | "unstaking"
  | "claiming"
  | "done"
  | "error";

export function useStaking() {
  const [phase, setPhase] = useState<StakePhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported chain */ }

  const stakingAddress = contracts?.gndmStaking;
  const contractReady = !!stakingAddress && !isPlaceholder(stakingAddress);

  // ─── Reads ────────────────────────────────────────────────────────────────

  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: GNDM_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: stakedRaw, refetch: refetchStaked } = useReadContract({
    address: stakingAddress,
    abi: GNDM_STAKING_ABI,
    functionName: "stakedBalance",
    args: address ? [address] : undefined,
    query: { enabled: contractReady && !!address },
  });

  const { data: totalStakedRaw } = useReadContract({
    address: stakingAddress,
    abi: GNDM_STAKING_ABI,
    functionName: "totalStaked",
    query: { enabled: contractReady },
  });

  const { data: earnedRaw, refetch: refetchEarned } = useReadContract({
    address: stakingAddress,
    abi: GNDM_STAKING_ABI,
    functionName: "earned",
    args: address ? [address] : undefined,
    query: { enabled: contractReady && !!address },
  });

  const { data: lockUntilRaw } = useReadContract({
    address: stakingAddress,
    abi: GNDM_STAKING_ABI,
    functionName: "lockUntil",
    args: address ? [address] : undefined,
    query: { enabled: contractReady && !!address },
  });

  const { data: rewardEligibleAtRaw } = useReadContract({
    address: stakingAddress,
    abi: GNDM_STAKING_ABI,
    functionName: "rewardEligibleAt",
    args: address ? [address] : undefined,
    query: { enabled: contractReady && !!address },
  });

  // ─── Derived values ───────────────────────────────────────────────────────

  const balance          = balanceRaw !== undefined ? parseFloat(formatUnits(balanceRaw, 18)) : 0;
  const staked           = stakedRaw !== undefined ? parseFloat(formatUnits(stakedRaw, 18)) : 0;
  const totalStaked      = totalStakedRaw !== undefined ? parseFloat(formatUnits(totalStakedRaw, 18)) : 0;
  const earnedRewards    = earnedRaw !== undefined ? parseFloat(formatUnits(earnedRaw, 18)) : 0;
  const lockUntil        = lockUntilRaw ? Number(lockUntilRaw) : 0;        // unix seconds
  const rewardEligibleAt = rewardEligibleAtRaw ? Number(rewardEligibleAtRaw) : 0; // unix seconds
  const tier             = getTier(staked);

  const nowSec = Math.floor(Date.now() / 1000);
  const isLocked          = lockUntil > nowSec;
  const isRewardEligible  = rewardEligibleAt > 0 && nowSec >= rewardEligibleAt;

  // ─── Actions ──────────────────────────────────────────────────────────────

  const stake = async (amount: string) => {
    if (!contracts || !contractReady) return;
    setPhase("approving");
    setError(null);
    if (!publicClient) {
      setError("Wallet not connected to a supported network");
      setPhase("error");
      return;
    }
    try {
      const amountWei = parseUnits(amount, 18);
      const approveTx = await writeContractAsync({
        address: GNDM_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contracts.gndmStaking, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      setPhase("staking");
      const stakeTx = await writeContractAsync({
        address: contracts.gndmStaking,
        abi: GNDM_STAKING_ABI,
        functionName: "stake",
        args: [amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: stakeTx });

      setPhase("done");
      void refetchBalance();
      void refetchStaked();
      void refetchEarned();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Staking failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  };

  const unstake = async (amount: string) => {
    if (!contracts || !contractReady) return;
    setPhase("unstaking");
    setError(null);
    if (!publicClient) {
      setError("Wallet not connected to a supported network");
      setPhase("error");
      return;
    }
    try {
      const amountWei = parseUnits(amount, 18);
      const tx = await writeContractAsync({
        address: contracts.gndmStaking,
        abi: GNDM_STAKING_ABI,
        functionName: "unstake",
        args: [amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setPhase("done");
      void refetchBalance();
      void refetchStaked();
      void refetchEarned();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unstake failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  };

  const claimRewards = async () => {
    if (!contracts || !contractReady) return;
    setPhase("claiming");
    setError(null);
    if (!publicClient) {
      setError("Wallet not connected to a supported network");
      setPhase("error");
      return;
    }
    try {
      const tx = await writeContractAsync({
        address: contracts.gndmStaking,
        abi: GNDM_STAKING_ABI,
        functionName: "claimRewards",
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setPhase("done");
      void refetchBalance();
      void refetchEarned();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Claim failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  };

  return {
    balance,
    staked,
    totalStaked,
    earnedRewards,
    lockUntil,
    rewardEligibleAt,
    isLocked,
    isRewardEligible,
    tier,
    phase,
    error,
    contractReady,
    stake,
    unstake,
    claimRewards,
    reset: () => { setPhase("idle"); setError(null); },
  };
}
```

**Step 2: Type-check**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next && npx tsc --noEmit 2>&1
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/lib/contracts/hooks/useStaking.ts
git commit -m "feat: useStaking — add earned, lockUntil, rewardEligibleAt reads and claimRewards action"
```

---

### Task 5: Update Staking Page UI

Add lock status, reward eligibility countdown, earned rewards display, and claim button.

**Files:**
- Modify: `src/app/stake/page.tsx`

**Step 1: Add lock/reward info and claim section**

Find the stats bar section and update it to show lock status and earned rewards. Find the panel and add a claim rewards card after the stake/unstake panel.

Replace the stats bar grid:
```tsx
{/* Stats bar */}
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
  {[
    { label: "GNDM Balance", value: isConnected ? fmt(balance) : "—" },
    { label: "Staked",       value: isConnected ? fmt(staked)  : "—" },
    { label: "Your Tier",    value: tier ?? "None" },
    { label: "Earned",       value: isConnected && contractReady ? fmt(earnedRewards) : "—" },
  ].map((s) => (
    <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
      <div className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-1">{s.label}</div>
      <div className="font-[family-name:var(--font-orbitron)] font-black text-[var(--accent)] text-lg">{s.value}</div>
    </div>
  ))}
</div>
```

Add after the stake/unstake panel (before closing `</div>` of max-w-2xl):
```tsx
{/* Lock & reward status */}
{isConnected && contractReady && staked > 0 && (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
    <h2 className="font-[family-name:var(--font-orbitron)] text-xs font-black text-[var(--foreground)]/40 tracking-widest uppercase">
      Status
    </h2>
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between">
        <span className="text-[var(--foreground)]/50">Unlock in</span>
        <span className={isLocked ? "text-yellow-400 font-bold" : "text-green-400 font-bold"}>
          {isLocked
            ? `${Math.ceil((lockUntil - Math.floor(Date.now() / 1000)) / 3600)}h remaining`
            : "Unlocked ✓"}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[var(--foreground)]/50">Rewards eligible in</span>
        <span className={isRewardEligible ? "text-green-400 font-bold" : "text-[var(--accent)] font-bold"}>
          {isRewardEligible
            ? "Eligible ✓"
            : `${Math.ceil((rewardEligibleAt - Math.floor(Date.now() / 1000)) / 86400)}d remaining`}
        </span>
      </div>
    </div>
  </div>
)}

{/* Claim rewards */}
{isConnected && contractReady && isRewardEligible && earnedRewards > 0 && (
  <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-[family-name:var(--font-orbitron)] text-xs text-[var(--foreground)]/40 uppercase tracking-widest">
          Claimable Rewards
        </p>
        <p className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)]">
          {fmt(earnedRewards)} GNDM
        </p>
      </div>
      <button
        onClick={claimRewards}
        disabled={phase === "claiming"}
        className="rounded-lg bg-[var(--accent)] text-black font-bold py-2 px-5 hover:brightness-110 transition-all disabled:opacity-50 font-[family-name:var(--font-orbitron)] tracking-wider text-sm"
      >
        {phase === "claiming" ? "Claiming…" : "CLAIM"}
      </button>
    </div>
  </div>
)}
```

**Step 2: Update imports — add `claimRewards`, `earnedRewards`, `lockUntil`, `rewardEligibleAt`, `isLocked`, `isRewardEligible` from hook**

Replace the destructure line:
```tsx
const { balance, staked, totalStaked, tier, phase, error, contractReady, stake, unstake, reset } = useStaking();
```
With:
```tsx
const {
  balance, staked, totalStaked, earnedRewards,
  lockUntil, rewardEligibleAt, isLocked, isRewardEligible,
  tier, phase, error, contractReady,
  stake, unstake, claimRewards, reset,
} = useStaking();
```

**Step 3: Type-check**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next && npx tsc --noEmit 2>&1
```
Expected: no errors

**Step 4: Commit**

```bash
git add src/app/stake/page.tsx
git commit -m "feat: staking page — lock status, reward eligibility countdown, claim rewards panel"
```

---

### Task 6: Deploy to Base Sepolia (Testnet)

**Step 1: Set env vars**

Make sure `contracts/.env` has:
```
DEPLOYER_PRIVATE_KEY=<your key>
GNDM_ADDRESS=0x6Add3cF424f9D2927721B13110164a3e019efFa4   # MockGNDM on Base Sepolia
BASE_SEPOLIA_RPC=https://sepolia.base.org
```

**Step 2: Run deploy**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next/contracts && \
forge script script/DeployStaking.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --verify \
  -vvvv 2>&1
```

Expected output includes:
```
GNDMStaking proxy:  0x<address>
```

**Step 3: Update testnet address**

In `src/lib/contracts/addresses.ts`, replace the Base Sepolia `gndmStaking` placeholder:
```ts
84532: {
  ...
  gndmStaking: "0x<proxy address from above>",
},
```

**Step 4: Type-check and commit**

```bash
npx tsc --noEmit && \
git add src/lib/contracts/addresses.ts && \
git commit -m "chore: add GNDMStaking proxy address for Base Sepolia testnet"
```

---

### Task 7: Deploy to Base Mainnet

Only after testnet verification passes.

**Step 1: Set env vars**

Make sure `contracts/.env` has:
```
GNDM_ADDRESS=0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3   # real GNDM on mainnet
BASE_MAINNET_RPC=https://mainnet.base.org
```

**Step 2: Run deploy**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next/contracts && \
forge script script/DeployStaking.s.sol \
  --rpc-url $BASE_MAINNET_RPC \
  --broadcast \
  --verify \
  -vvvv 2>&1
```

**Step 3: Update mainnet address**

In `src/lib/contracts/addresses.ts`, replace the Base mainnet `gndmStaking` placeholder:
```ts
8453: {
  ...
  gndmStaking: "0x<proxy address from above>",
},
```

**Step 4: Type-check, commit, deploy frontend**

```bash
npx tsc --noEmit && \
git add src/lib/contracts/addresses.ts && \
git commit -m "feat: GNDMStaking live on Base mainnet" && \
npx vercel --prod
```

After deploy, visit https://gundarium.vercel.app/stake and verify:
- [ ] "STAKING CONTRACT COMING SOON" banner is GONE
- [ ] Stats bar shows live GNDM balance
- [ ] Stake tab works (approve + stake flow)
- [ ] After 24h: unstake works
- [ ] After 7d: earned rewards show, claim button appears
