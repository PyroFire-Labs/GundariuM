# GNDM→GUNR Migration v2 Redeploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bricked v1 migration contract (`0xefbD485bFbDb9aC766659811151CB2b6e43A7261`) on Base mainnet with a simplified flat contract that has no Merkle whitelist — just a 1:1 swap with admin failsafes.

**Architecture:** Flat (non-upgradeable) Solidity contract using OZ `Ownable` + `Pausable`. `migrate()` body is 6 lines: deadline check + `safeTransferFrom` GNDM + `safeTransfer` GUNR + event. Admin surface: `pause`/`unpause`, `setDeadline`, `recoverToken`. Funded with 50M GUNR from deployer post-deploy. Frontend simplified to remove all proof-fetching machinery.

**Tech Stack:** Solidity 0.8.24, OpenZeppelin v5 (Ownable, Pausable, SafeERC20, IERC20), Foundry (forge + cast), Next.js 16 App Router, wagmi v3, viem v2, Vercel.

**Spec:** `docs/superpowers/specs/2026-05-22-migration-redeploy-design.md`

---

## Phase A — Contract + Tests + Deploy Script (local Foundry)

### Task 1: Rewrite GNDMtoGUNR.sol

**Files:**
- Modify: `contracts/src/GNDMtoGUNR.sol`

- [ ] **Step 1: Replace contract file with simplified design**

Replace `contracts/src/GNDMtoGUNR.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title GNDMtoGUNR
/// @notice Time-gated 1:1 migration from $GNDM to $GUNR. No whitelist; total
///         migration is bounded by the contract's GUNR funding amount.
contract GNDMtoGUNR is Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable gndm;
    IERC20 public immutable gunr;
    uint256 public deadline;

    event Migrated(address indexed user, uint256 amount);
    event DeadlineUpdated(uint256 oldDeadline, uint256 newDeadline);
    event TokenRecovered(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error DeadlineInPast();
    error DeadlinePassed();

    constructor(
        address owner_,
        address gndm_,
        address gunr_,
        uint256 deadline_
    ) Ownable(owner_) {
        if (gndm_ == address(0) || gunr_ == address(0)) revert ZeroAddress();
        if (deadline_ <= block.timestamp) revert DeadlineInPast();
        gndm = IERC20(gndm_);
        gunr = IERC20(gunr_);
        deadline = deadline_;
    }

    // ─── User ─────────────────────────────────────────────────────────

    /// @notice Swap GNDM for GUNR at 1:1. Caller must have approved GNDM.
    function migrate(uint256 amount) external whenNotPaused {
        if (block.timestamp > deadline) revert DeadlinePassed();
        gndm.safeTransferFrom(msg.sender, address(this), amount);
        gunr.safeTransfer(msg.sender, amount);
        emit Migrated(msg.sender, amount);
    }

    // ─── Admin ────────────────────────────────────────────────────────

    function setDeadline(uint256 newDeadline) external onlyOwner {
        uint256 oldDeadline = deadline;
        deadline = newDeadline;
        emit DeadlineUpdated(oldDeadline, newDeadline);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function recoverToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokenRecovered(token, to, amount);
    }
}
```

- [ ] **Step 2: Build the contract**

Run from `contracts/`:
```bash
forge build
```
Expected: clean compile, no warnings about unused variables.

---

### Task 2: Rewrite GNDMtoGUNR.t.sol

**Files:**
- Modify: `contracts/test/GNDMtoGUNR.t.sol`

- [ ] **Step 1: Replace test file**

Replace `contracts/test/GNDMtoGUNR.t.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GNDMtoGUNR} from "../src/GNDMtoGUNR.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract GNDMtoGUNRTest is Test {
    GNDMtoGUNR migration;
    MockERC20 gndm;
    MockERC20 gunr;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);
    address rando = address(4);

    uint256 constant FUNDING = 50_000_000e18;
    uint256 constant ALICE_GNDM = 33_000_000e18;
    uint256 constant BOB_GNDM = 10_000_000e18;

    function setUp() public {
        gndm = new MockERC20("GNDM", "GNDM", 100_000_000e18, owner);
        gunr = new MockERC20("GUNR", "GUNR", 100_000_000e18, owner);

        vm.prank(owner);
        migration = new GNDMtoGUNR(owner, address(gndm), address(gunr), block.timestamp + 60 days);

        vm.prank(owner);
        gunr.transfer(address(migration), FUNDING);

        vm.startPrank(owner);
        gndm.transfer(alice, ALICE_GNDM);
        gndm.transfer(bob, BOB_GNDM);
        vm.stopPrank();

        vm.prank(alice);
        gndm.approve(address(migration), type(uint256).max);
        vm.prank(bob);
        gndm.approve(address(migration), type(uint256).max);
    }

    // ─── Happy Path ───────────────────────────────────────────────────

    function test_migrate_happyPath() public {
        uint256 amount = 5_000_000e18;
        vm.prank(alice);
        migration.migrate(amount);

        assertEq(gndm.balanceOf(alice), ALICE_GNDM - amount);
        assertEq(gunr.balanceOf(alice), amount);
        assertEq(gndm.balanceOf(address(migration)), amount);
        assertEq(gunr.balanceOf(address(migration)), FUNDING - amount);
    }

    function test_migrate_emitsEvent() public {
        uint256 amount = 1_000_000e18;
        vm.expectEmit(true, false, false, true);
        emit GNDMtoGUNR.Migrated(alice, amount);

        vm.prank(alice);
        migration.migrate(amount);
    }

    function test_migrate_multipleCalls() public {
        vm.startPrank(alice);
        migration.migrate(1_000_000e18);
        migration.migrate(2_000_000e18);
        vm.stopPrank();

        assertEq(gunr.balanceOf(alice), 3_000_000e18);
    }

    function test_migrate_anyHolderCanMigrate() public {
        // Rando holds GNDM → can migrate. No whitelist.
        vm.prank(owner);
        gndm.transfer(rando, 1_000_000e18);
        vm.prank(rando);
        gndm.approve(address(migration), type(uint256).max);

        vm.prank(rando);
        migration.migrate(1_000_000e18);

        assertEq(gunr.balanceOf(rando), 1_000_000e18);
    }

    // ─── Rejection Cases ─────────────────────────────────────────────

    function test_migrate_revertsAfterDeadline() public {
        vm.warp(block.timestamp + 61 days);

        vm.prank(alice);
        vm.expectRevert(GNDMtoGUNR.DeadlinePassed.selector);
        migration.migrate(1e18);
    }

    function test_migrate_revertsWithoutApproval() public {
        // rando has GNDM but did not approve
        vm.prank(owner);
        gndm.transfer(rando, 1_000_000e18);

        vm.prank(rando);
        vm.expectRevert();
        migration.migrate(1_000_000e18);
    }

    function test_migrate_revertsWhenOutOfGunr() public {
        // Drain contract via owner first
        vm.prank(owner);
        migration.recoverToken(address(gunr), owner, FUNDING);

        vm.prank(alice);
        vm.expectRevert();
        migration.migrate(1e18);
    }

    function test_migrate_revertsWhenPaused() public {
        vm.prank(owner);
        migration.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        migration.migrate(1e18);
    }

    function test_migrate_succeedsAfterUnpause() public {
        vm.prank(owner);
        migration.pause();
        vm.prank(owner);
        migration.unpause();

        vm.prank(alice);
        migration.migrate(1e18);
        assertEq(gunr.balanceOf(alice), 1e18);
    }

    // ─── Admin: setDeadline ──────────────────────────────────────────

    function test_setDeadline_updatesValue() public {
        uint256 newDeadline = block.timestamp + 365 days;
        vm.prank(owner);
        migration.setDeadline(newDeadline);

        assertEq(migration.deadline(), newDeadline);
    }

    function test_setDeadline_emitsEvent() public {
        uint256 oldDeadline = migration.deadline();
        uint256 newDeadline = oldDeadline + 30 days;
        vm.expectEmit(false, false, false, true);
        emit GNDMtoGUNR.DeadlineUpdated(oldDeadline, newDeadline);

        vm.prank(owner);
        migration.setDeadline(newDeadline);
    }

    function test_setDeadline_canShorten() public {
        // No extend-only rail — owner can shorten
        uint256 newDeadline = block.timestamp + 1;
        vm.prank(owner);
        migration.setDeadline(newDeadline);

        assertEq(migration.deadline(), newDeadline);
    }

    function test_setDeadline_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        migration.setDeadline(block.timestamp + 1 days);
    }

    // ─── Admin: pause / unpause ───────────────────────────────────────

    function test_pause_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        migration.pause();
    }

    function test_unpause_onlyOwner_reverts() public {
        vm.prank(owner);
        migration.pause();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        migration.unpause();
    }

    function test_settersWorkWhenPaused() public {
        vm.prank(owner);
        migration.pause();

        // setDeadline still callable when paused
        uint256 newDeadline = block.timestamp + 100 days;
        vm.prank(owner);
        migration.setDeadline(newDeadline);
        assertEq(migration.deadline(), newDeadline);

        // recoverToken still callable when paused
        vm.prank(owner);
        migration.recoverToken(address(gunr), owner, 1e18);
    }

    // ─── Admin: recoverToken ──────────────────────────────────────────

    function test_recoverToken_transfersGUNR() public {
        uint256 ownerBefore = gunr.balanceOf(owner);
        vm.prank(owner);
        migration.recoverToken(address(gunr), owner, 1_000_000e18);

        assertEq(gunr.balanceOf(owner), ownerBefore + 1_000_000e18);
        assertEq(gunr.balanceOf(address(migration)), FUNDING - 1_000_000e18);
    }

    function test_recoverToken_transfersGNDM() public {
        vm.prank(alice);
        migration.migrate(1_000_000e18);

        uint256 ownerBefore = gndm.balanceOf(owner);
        vm.prank(owner);
        migration.recoverToken(address(gndm), owner, 1_000_000e18);

        assertEq(gndm.balanceOf(owner), ownerBefore + 1_000_000e18);
        assertEq(gndm.balanceOf(address(migration)), 0);
    }

    function test_recoverToken_arbitraryRecipient() public {
        vm.prank(owner);
        migration.recoverToken(address(gunr), bob, 100e18);

        assertEq(gunr.balanceOf(bob), 100e18);
    }

    function test_recoverToken_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit GNDMtoGUNR.TokenRecovered(address(gunr), bob, 100e18);

        vm.prank(owner);
        migration.recoverToken(address(gunr), bob, 100e18);
    }

    function test_recoverToken_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        migration.recoverToken(address(gunr), alice, 1e18);
    }

    function test_recoverToken_zeroAddress_reverts() public {
        vm.prank(owner);
        vm.expectRevert(GNDMtoGUNR.ZeroAddress.selector);
        migration.recoverToken(address(gunr), address(0), 1e18);
    }

    // ─── Constructor Validation ───────────────────────────────────────

    function test_constructor_zeroOwner_reverts() public {
        // OZ Ownable enforces this check before our body runs
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new GNDMtoGUNR(address(0), address(gndm), address(gunr), block.timestamp + 30 days);
    }

    function test_constructor_zeroGndm_reverts() public {
        vm.expectRevert(GNDMtoGUNR.ZeroAddress.selector);
        new GNDMtoGUNR(owner, address(0), address(gunr), block.timestamp + 30 days);
    }

    function test_constructor_zeroGunr_reverts() public {
        vm.expectRevert(GNDMtoGUNR.ZeroAddress.selector);
        new GNDMtoGUNR(owner, address(gndm), address(0), block.timestamp + 30 days);
    }

    function test_constructor_deadlineInPast_reverts() public {
        vm.warp(100);
        vm.expectRevert(GNDMtoGUNR.DeadlineInPast.selector);
        new GNDMtoGUNR(owner, address(gndm), address(gunr), 50);
    }

    function test_constructor_setsOwner() public {
        assertEq(migration.owner(), owner);
    }

    function test_constructor_setsTokens() public {
        assertEq(address(migration.gndm()), address(gndm));
        assertEq(address(migration.gunr()), address(gunr));
    }
}
```

- [ ] **Step 2: Run tests**

Run from `contracts/`:
```bash
forge test --match-contract GNDMtoGUNRTest -vv
```
Expected: all tests pass (should be 24 tests, all green).

---

### Task 3: Update DeployMigration.s.sol

**Files:**
- Modify: `contracts/script/DeployMigration.s.sol`

- [ ] **Step 1: Replace deploy script**

Replace `contracts/script/DeployMigration.s.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GNDMtoGUNR} from "../src/GNDMtoGUNR.sol";

/**
 * @notice Deploys the simplified GNDM→GUNR migration contract v2.
 *
 * Required env vars:
 *   OWNER_ADDRESS — address that will own the contract
 *
 * Usage:
 *   OWNER_ADDRESS=0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7 \
 *     forge script script/DeployMigration.s.sol \
 *     --rpc-url https://mainnet.base.org \
 *     --account deployer --broadcast --verify -vvvv
 *
 * NOTE: Prefer `forge create` per [[feedback_eip7702_deploy]] for single-tx
 * deploys on the EIP-7702-delegated deployer wallet. This script is provided
 * for reference and dry-run via `forge script` without --broadcast.
 */
contract DeployMigration is Script {
    address constant GNDM = 0xFc7008F9157257a17a9Fb3c602b1CD56C27A4ba3;
    address constant GUNR = 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07;

    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast();

        uint256 deadline = block.timestamp + 60 days;

        console.log("=== GNDM->GUNR Migration v2 Deploy ===");
        console.log("Owner:    ", owner_);
        console.log("GNDM:     ", GNDM);
        console.log("GUNR:     ", GUNR);
        console.log("Deadline: ", deadline);

        GNDMtoGUNR migration = new GNDMtoGUNR(owner_, GNDM, GUNR, deadline);

        vm.stopBroadcast();

        console.log("Migration contract:", address(migration));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Transfer 50M GUNR to the contract");
        console.log("  2. Update src/lib/contracts/addresses.ts");
        console.log("  3. Set MIGRATION_PAUSED = false in src/app/migrate/page.tsx");
        console.log("  4. Deploy frontend");
    }
}
```

- [ ] **Step 2: Build to verify script compiles**

Run from `contracts/`:
```bash
forge build
```
Expected: clean compile.

---

### Task 4: Commit contract + tests + deploy script

- [ ] **Step 1: Stage and commit**

```bash
git add contracts/src/GNDMtoGUNR.sol contracts/test/GNDMtoGUNR.t.sol contracts/script/DeployMigration.s.sol
git commit -m "$(cat <<'EOF'
feat(migration): simplify GNDMtoGUNR v2 — remove merkle whitelist

v1 (0xefbD485bFbDb9aC766659811151CB2b6e43A7261) was bricked by a leaf-encoding
mismatch between the contract's verify path and the proof generator. v2 removes
the entire whitelist mechanism — eliminating the bug class — and replaces it
with a flat time-gated 1:1 swap.

Admin surface: pause/unpause, setDeadline, recoverToken (all owner-only).
Total migration is bounded by contract GUNR funding (50M), not per-address caps.

Spec: docs/superpowers/specs/2026-05-22-migration-redeploy-design.md
EOF
)"
```

---

## Phase B — Frontend changes (before deploy; MIGRATION_PAUSED stays true)

### Task 5: Replace ABI file

**Files:**
- Modify: `src/lib/contracts/abis/GNDMtoGUNR.ts`

- [ ] **Step 1: Replace ABI**

Replace `src/lib/contracts/abis/GNDMtoGUNR.ts` with:

```ts
export const MIGRATION_ABI = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "owner_", "type": "address", "internalType": "address" },
      { "name": "gndm_", "type": "address", "internalType": "address" },
      { "name": "gunr_", "type": "address", "internalType": "address" },
      { "name": "deadline_", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deadline",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gndm",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IERC20" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gunr",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IERC20" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "migrate",
    "inputs": [{ "name": "amount", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "unpause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDeadline",
    "inputs": [{ "name": "newDeadline", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "recoverToken",
    "inputs": [
      { "name": "token", "type": "address", "internalType": "address" },
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Migrated",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DeadlineUpdated",
    "inputs": [
      { "name": "oldDeadline", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "newDeadline", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TokenRecovered",
    "inputs": [
      { "name": "token", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "to", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  }
] as const;
```

---

### Task 6: Simplify migrate page

**Files:**
- Modify: `src/app/migrate/page.tsx`

- [ ] **Step 1: Replace migrate page**

Replace `src/app/migrate/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import { base } from "viem/chains";
import { MIGRATION_ABI } from "@/lib/contracts/abis/GNDMtoGUNR";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";

const GNDM_ADDRESS = "0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3" as const;

// Flip to false after the v2 contract is deployed AND addresses.ts has
// been updated with the new mainnet migration address.
const MIGRATION_PAUSED = true;

type Phase = "idle" | "approving" | "migrating" | "done" | "error";

export default function MigratePage() {
  if (MIGRATION_PAUSED) return <MigrationPausedNotice />;
  return <MigratePageInner />;
}

function MigrationPausedNotice() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-widest text-[var(--accent-2)] uppercase">
            Status
          </div>
          <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-black tracking-wider text-[var(--accent)]">
            MIGRATION PAUSED
          </h1>
        </div>
        <div className="space-y-3 text-sm text-[var(--foreground)]/80 leading-relaxed">
          <p>
            Migration v2 is being redeployed with a simplified, time-gated 1:1 swap. Any GNDM holder will be able to migrate &mdash; no whitelist required.
          </p>
          <p>
            <span className="font-bold text-[var(--accent)]">Your GNDM is safe.</span>{" "}
            <span className="font-bold text-[var(--accent)]">No action needed from you.</span>
          </p>
          <p>
            Watch{" "}
            <a
              className="text-[var(--accent)] hover:underline"
              href="https://farcaster.xyz/pyrofirezero"
              target="_blank"
              rel="noopener noreferrer"
            >
              @pyrofirezero
            </a>{" "}
            for the resume announcement.
          </p>
        </div>
        <p className="text-center text-xs text-[var(--foreground)]/30 pt-2 border-t border-[var(--border)]">
          GNDM 1:1 &rarr; GUNR &middot; Base Mainnet
        </p>
      </div>
    </main>
  );
}

function MigratePageInner() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  let contracts: ReturnType<typeof getContracts> | null = null;
  let migrationReady = false;
  try {
    contracts = getContracts(base.id);
    migrationReady = !isPlaceholder(contracts.migration);
  } catch {}

  const migrationAddress = migrationReady ? contracts!.migration : undefined;

  const { data: gndmBalance } = useReadContract({
    address: GNDM_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: gunrAddr } = useReadContract({
    address: migrationAddress,
    abi: MIGRATION_ABI,
    functionName: "gunr",
  });

  const { data: gunrInContract } = useReadContract({
    address: gunrAddr as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: migrationAddress ? [migrationAddress] : undefined,
  });

  const { data: deadline } = useReadContract({
    address: migrationAddress,
    abi: MIGRATION_ABI,
    functionName: "deadline",
  });

  const balanceWei = (gndmBalance as bigint) ?? 0n;
  const contractGunrWei = (gunrInContract as bigint) ?? 0n;
  const maxAmount = balanceWei < contractGunrWei ? balanceWei : contractGunrWei;

  const deadlineDate = deadline ? new Date(Number(deadline as bigint) * 1000) : null;
  const isExpired = deadlineDate ? deadlineDate.getTime() <= Date.now() : false;

  function daysRemaining(): string {
    if (!deadlineDate) return "—";
    const ms = deadlineDate.getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    return `${d}d ${h}h`;
  }

  function fmt(wei: bigint): string {
    const n = parseFloat(formatUnits(wei, 18));
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  async function handleMigrate() {
    if (!address || !migrationAddress || !publicClient) return;
    const amountWei = parseUnits(amount, 18);
    if (amountWei <= 0n) return;

    setPhase("approving");
    setError(null);

    try {
      const approveHash = await writeContractAsync({
        address: GNDM_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [migrationAddress, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setPhase("migrating");
      const migrateHash = await writeContractAsync({
        address: migrationAddress,
        abi: MIGRATION_ABI,
        functionName: "migrate",
        args: [amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: migrateHash });

      setTxHash(migrateHash);
      setPhase("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Migration failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  }

  if (phase === "done" && txHash) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center space-y-4">
          <div className="text-5xl">&#x2705;</div>
          <h2 className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)]">
            MIGRATION COMPLETE
          </h2>
          <p className="text-[var(--foreground)]/70">
            Your GNDM has been swapped 1:1 for GUNR.
          </p>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-[var(--foreground)]/40 hover:text-[var(--accent)] transition-colors break-all"
          >
            {txHash}
          </a>
          <button
            onClick={() => { setPhase("idle"); setTxHash(null); setAmount(""); }}
            className="w-full rounded-lg border border-[var(--border)] py-2 text-sm font-bold text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors"
          >
            Done
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-black tracking-wider text-[var(--accent)]">
            GNDM &rarr; GUNR MIGRATION
          </h1>
          <p className="text-sm text-[var(--foreground)]/60">
            Swap your GNDM for GUNR at 1:1
          </p>
          {deadlineDate && !isExpired && (
            <p className="text-xs text-[var(--foreground)]/40">
              {daysRemaining()} remaining
            </p>
          )}
          {isExpired && (
            <p className="text-xs text-red-400 font-bold">Migration window has closed</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Your GNDM", value: isConnected ? fmt(balanceWei) : "—" },
            { label: "GUNR Left", value: gunrInContract ? fmt(contractGunrWei) : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <div className="text-[10px] text-[var(--foreground)]/40 uppercase tracking-widest mb-1">{s.label}</div>
              <div className="font-[family-name:var(--font-orbitron)] font-black text-[var(--accent)] text-sm">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
          {isConnected && !isExpired && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest">
                  Amount (GNDM)
                </label>
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
              </div>

              <div className="text-center text-[var(--foreground)]/30 text-lg">&darr;</div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-center">
                <span className="text-lg font-bold text-[var(--accent)]">
                  {amount && parseFloat(amount) > 0 ? `${amount} GUNR` : "—"}
                </span>
                <span className="text-xs text-[var(--foreground)]/30 ml-2">1:1</span>
              </div>

              {phase === "error" && error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <button
                onClick={handleMigrate}
                disabled={
                  phase === "approving" ||
                  phase === "migrating" ||
                  !amount ||
                  parseFloat(amount) <= 0
                }
                className="w-full rounded-lg bg-[var(--accent)] text-black font-bold py-3 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
              >
                {phase === "approving" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    APPROVING...
                  </span>
                ) : phase === "migrating" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    MIGRATING...
                  </span>
                ) : (
                  "MIGRATE TO GUNR"
                )}
              </button>
            </>
          )}

          {!isConnected && (
            <p className="text-center text-sm text-[var(--foreground)]/50 py-2">
              Connect your wallet to migrate
            </p>
          )}

          <p className="text-center text-xs text-[var(--foreground)]/30">
            1:1 swap &middot; GNDM in, GUNR out &middot; Base Mainnet
          </p>
        </div>
      </div>
    </main>
  );
}
```

Key differences from v1 page:
- `proofData` state and `fetch("/migration-proofs.json")` effect — REMOVED
- `migrated(address)` read — REMOVED (function no longer exists on v2)
- "NOT ON WHITELIST" red box — REMOVED
- `migrate()` call args: `[amountWei]` only (was `[amountWei, BigInt(proofData.cap), proofData.proof]`)
- Stats grid: 3 cards → 2 cards (removed "Your Cap")
- `maxAmount` uses balance vs contract GUNR (whichever is smaller), not cap

- [ ] **Step 2: Lint**

Run from repo root:
```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Type-check via build**

Run from repo root:
```bash
npm run build
```
Expected: clean Next.js build, no TypeScript errors.

---

### Task 7: Commit frontend code

- [ ] **Step 1: Stage and commit**

```bash
git add src/lib/contracts/abis/GNDMtoGUNR.ts src/app/migrate/page.tsx
git commit -m "$(cat <<'EOF'
feat(migrate): simplify frontend for v2 migration contract

- Update ABI for new 4-arg constructor, migrate(amount) signature, admin surface
- Remove proof-file fetch and whitelist UI from migrate page
- migrate() now takes just (amount); no cap/proof args
- Remove migrated(address) read (function dropped from v2 contract)
- Stats grid simplified: removed "Your Cap" tile

MIGRATION_PAUSED stays true until the v2 contract is deployed and
src/lib/contracts/addresses.ts is updated with the new address.

Spec: docs/superpowers/specs/2026-05-22-migration-redeploy-design.md
EOF
)"
```

---

## Phase C — Deploy contract to Base mainnet

### Task 8: Pre-deploy GUNR balance check

- [ ] **Step 1: Verify deployer holds ≥ 50M GUNR**

Run from repo root:
```bash
cast call 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07 \
  "balanceOf(address)(uint256)" \
  0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7 \
  --rpc-url https://mainnet.base.org
```
Expected: a number ≥ 50000000000000000000000000 (50M with 18 decimals).

If less than 50M, STOP. Investigate before proceeding. (Per memory, the 50M from the broken v1 contract was withdrawn back to deployer on 2026-05-15; this number should be comfortable above 50M.)

---

### Task 9: Deploy v2 contract via forge create

**Files:** none (on-chain deploy)

- [ ] **Step 1: Deploy with --verify**

Run from `contracts/`. Compute deadline first (60 days from now as a Unix timestamp):

```bash
DEADLINE=$(($(date +%s) + 60 * 86400))
echo "Deadline timestamp: $DEADLINE"

forge create src/GNDMtoGUNR.sol:GNDMtoGUNR \
  --rpc-url https://mainnet.base.org \
  --account deployer \
  --constructor-args \
    0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7 \
    0xFc7008F9157257a17a9Fb3c602b1CD56C27A4ba3 \
    0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07 \
    $DEADLINE \
  --verify \
  --etherscan-api-key "$BASESCAN_API_KEY"
```

Expected output:
- `Deployer: 0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7`
- `Deployed to: 0x...` ← **record this address as `$NEW_MIGRATION` for next steps**
- `Transaction hash: 0x...`
- `Submitted contract for verification: 0x...`
- `Contract successfully verified`

If `--verify` fails (it sometimes lags Basescan availability), the contract is still deployed — verification can be retried separately with `forge verify-contract`.

- [ ] **Step 2: Record address**

Save the deployed address. You'll paste it into the next steps as `$NEW_MIGRATION`.

---

### Task 10: Post-deploy verification via cast call

- [ ] **Step 1: Verify owner**

Replace `$NEW_MIGRATION` with the actual deployed address from Task 9:

```bash
cast call $NEW_MIGRATION "owner()(address)" --rpc-url https://mainnet.base.org
```
Expected: `0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7`

- [ ] **Step 2: Verify deadline**

```bash
cast call $NEW_MIGRATION "deadline()(uint256)" --rpc-url https://mainnet.base.org
```
Expected: approximately `now + 60 days` in Unix seconds. Sanity-check by piping through `date -r <number>`.

- [ ] **Step 3: Verify token addresses**

```bash
cast call $NEW_MIGRATION "gndm()(address)" --rpc-url https://mainnet.base.org
cast call $NEW_MIGRATION "gunr()(address)" --rpc-url https://mainnet.base.org
```
Expected: `0xFc7008F9157257a17a9Fb3c602b1CD56C27A4ba3` and `0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07`.

- [ ] **Step 4: Verify paused state**

```bash
cast call $NEW_MIGRATION "paused()(bool)" --rpc-url https://mainnet.base.org
```
Expected: `false` (default; not paused on deploy).

**If any check above fails, STOP** and investigate before proceeding. Do not fund a contract whose state doesn't match expectations.

---

### Task 11: Fund the contract with 50M GUNR

- [ ] **Step 1: Transfer 50M GUNR from deployer to contract**

Replace `$NEW_MIGRATION` with the address from Task 9:

```bash
cast send 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07 \
  "transfer(address,uint256)" \
  $NEW_MIGRATION \
  50000000000000000000000000 \
  --account deployer \
  --rpc-url https://mainnet.base.org
```

Expected: transaction succeeds, returns receipt with status 1.

- [ ] **Step 2: Verify contract GUNR balance**

```bash
cast call 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07 \
  "balanceOf(address)(uint256)" \
  $NEW_MIGRATION \
  --rpc-url https://mainnet.base.org
```
Expected: `50000000000000000000000000` (exactly 50M with 18 decimals).

---

### Task 12: Update addresses.ts and flip MIGRATION_PAUSED to false

**Files:**
- Modify: `src/lib/contracts/addresses.ts`
- Modify: `src/app/migrate/page.tsx`

- [ ] **Step 1: Update migration address in addresses.ts**

In `src/lib/contracts/addresses.ts`, on the line:

```ts
    migration: "0xefbD485bFbDb9aC766659811151CB2b6e43A7261",
```

Replace `0xefbD485bFbDb9aC766659811151CB2b6e43A7261` with the new address from Task 9 (preserve the `0x` prefix and the trailing comma).

- [ ] **Step 2: Flip MIGRATION_PAUSED to false**

In `src/app/migrate/page.tsx`, on the line:

```ts
const MIGRATION_PAUSED = true;
```

Change `true` to `false`.

- [ ] **Step 3: Lint + build**

Run from repo root:
```bash
npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/contracts/addresses.ts src/app/migrate/page.tsx
git commit -m "$(cat <<'EOF'
feat(migrate): wire up v2 migration contract on Base mainnet

New v2 address: <NEW_MIGRATION_ADDRESS>
Contract verified on Basescan: https://basescan.org/address/<NEW_MIGRATION_ADDRESS>
Funded with 50M GUNR. Deadline: 60 days from deploy.

Flips MIGRATION_PAUSED to false — migrate page is live again.

Spec: docs/superpowers/specs/2026-05-22-migration-redeploy-design.md
EOF
)"
```

Replace `<NEW_MIGRATION_ADDRESS>` with the actual deployed address before running the commit.

---

### Task 13: Deploy frontend to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```
Vercel auto-deploys on push to `main`. If not configured to auto-deploy, run `vercel --prod` from repo root.

- [ ] **Step 2: Verify the migrate page is live**

Visit `https://gundarium.vercel.app/migrate` in a browser. Expected:
- Page loads without errors
- Shows the migration UI (not the "MIGRATION PAUSED" notice)
- Connect Wallet button works
- Once connected with a GNDM-holding wallet, "Your GNDM" stat shows real balance
- "GUNR Left" shows ~50M
- Days remaining shows ~60d

If any of the above fails, immediately re-pause by setting `MIGRATION_PAUSED = true`, committing, pushing, and debugging.

---

## Phase D — Smoke test + post-launch

### Task 14: Coordinate live smoke test with a real GNDM holder

- [ ] **Step 1: DM Donald or NomadicFrame**

Use Farcaster DM. Suggested message (Donald):

> Migration is live again with a much simpler contract — no whitelist, no proofs, just connect wallet, enter amount, swap. The new contract is `<NEW_MIGRATION_ADDRESS>` (verified on Basescan). Want to do a small test migration first (e.g., 100K GNDM) so we confirm it works before you migrate your full 32M?

- [ ] **Step 2: Watch the test transaction on Basescan**

Once they confirm they're going to do it, watch `https://basescan.org/address/<NEW_MIGRATION_ADDRESS>` for the next `Migrated` event.

Expected: tx succeeds, GNDM balance moves to contract, GUNR moves to their wallet, `Migrated(user, amount)` event fires.

If it reverts:
1. Immediately call `cast send $NEW_MIGRATION "pause()" --account deployer --rpc-url https://mainnet.base.org`
2. Debug the revert reason from Basescan
3. Do not unpause until the bug is understood and fixed

---

### Task 15: Submit Base verification request

Per `https://docs.base.org/base-chain/security/avoid-malicious-flags`.

- [ ] **Step 1: Submit verification request**

Visit the Base verification request page (linked from the avoid-malicious-flags doc). Submit a request including:
- New contract address
- Basescan verified-source link
- One-line purpose: "GNDM→GUNR 1:1 token migration for GundariuM, 60-day window"
- Link to the GundariuM project (gundarium.vercel.app)

This reduces Coinbase Wallet false-positive flags. Past Blockaid flag history (see project memory) makes this worth doing for any new mainnet contract.

---

### Task 16: Announce migration is live

- [ ] **Step 1: Cast on Farcaster from @pyrofirezero**

Suggested cast:

> $GUNR migration v2 is live on Base mainnet.
>
> If you hold $GNDM, swap 1:1 to $GUNR at gundarium.vercel.app/migrate
>
> No whitelist this time — any GNDM holder can migrate. Contract: `<NEW_MIGRATION_ADDRESS>`
>
> 60-day window. ~50M GUNR available.

- [ ] **Step 2: Direct DMs to known whitelisted holders**

Send personal DMs to:
- Donald (`darganmage35`) — up to 32M GNDM
- NomadicFrame — confirm which of his 3 wallets per `reference_nomadicframe`
- KayOnFire
- Grat Pack channel

Inform that the migration is live and walk them through if needed.

---

## Self-review notes

- **Spec coverage:** Every section of the design spec maps to at least one task (contract → Tasks 1-2, deploy script → Task 3, frontend → Tasks 5-7, deploy + funding + transition → Tasks 8-13, smoke test → Task 14, Base verification → Task 15, announce → Task 16).
- **Constructor zero-owner test:** OZ Ownable v5 catches `address(0)` before our body runs, so the test expects `OwnableInvalidOwner` instead of our `ZeroAddress`. The spec's wording ("if (owner_ == address(0) || ...) revert ZeroAddress") is approximate — the implementation in Task 1 correctly defers the owner check to OZ.
- **Pause-then-recover invariant:** Task 6's frontend assumes `paused()` is false on deploy (Task 10 step 4 verifies this). If you ever flip pause on for an emergency, the migrate page button will fire migrate calls that revert with `EnforcedPause` — handled by the existing error path.
- **MIGRATION_PAUSED constant vs on-chain pause:** these are independent. The constant gates the entire React page; the on-chain pause gates the `migrate()` function only. Both default open in this plan after Task 12.
