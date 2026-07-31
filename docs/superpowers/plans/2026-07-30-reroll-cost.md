# Reroll Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charge 60,000 GNRM (burned) to reroll on the mint flow's reveal screen, replacing today's free full-flow-reset REROLL button with a paid in-place regenerate.

**Architecture:** A new UUPS-upgradeable `RerollBurner.sol` contract burns GNRM and tracks reroll counts/totals on-chain; the frontend approves + calls it, then signs a message proving wallet ownership and calls `/api/generate-kitbash` with the tx hash, which independently verifies the payment on-chain before spending money on a Gemini call.

**Tech Stack:** Solidity ^0.8.24, Foundry, OpenZeppelin Upgradeable v5 (UUPS), wagmi v3/viem v2, Next.js API routes, Upstash Redis (`@upstash/redis`, already a dependency).

## Global Constraints

- `RerollBurner.sol` is UUPS upgradeable (constructor + `_disableInitializers()`, `initialize(...)` with `initializer` modifier, `_authorizeUpgrade` gated `onlyOwner`) — this project's default for every new mainnet contract since 5/22, matching `DailyCheckIn.sol`'s exact pattern.
- Use `SafeERC20` for the GNRM transfer (this project's stated convention for all token transfers).
- Burn to `0x000000000000000000000000000000000000dEaD`, never `address(0)` (some ERC20s revert on zero-address transfers).
- Initial `rerollCost` is `60_000e18` — GNRM has 18 decimals, verified directly on-chain (`cast call 0x271b01cc11032a4e23f0200f8f57eb45176ab491 "decimals()(uint8)"` → `18`). `rerollCost` is owner-adjustable via `setRerollCost(uint256)` — not a hardcoded constant.
- Only the main reveal-screen REROLL button (`GenerationReveal.tsx`, the one rendered when `generatedImageBase64` is present) becomes paid. The *other* REROLL button in the same file (the "generation session was interrupted" fallback path, shown when `generatedImageBase64` is missing) stays exactly as-is: free, calls `reset()`. It has no successful roll to react to yet, so charging for it doesn't make sense.
- The signed message a caller must produce is exactly `Reroll with tx {txHash}` (with the literal tx hash substituted in) — built by one shared, isomorphic function (`buildRerollMessage`) used identically by both the signing code and the verifying code, so they can never drift out of sync.
- A reroll tx hash is only marked "consumed" in Redis *after* Gemini generation succeeds, never before — a Gemini failure after a real payment must not cost the user a second burn on retry.
- The existing IP rate limit in `generate-kitbash` (5/hour, 20/day, via `checkRateLimit`) is unchanged and applies uniformly to free and paid generations.
- GNRM's real address (`0x271b01cc11032a4e23f0200f8f57eb45176ab491`, Base mainnet only) is used as the `GNRM_ADDRESS` constructor/deploy-script argument when deploying `RerollBurner` to mainnet — but the frontend (`useReroll.ts`) never hardcodes it. Instead it reads the payment token address live via `RerollBurner.gnrm()`, since the same hook must also work against the Sepolia dry run's `MockERC20` (Task 6) — a hardcoded mainnet-only address (the pattern `useGnrmPurchaseCheck.ts` / `useStakedTodayCheck.ts` use, since those checks never run against a testnet dry run) would make that dry run impossible.
- `RerollBurner`'s own address *is* added to `addresses.ts` (it's a GundariuM-deployed contract), starting as the placeholder zero-address on both chains until deployed in a follow-up step outside this plan — the frontend must show a disabled "not live yet" state when the address is still a placeholder (`isPlaceholder()`, already in `addresses.ts`), the same safeguard already used for the verified-share feature after a prior review caught it silently no-op-ing on placeholder addresses.
- `rerollVerification.ts`'s on-chain check is chain-aware (`NEXT_PUBLIC_CHAIN_ID`, already an existing env var per `CLAUDE.md`) rather than hardcoded to mainnet, so the identical verification code path is exercised by both the Sepolia dry run (Task 6) and production — not two separate implementations.
- This project has no frontend test framework (per `CLAUDE.md`) — verification is manual via the dev server, plus `npx tsc --noEmit` / `npx eslint`, and (for the contract) real Foundry tests.

---

### Task 1: `RerollBurner.sol` contract + Foundry tests

**Files:**
- Create: `contracts/src/RerollBurner.sol`
- Create: `contracts/test/RerollBurner.t.sol`

**Interfaces:**
- Produces: `reroll()` (external, no args), `setRerollCost(uint256)` (external, `onlyOwner`), `rerollCost()` (public state var, view), `rerollCount(address)` (public mapping, view), `totalRerolls()` (public state var, view), `totalBurned()` (public state var, view), `initialize(address gnrm_, uint256 rerollCost_, address owner_)`, `event Rerolled(address indexed user, uint256 amount, uint256 userRerollCount, uint256 totalRerolls)`, `event RerollCostUpdated(uint256 oldCost, uint256 newCost)`, `BURN_ADDRESS` (public constant).

- [ ] **Step 1: Write `RerollBurner.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RerollBurner
 * @notice Charges a GNRM fee to reroll a Gundar-Frame during the mint flow,
 *         burning it to a dead address and tracking reroll activity
 *         on-chain. Owner-adjustable cost since mint pricing and whitelist
 *         tiers have both needed tuning post-launch before.
 */
contract RerollBurner is OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ─── Constants ──────────────────────────────────────────────────────────

    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ─── Events ─────────────────────────────────────────────────────────────

    event Rerolled(address indexed user, uint256 amount, uint256 userRerollCount, uint256 totalRerolls);
    event RerollCostUpdated(uint256 oldCost, uint256 newCost);

    // ─── State ──────────────────────────────────────────────────────────────

    IERC20 public gnrm;
    uint256 public rerollCost;
    mapping(address => uint256) public rerollCount;
    uint256 public totalRerolls;
    uint256 public totalBurned;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address gnrm_, uint256 rerollCost_, address owner_) external initializer {
        __Ownable_init(owner_);
        gnrm = IERC20(gnrm_);
        rerollCost = rerollCost_;
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /// @notice Burn `rerollCost` GNRM from the caller to reroll. Reverts if
    ///         the caller hasn't approved enough GNRM, or doesn't hold enough.
    function reroll() external {
        gnrm.safeTransferFrom(msg.sender, BURN_ADDRESS, rerollCost);

        rerollCount[msg.sender] += 1;
        totalRerolls += 1;
        totalBurned += rerollCost;

        emit Rerolled(msg.sender, rerollCost, rerollCount[msg.sender], totalRerolls);
    }

    // ─── Owner Actions ──────────────────────────────────────────────────────

    function setRerollCost(uint256 newCost) external onlyOwner {
        emit RerollCostUpdated(rerollCost, newCost);
        rerollCost = newCost;
    }

    // ─── Upgradeability ─────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

- [ ] **Step 2: Write `RerollBurner.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {RerollBurner} from "../src/RerollBurner.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract RerollBurnerTest is Test {
    RerollBurner burner;
    MockERC20 gnrm;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    uint256 constant INITIAL_COST = 60_000e18;
    address constant BURN = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        gnrm = new MockERC20("Mock GNRM", "mGNRM", 1_000_000e18, alice);

        RerollBurner impl = new RerollBurner();
        bytes memory init = abi.encodeCall(RerollBurner.initialize, (address(gnrm), INITIAL_COST, owner));
        burner = RerollBurner(address(new ERC1967Proxy(address(impl), init)));

        vm.prank(alice);
        gnrm.approve(address(burner), type(uint256).max);
    }

    // ─── reroll() ────────────────────────────────────────────────────────────

    function test_reroll_burnsExactCostToDeadAddress() public {
        uint256 balanceBefore = gnrm.balanceOf(alice);

        vm.prank(alice);
        burner.reroll();

        assertEq(gnrm.balanceOf(alice), balanceBefore - INITIAL_COST);
        assertEq(gnrm.balanceOf(BURN), INITIAL_COST);
    }

    function test_reroll_incrementsAllCounters() public {
        vm.prank(alice);
        burner.reroll();

        assertEq(burner.rerollCount(alice), 1);
        assertEq(burner.totalRerolls(), 1);
        assertEq(burner.totalBurned(), INITIAL_COST);

        vm.prank(alice);
        burner.reroll();

        assertEq(burner.rerollCount(alice), 2);
        assertEq(burner.totalRerolls(), 2);
        assertEq(burner.totalBurned(), INITIAL_COST * 2);
    }

    function test_reroll_tracksPerUserSeparately() public {
        vm.prank(alice);
        gnrm.transfer(bob, 200_000e18);
        vm.prank(bob);
        gnrm.approve(address(burner), type(uint256).max);

        vm.prank(alice);
        burner.reroll();
        vm.prank(bob);
        burner.reroll();
        vm.prank(bob);
        burner.reroll();

        assertEq(burner.rerollCount(alice), 1);
        assertEq(burner.rerollCount(bob), 2);
        assertEq(burner.totalRerolls(), 3);
    }

    function test_reroll_emitsRerolledEvent() public {
        vm.expectEmit(true, false, false, true, address(burner));
        emit RerollBurner.Rerolled(alice, INITIAL_COST, 1, 1);

        vm.prank(alice);
        burner.reroll();
    }

    function test_reroll_revertsOnInsufficientAllowance() public {
        vm.prank(alice);
        gnrm.approve(address(burner), 0);

        vm.prank(alice);
        vm.expectRevert();
        burner.reroll();
    }

    function test_reroll_revertsOnInsufficientBalance() public {
        vm.prank(bob); // bob holds zero mock GNRM and has approved nothing
        vm.expectRevert();
        burner.reroll();
    }

    // ─── setRerollCost() ─────────────────────────────────────────────────────

    function test_setRerollCost_ownerCanUpdate() public {
        vm.prank(owner);
        burner.setRerollCost(100_000e18);

        assertEq(burner.rerollCost(), 100_000e18);
    }

    function test_setRerollCost_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        burner.setRerollCost(100_000e18);
    }

    function test_setRerollCost_emitsRerollCostUpdated() public {
        vm.expectEmit(true, false, false, true, address(burner));
        emit RerollBurner.RerollCostUpdated(INITIAL_COST, 100_000e18);

        vm.prank(owner);
        burner.setRerollCost(100_000e18);
    }
}
```

- [ ] **Step 3: Run the tests**

Run: `cd contracts && forge test --match-contract RerollBurnerTest -vv`
Expected: all 9 tests pass (`test_reroll_burnsExactCostToDeadAddress`,
`test_reroll_incrementsAllCounters`, `test_reroll_tracksPerUserSeparately`,
`test_reroll_emitsRerolledEvent`, `test_reroll_revertsOnInsufficientAllowance`,
`test_reroll_revertsOnInsufficientBalance`, `test_setRerollCost_ownerCanUpdate`,
`test_setRerollCost_revertsForNonOwner`, `test_setRerollCost_emitsRerollCostUpdated`).

- [ ] **Step 4: Run the full contract suite to confirm no regressions**

Run: `cd contracts && forge test`
Expected: all existing tests still pass, plus the 9 new ones (total count
increases by 9 from whatever the current baseline is).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/RerollBurner.sol contracts/test/RerollBurner.t.sol
git commit -m "feat(contracts): add RerollBurner — burns GNRM for mint-flow rerolls"
```

---

### Task 2: Deploy script + ABI + `addresses.ts` wiring

**Files:**
- Create: `contracts/script/DeployRerollBurner.s.sol`
- Create: `src/lib/contracts/abis/RerollBurner.ts`
- Modify: `src/lib/contracts/addresses.ts`

**Interfaces:**
- Consumes: `RerollBurner.sol` from Task 1 (same function/event signatures).
- Produces: `REROLL_BURNER_ABI` (viem-shaped ABI array), `getContracts(chainId).rerollBurner` (address, placeholder zero-address on both chains for now).

- [ ] **Step 1: Write the deploy script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {RerollBurner} from "../src/RerollBurner.sol";

/**
 * @notice Deploys RerollBurner as a UUPS proxy. Standalone — does not touch
 *         GunplaCard, GundaniumGame, DailyCheckIn, or PrizePool.
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
 *   OWNER_ADDRESS  — address that will own the proxy (the existing deployer wallet)
 *   GNRM_ADDRESS   — the GNRM token address on the target chain (real GNRM on
 *                    mainnet; a freshly-deployed MockERC20 on Sepolia, since
 *                    real GNRM only exists on Base mainnet)
 *
 * Usage (Base Sepolia, against a MockERC20):
 *   OWNER_ADDRESS=0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7 \
 *   GNRM_ADDRESS=<mock token address> \
 *     forge script script/DeployRerollBurner.s.sol \
 *     --rpc-url https://sepolia.base.org --account deployer --broadcast --verify -vvvv
 *
 * Usage (Base mainnet, against real GNRM):
 *   OWNER_ADDRESS=0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7 \
 *   GNRM_ADDRESS=0x271b01cc11032a4e23f0200f8f57eb45176ab491 \
 *     forge script script/DeployRerollBurner.s.sol \
 *     --rpc-url https://mainnet.base.org --account deployer --broadcast --verify -vvvv
 *
 * After deploy: paste the logged proxy address into
 *   src/lib/contracts/addresses.ts  (rerollBurner key, matching chain entry)
 * then redeploy the frontend.
 */
contract DeployRerollBurner is Script {
    uint256 constant INITIAL_REROLL_COST = 60_000e18;

    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");
        address gnrm_ = vm.envAddress("GNRM_ADDRESS");

        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        console.log("=== RerollBurner Deploy ===");
        console.log("Owner: ", owner_);
        console.log("GNRM:  ", gnrm_);
        console.log("Initial reroll cost: ", INITIAL_REROLL_COST);

        RerollBurner impl = new RerollBurner();
        bytes memory init = abi.encodeCall(RerollBurner.initialize, (gnrm_, INITIAL_REROLL_COST, owner_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);

        vm.stopBroadcast();

        console.log("Implementation:    ", address(impl));
        console.log("Proxy (use this):  ", address(proxy));
        console.log("");
        console.log("Next step: add proxy address to src/lib/contracts/addresses.ts (rerollBurner)");
    }
}
```

- [ ] **Step 2: Write the ABI TS file**

```ts
export const REROLL_BURNER_ABI = [
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "reroll",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "gnrm",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rerollCost",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rerollCount",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalRerolls",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalBurned",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "BURN_ADDRESS",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },

  // ─── Owner Actions ────────────────────────────────────────────────────────
  {
    type: "function",
    name: "setRerollCost",
    inputs: [{ name: "newCost", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Rerolled",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "userRerollCount", type: "uint256", indexed: false },
      { name: "totalRerolls", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RerollCostUpdated",
    inputs: [
      { name: "oldCost", type: "uint256", indexed: false },
      { name: "newCost", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
```

- [ ] **Step 3: Add `rerollBurner` to `addresses.ts`**

In `src/lib/contracts/addresses.ts`, add `rerollBurner: \`0x${string}\`;` to the
`Record` type, and `rerollBurner: "0x0000000000000000000000000000000000000000",`
to both the `84532` (Sepolia) and `8453` (mainnet) entries, placed after
`arenaBattleLog` in each. Every other line in the file is unchanged.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/lib/contracts/abis/RerollBurner.ts src/lib/contracts/addresses.ts`
Expected: no errors or warnings.

- [ ] **Step 5: Verify the deploy script compiles**

Run: `cd contracts && forge build`
Expected: compiles cleanly, no errors (this only checks the script compiles —
it is not actually run/broadcast in this task).

- [ ] **Step 6: Commit**

```bash
git add contracts/script/DeployRerollBurner.s.sol src/lib/contracts/abis/RerollBurner.ts src/lib/contracts/addresses.ts
git commit -m "feat(contracts): add RerollBurner deploy script, ABI, and placeholder address"
```

---

### Task 3: `rerollMessage.ts` + `rerollStore.ts` + `rerollVerification.ts`

**Files:**
- Create: `src/lib/rerollMessage.ts`
- Create: `src/lib/rerollStore.ts`
- Create: `src/lib/rerollVerification.ts`
- Create (temporary, deleted at the end of this task): `scripts/test-reroll-message.ts`

**Interfaces:**
- Produces: `buildRerollMessage(txHash: string): string` (isomorphic — no
  server-only imports, safe to import from client code too);
  `isRerollTxConsumed(txHash: string): Promise<boolean>`,
  `markRerollTxConsumed(txHash: string): Promise<void>` (both server-only);
  `verifyRerollPayment(params: { walletAddress: string; rerollTxHash: string; signature: string }): Promise<{ valid: boolean; reason?: string }>` (server-only).
- Consumes: `REROLL_BURNER_ABI` and `getContracts` from Task 2.

- [ ] **Step 1: Write `rerollMessage.ts`**

```ts
/**
 * The exact message a wallet signs to prove it controls the address that
 * submitted a reroll payment. Deliberately isomorphic (no server-only
 * imports) — both the signing code (client) and the verifying code (server)
 * import this same function so the message string can never drift out of
 * sync between the two.
 */
export function buildRerollMessage(txHash: string): string {
  return `Reroll with tx ${txHash}`;
}
```

- [ ] **Step 2: Write `rerollStore.ts`**

```ts
/**
 * Reroll payment tracking — server-side only.
 *
 * A reroll tx hash is marked "consumed" only after a paid reroll's Gemini
 * generation actually succeeds (see /api/generate-kitbash), so a Gemini
 * failure after a real on-chain payment never costs the user a second burn
 * on retry — the same tx hash and signature remain valid until consumed.
 */

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// 30 days is far longer than any plausible retry window; bounds storage
// instead of keeping every reroll tx hash forever.
const CONSUMED_TTL_SECONDS = 30 * 24 * 60 * 60;

function consumedKey(txHash: string): string {
  return `reroll:consumed:${txHash.toLowerCase()}`;
}

export async function isRerollTxConsumed(txHash: string): Promise<boolean> {
  try {
    const value = await redis.get(consumedKey(txHash));
    return value !== null;
  } catch (err) {
    console.error(`isRerollTxConsumed failed for ${txHash}:`, err);
    // Fail closed would block legitimate rerolls on a Redis hiccup; fail
    // open here since the on-chain + signature checks in verifyRerollPayment
    // still gate a real payment — worst case on a Redis outage is a very
    // narrow replay window, not an unpaid generation.
    return false;
  }
}

export async function markRerollTxConsumed(txHash: string): Promise<void> {
  await redis.set(consumedKey(txHash), true, { ex: CONSUMED_TTL_SECONDS });
}
```

- [ ] **Step 3: Write `rerollVerification.ts`**

```ts
/**
 * Verifies a claimed reroll payment before /api/generate-kitbash spends
 * money calling Gemini. Three checks, in order — cheapest and hardest to
 * fake first:
 *   1. Signature: does walletAddress actually control the signing key? A tx
 *      hash alone is publicly observable the moment it's broadcast (visible
 *      in the mempool before confirmation), so without this check anyone
 *      could submit someone else's pending reroll tx as their own.
 *   2. Already used: has this exact tx hash already paid for a generation?
 *   3. On-chain: is this really a successful call to RerollBurner that
 *      emitted a Rerolled event for this wallet?
 */

import { createPublicClient, http, parseEventLogs, verifyMessage } from "viem";
import { base, baseSepolia } from "viem/chains";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { REROLL_BURNER_ABI } from "@/lib/contracts/abis/RerollBurner";
import { buildRerollMessage } from "@/lib/rerollMessage";
import { isRerollTxConsumed } from "@/lib/rerollStore";

// Chain-aware (not hardcoded to mainnet): NEXT_PUBLIC_CHAIN_ID lets the exact
// same verification path run against Base Sepolia during manual dry-run
// testing (see Task 6) and against Base mainnet in production, without two
// copies of this logic.
const chain = Number(process.env.NEXT_PUBLIC_CHAIN_ID) === baseSepolia.id ? baseSepolia : base;
const rpcUrl =
  chain.id === baseSepolia.id
    ? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org"
    : process.env.BASE_RPC_URL || "https://mainnet.base.org";

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

export async function verifyRerollPayment(params: {
  walletAddress: string;
  rerollTxHash: string;
  signature: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const { walletAddress, rerollTxHash, signature } = params;

  let signatureValid = false;
  try {
    signatureValid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message: buildRerollMessage(rerollTxHash),
      signature: signature as `0x${string}`,
    });
  } catch (err) {
    console.error(`Reroll signature verification threw for ${walletAddress}:`, err);
    return { valid: false, reason: "Signature verification failed" };
  }
  if (!signatureValid) {
    return { valid: false, reason: "Signature doesn't match wallet" };
  }

  if (await isRerollTxConsumed(rerollTxHash)) {
    return { valid: false, reason: "This payment has already been used" };
  }

  const contracts = getContracts(chain.id);
  if (isPlaceholder(contracts.rerollBurner)) {
    return { valid: false, reason: "Reroll isn't live yet" };
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({
      hash: rerollTxHash as `0x${string}`,
    });
  } catch (err) {
    console.error(`Reroll tx receipt lookup failed for ${rerollTxHash}:`, err);
    return { valid: false, reason: "Reroll transaction not found" };
  }

  if (receipt.status !== "success") {
    return { valid: false, reason: "Reroll transaction did not succeed" };
  }
  if (receipt.to?.toLowerCase() !== contracts.rerollBurner.toLowerCase()) {
    return { valid: false, reason: "Transaction was not a call to RerollBurner" };
  }

  const events = parseEventLogs({
    abi: REROLL_BURNER_ABI,
    logs: receipt.logs,
    eventName: "Rerolled",
  });
  const matchingEvent = events.find(
    (e) => e.args.user.toLowerCase() === walletAddress.toLowerCase()
  );
  if (!matchingEvent) {
    return { valid: false, reason: "No matching Rerolled event for this wallet" };
  }

  return { valid: true };
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/lib/rerollMessage.ts src/lib/rerollStore.ts src/lib/rerollVerification.ts`
Expected: no errors or warnings.

- [ ] **Step 5: Manually verify the signature round-trip works**

This project has no frontend test framework; verify the security-critical
signing/verification round-trip with a throwaway script (same pattern as the
existing `scripts/test-kitbash-gen.ts`), deleted once it passes.

Create `scripts/test-reroll-message.ts`:

```ts
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { buildRerollMessage } from "../src/lib/rerollMessage";

async function main() {
  const account = privateKeyToAccount(
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
  const fakeTxHash =
    "0xabc0000000000000000000000000000000000000000000000000000000abc0";
  const message = buildRerollMessage(fakeTxHash);
  const signature = await account.signMessage({ message });

  const valid = await verifyMessage({
    address: account.address,
    message,
    signature,
  });
  console.log("Signature valid for correct address:", valid);

  const invalid = await verifyMessage({
    address: "0x000000000000000000000000000000000000dEaD",
    message,
    signature,
  });
  console.log("Signature valid for wrong address (should be false):", invalid);
}

main();
```

Run: `npx tsx scripts/test-reroll-message.ts`
Expected output:
```
Signature valid for correct address: true
Signature valid for wrong address (should be false): false
```

Then delete the script: `rm scripts/test-reroll-message.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/rerollMessage.ts src/lib/rerollStore.ts src/lib/rerollVerification.ts
git commit -m "feat(reroll): add message signing, Redis consumed-tracking, and payment verification"
```

---

### Task 4: `useReroll` hook

**Files:**
- Create: `src/lib/contracts/hooks/useReroll.ts`

**Interfaces:**
- Consumes: `REROLL_BURNER_ABI`, `getContracts`, `isPlaceholder` (Task 2);
  `buildRerollMessage` (Task 3); `createGuardedWrite` (existing,
  `src/lib/contracts/guardedWrite.ts`).
- Produces: `useReroll()` returning
  `{ phase: RerollPhase; error: string | null; rerollCost: bigint; ready: boolean; executeReroll: (faction: string | null) => Promise<GenerationResult | null>; reset: () => void }`
  where `RerollPhase = "idle" | "approving" | "approved" | "rerolling" | "generating" | "done" | "error"`
  and `GenerationResult` matches the exact shape `/api/generate-kitbash`
  returns (`{ traits, kitbashTraits, traitRarities, imageBase64, imageMimeType }`)
  — the same shape `useMintStore`'s `setGenerationResult` already accepts.

- [ ] **Step 1: Write `useReroll.ts`**

```ts
"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import { erc20Abi } from "viem";
import { REROLL_BURNER_ABI } from "@/lib/contracts/abis/RerollBurner";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { createGuardedWrite } from "@/lib/contracts/guardedWrite";
import { buildRerollMessage } from "@/lib/rerollMessage";

const FALLBACK_REROLL_COST = 60_000n * 10n ** 18n;

export type RerollPhase =
  | "idle"
  | "approving"
  | "approved"
  | "rerolling"
  | "generating"
  | "done"
  | "error";

export function useReroll() {
  const [phase, setPhase] = useState<RerollPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const account = useAccount();
  const guardedWrite = createGuardedWrite(account, chainId, writeContractAsync);

  let contracts: ReturnType<typeof getContracts> | null = null;
  try {
    contracts = getContracts(chainId);
  } catch {
    // unsupported chain
  }

  const ready = !!contracts && !isPlaceholder(contracts.rerollBurner);

  // Read the payment token address from the deployed contract itself rather
  // than hardcoding it — RerollBurner is initialized with real GNRM on
  // mainnet and a MockERC20 on Sepolia (see Task 6's dry-run deploy), so
  // this one hook works correctly against either without a chain branch.
  const { data: gnrmAddress } = useReadContract({
    address: contracts?.rerollBurner,
    abi: REROLL_BURNER_ABI,
    functionName: "gnrm",
    query: { enabled: ready },
  });

  const { data: rerollCostData } = useReadContract({
    address: contracts?.rerollBurner,
    abi: REROLL_BURNER_ABI,
    functionName: "rerollCost",
    query: { enabled: ready },
  });
  const rerollCost = rerollCostData ?? FALLBACK_REROLL_COST;

  const { data: allowance } = useReadContract({
    address: gnrmAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      account.address && contracts
        ? [account.address, contracts.rerollBurner]
        : undefined,
    query: { enabled: ready && !!account.address && !!gnrmAddress },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function executeReroll(faction: string | null): Promise<any | null> {
    if (!account.address || !contracts || !publicClient || !ready || !gnrmAddress) return null;
    setError(null);

    try {
      if ((allowance ?? 0n) < rerollCost) {
        setPhase("approving");
        const approveHash = await guardedWrite({
          address: gnrmAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [contracts.rerollBurner, rerollCost],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      setPhase("approved");

      setPhase("rerolling");
      const rerollHash = await guardedWrite({
        address: contracts.rerollBurner,
        abi: REROLL_BURNER_ABI,
        functionName: "reroll",
      });
      await publicClient.waitForTransactionReceipt({ hash: rerollHash });

      const signature = await signMessageAsync({
        message: buildRerollMessage(rerollHash),
      });

      setPhase("generating");
      const res = await fetch("/api/generate-kitbash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faction,
          walletAddress: account.address,
          rerollTxHash: rerollHash,
          signature,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Reroll generation failed");
      }

      const data = await res.json();
      setPhase("done");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reroll failed");
      setPhase("error");
      return null;
    }
  }

  function reset() {
    setPhase("idle");
    setError(null);
  }

  return { phase, error, rerollCost, ready, executeReroll, reset };
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/lib/contracts/hooks/useReroll.ts`
Expected: no errors or warnings (the one `eslint-disable` comment for the
`any` return type is deliberate — `generate-kitbash`'s response has no
shared exported type today; `MintLanding.tsx`'s existing call to the same
endpoint is equally loosely typed at this exact boundary).

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/hooks/useReroll.ts
git commit -m "feat(reroll): add useReroll hook"
```

---

### Task 5: `generate-kitbash` route changes

**Files:**
- Modify: `src/app/api/generate-kitbash/route.ts`

**Interfaces:**
- Consumes: `verifyRerollPayment` and `markRerollTxConsumed` (Task 3).
- Produces: the route now accepts three new optional body fields
  (`walletAddress`, `rerollTxHash`, `signature`) with no change to its
  response shape or to the free (no-`rerollTxHash`) path.

- [ ] **Step 1: Modify the route**

In `src/app/api/generate-kitbash/route.ts`, add two imports after the
existing ones:

```ts
import { verifyRerollPayment } from "@/lib/rerollVerification";
import { markRerollTxConsumed } from "@/lib/rerollStore";
```

Replace the body-destructuring block:

```ts
    const body = await req.json().catch(() => ({}));
    const { faction: factionHint, turnstileToken } = body as {
      faction?: string;
      turnstileToken?: string;
    };
```

with:

```ts
    const body = await req.json().catch(() => ({}));
    const {
      faction: factionHint,
      turnstileToken,
      walletAddress,
      rerollTxHash,
      signature,
    } = body as {
      faction?: string;
      turnstileToken?: string;
      walletAddress?: string;
      rerollTxHash?: string;
      signature?: string;
    };
```

Immediately after the existing rate-limit block (right after its closing
`}`, before the `// Honor the user's faction selection.` comment), insert:

```ts

    // Paid reroll: verify the on-chain burn actually happened, was signed by
    // the claimed wallet, and hasn't already been used for a free generation,
    // before spending money calling Gemini.
    if (rerollTxHash) {
      if (!walletAddress || !signature) {
        return NextResponse.json(
          { error: "Missing wallet address or signature for reroll" },
          { status: 400 }
        );
      }
      const verification = await verifyRerollPayment({
        walletAddress,
        rerollTxHash,
        signature,
      });
      if (!verification.valid) {
        return NextResponse.json(
          { error: verification.reason ?? "Reroll payment could not be verified" },
          { status: 402 }
        );
      }
    }
```

Immediately before the final `return NextResponse.json({ traits, kitbashTraits, ... })`
(inside the `try` block, after the `traitRarities` computation), insert:

```ts

    // Only mark the payment consumed once generation actually succeeded —
    // if Gemini fails, the tx hash and signature stay valid so a retry
    // doesn't cost a second burn.
    if (rerollTxHash) {
      await markRerollTxConsumed(rerollTxHash);
    }
```

Nothing else in the file changes — `deriveFaction`, `deriveArmorType`,
`deriveSecondaryWeapon`, `deriveTertiaryWeapon`, `deriveSpecialAttack`, the
Turnstile check, the rate-limit logic, the trait-rolling and Gemini call are
all untouched.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/api/generate-kitbash/route.ts`
Expected: no errors or warnings.

- [ ] **Step 3: Manually verify the free path is unaffected**

Run `npm run dev`, then in another terminal:

```
curl -s -X POST http://localhost:3000/api/generate-kitbash -H "Content-Type: application/json" -d '{"faction":"EFSF"}'
```

Expected: a normal `200` JSON response with `traits`, `kitbashTraits`,
`traitRarities`, `imageBase64`, `imageMimeType` — identical shape to before
this task, confirming the no-`rerollTxHash` path is unchanged.

- [ ] **Step 4: Manually verify the paid path rejects a bad tx hash**

```
curl -s -X POST http://localhost:3000/api/generate-kitbash -H "Content-Type: application/json" -d '{"faction":"EFSF","walletAddress":"0x000000000000000000000000000000000000dEaD","rerollTxHash":"0x0000000000000000000000000000000000000000000000000000000000000000","signature":"0x00"}'
```

Expected: a `402` (or `400`, depending on which check fails first — a
malformed signature will fail the signature-recovery step before the
on-chain lookup even runs) response with a clear `error` message, and no
Gemini call made (confirm via the dev server log — no
"Kitbash generation" work should appear for this request).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate-kitbash/route.ts
git commit -m "feat(reroll): verify on-chain payment before honoring a paid reroll"
```

---

### Task 6: Wire into `GenerationReveal.tsx` + Sepolia end-to-end verification

**Files:**
- Modify: `src/components/mint/GenerationReveal.tsx`

**Interfaces:**
- Consumes: `useReroll` (Task 4).

- [ ] **Step 1: Modify `GenerationReveal.tsx`**

Add the import:

```tsx
import { useReroll } from "@/lib/contracts/hooks/useReroll";
```

Change the store destructuring to also pull `faction` and
`setGenerationResult` (both already exist on `useMintStore` — `faction` is
set by `MintLanding.tsx`, `setGenerationResult` is the same action the first
generation already uses):

```tsx
  const {
    traits,
    kitbashTraits,
    traitRarities,
    generatedImageBase64,
    generatedImageMimeType,
    fallbackName,
    customName,
    faction,
    setCustomName,
    setGenerationResult,
    goTo,
    reset,
  } = useMintStore();

  const { address } = useAccount();
  const [nameError, setNameError] = useState<string | null>(null);
  const {
    phase: rerollPhase,
    error: rerollError,
    rerollCost,
    ready: rerollReady,
    executeReroll,
  } = useReroll();
```

(The interrupted-session fallback block right after this — the one that
returns early when `!generatedImageBase64`, using `reset` — is completely
unchanged. It still calls `reset()`.)

Add this handler and these derived values right after `const canProceed = nameError === null;`:

```tsx
  const handleReroll = async () => {
    const result = await executeReroll(faction);
    if (result) {
      setGenerationResult(result);
    }
  };

  const rerolling =
    rerollPhase !== "idle" && rerollPhase !== "done" && rerollPhase !== "error";

  const rerollCostDisplay = (rerollCost / 10n ** 18n).toString();

  const rerollLabel = !rerollReady
    ? "Reroll Coming Soon"
    : rerollPhase === "approving"
      ? "APPROVING..."
      : rerollPhase === "rerolling"
        ? "BURNING GNRM..."
        : rerollPhase === "generating"
          ? "REGENERATING..."
          : `REROLL — ${rerollCostDisplay} GNRM`;
```

Replace the REROLL button in the Actions section:

```tsx
          <button
            onClick={reset}
            className="px-6 py-3 border border-[var(--border)] text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)] text-sm rounded-xl hover:border-[var(--foreground)]/20 transition-all"
          >
            REROLL
          </button>
```

with:

```tsx
          <button
            onClick={handleReroll}
            disabled={rerolling || !rerollReady}
            title={!rerollReady ? "This feature isn't live yet — check back soon" : undefined}
            className="px-6 py-3 border border-[var(--border)] text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)] text-sm rounded-xl hover:border-[var(--foreground)]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rerollLabel}
          </button>
```

Add an error line right after the closing `</div>` of the Actions `<div className="flex gap-3 ...">` block:

```tsx
        {rerollError && (
          <p className="text-red-400 text-xs text-center">{rerollError}</p>
        )}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/mint/GenerationReveal.tsx`
Expected: no errors or warnings.

- [ ] **Step 3: Deploy MockERC20 + RerollBurner to Base Sepolia**

Deploy a fresh mock GNRM token (one-liner, no script needed — this is
scratch testnet infrastructure, not a permanent addressed deployment):

```
cd contracts && forge create src/MockERC20.sol:MockERC20 --rpc-url https://sepolia.base.org --account deployer --broadcast --constructor-args "Mock GNRM" "mGNRM" 1000000000000000000000000 0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7
```

Note the deployed address, then deploy `RerollBurner` pointed at it:

```
OWNER_ADDRESS=0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7 GNRM_ADDRESS=<mock token address from above> forge script script/DeployRerollBurner.s.sol --rpc-url https://sepolia.base.org --account deployer --broadcast --verify -vvvv
```

Note the logged proxy address, then update `src/lib/contracts/addresses.ts`:
set `rerollBurner` in the `84532` entry to that proxy address (leave the
`8453` mainnet entry as the placeholder zero-address — mainnet deployment
happens separately, after this plan, once real GNRM is the target).

- [ ] **Step 4: Manually verify the full paid-reroll flow on Sepolia**

Run `npm run dev`, connect a wallet holding some of the mock GNRM (mint more
to your own test wallet via `cast send <mock token address> "transfer(address,uint256)" <your wallet> 1000000000000000000000000 --rpc-url https://sepolia.base.org --account deployer` if needed), switch to Base Sepolia, go
through the mint flow to the reveal screen.

Click "REROLL — 60,000 GNRM". Expected: an approve prompt, then a `reroll()`
transaction prompt, then a signature prompt, then the card regenerates in
place with new traits and a new image — same faction, without returning to
the faction picker. Click it a second time: expect a SECOND approve prompt
too — `useReroll` approves for the exact reroll cost each time rather than a
standing/max allowance (deliberate: this project has direct history with a
phishing `approve()` incident, so we don't leave a large standing approval
sitting on the GNRM contract just to save one wallet prompt per reroll).

Confirm in the dev server log that `markRerollTxConsumed` only fires after
each successful generation (no log line for a rejected/failed attempt).

- [ ] **Step 5: Commit**

```bash
git add src/components/mint/GenerationReveal.tsx src/lib/contracts/addresses.ts
git commit -m "feat(reroll): wire useReroll into the mint reveal screen"
```
