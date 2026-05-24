# GNDM→GUNR Migration v2 — Redeploy Design Spec

**Date:** 2026-05-22
**Status:** Approved
**Supersedes:** `2026-04-15-gndm-to-gunr-migration-design.md`
**Ship target:** Within days (Donald + NomadicFrame + Grat Pack have been waiting since 2026-04-30)

---

## Overview

Redeploy the broken `GNDMtoGUNR` migration contract on Base mainnet as a **dramatically simplified flat contract**: no Merkle whitelist, no per-address caps, no proof verification. Just a time-gated 1:1 swap with admin failsafes.

This is the LAST flat contract in this project. Per [[feedback_uups_default]], all future mainnet contracts ship as UUPS proxies. This one is grandfathered because (a) it's a 60-day throwaway and (b) we're in crunch mode.

## Context — why we're simplifying

The v1 contract was over-engineered for a threat model that no longer exists. The Merkle whitelist + per-address caps were designed to prevent secondary-market GNDM accumulation arbitrage:

| Imagined threat (v1 design) | Actual reality |
|---|---|
| Attacker buys GNDM cheaply on secondary, migrates 1:1 to GUNR, dumps for profit | GNDM is abandoned. LP is locked by Bankr. There is no liquid GNDM market to buy from. |
| Airdrop dust holders Sybil-attack across many addresses to claim more than their share | Caps were per-address, not per-person — Sybil attack already trivially defeats the cap. The cap only ever applied honest behavior. |
| GUNR price gets dumped by mass migration | GUNR LP is currently $89. The market depth is too thin for migration-and-dump to be profitable at any scale. |

**The funding amount IS the only cap that matters.** Contract holds 50M GUNR; once 50M migrates out, the next `safeTransfer` reverts. Total migration is bounded by what we fund, not by per-address limits.

**Why this matters for bug surface:** the v1 leaf-encoding bug existed because the contract had Merkle verification code AND a separate proof generator that had to match. Removing the entire whitelist mechanism eliminates that bug class entirely. The simplest code is the code that can't have the bug.

See [[project_migration_bug]] for full root-cause history of the v1 leaf-encoding mismatch.

## Locked decisions (from 2026-05-22 brainstorm)

| Decision | Value | Rationale |
|---|---|---|
| **Whitelist mechanism** | **Removed entirely** | Threat model didn't justify it; eliminating merkle code eliminates merkle bug class |
| **Per-address caps** | **Removed entirely** | Funding amount is the only cap that matters |
| **`migrated[address]` mapping** | **Removed** | Indexers + event logs cover off-chain observability without on-chain storage cost |
| `deadline_` constructor arg | 60 days from deploy | Joshua: "thats more than enough" |
| Admin failsafe shape | **Pause + setDeadline + recoverToken** | No `setMerkleRoot` (nothing to set) |
| Setter guardrails | None — owner can change deadline anytime | 60-day owner-trusted throwaway; flexibility > trust-minimization |
| Recovery surface | `recoverToken(token, to, amount)` | Fully flexible |
| File organization | Edit `GNDMtoGUNR.sol` in place | Filename has no on-chain effect |
| Funding | 50M GUNR transferred from deployer post-deploy | Same as v1 |
| Owner | `0x9D62...` (deployer, via OZ Ownable) | Same as v1 |
| Token addresses | GNDM `0xFc70...4ba3`, GUNR `0x825E...DB07` (immutable) | Same as v1 |
| UUPS policy | Flat for THIS contract; UUPS for all future contracts | See [[feedback_uups_default]] |
| Whitelist JSON files | Kept as historical reference in `scripts/` | Low cost; useful record of who v1 was meant for |

---

## Contract design

### Inheritance

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract GNDMtoGUNR is Ownable, Pausable
```

`SafeERC20` is project convention (per `CLAUDE.md`). `MerkleProof` import is GONE.

### State

```solidity
IERC20 public immutable gndm;
IERC20 public immutable gunr;
uint256 public deadline;     // was immutable in v1; now mutable
```

`owner` inherited from `Ownable`. No `merkleRoot`. No `migrated` mapping. That's the entire state.

### Events

```solidity
event Migrated(address indexed user, uint256 amount);
event DeadlineUpdated(uint256 oldDeadline, uint256 newDeadline);
event TokenRecovered(address indexed token, address indexed to, uint256 amount);
```

`Paused`/`Unpaused` come from OZ `Pausable`.

### Custom errors

```solidity
error ZeroAddress();
error DeadlineInPast();
error DeadlinePassed();
```

That's all. No `NotInWhitelist`, no `CapExceeded`.

### Constructor

```solidity
constructor(
    address owner_,
    address gndm_,
    address gunr_,
    uint256 deadline_
) Ownable(owner_) {
    if (owner_ == address(0) || gndm_ == address(0) || gunr_ == address(0)) revert ZeroAddress();
    if (deadline_ <= block.timestamp) revert DeadlineInPast();
    gndm = IERC20(gndm_);
    gunr = IERC20(gunr_);
    deadline = deadline_;
}
```

No `merkleRoot_` parameter.

### User function — `migrate`

```solidity
function migrate(uint256 amount) external whenNotPaused {
    if (block.timestamp > deadline) revert DeadlinePassed();
    gndm.safeTransferFrom(msg.sender, address(this), amount);
    gunr.safeTransfer(msg.sender, amount);
    emit Migrated(msg.sender, amount);
}
```

Six lines of body. No proof, no cap, no whitelist check. The `safeTransferFrom` enforces that caller actually holds the GNDM. The `safeTransfer` reverts if the contract runs out of GUNR — which is the natural total-supply cap.

### Owner functions

```solidity
function setDeadline(uint256 newDeadline) external onlyOwner {
    uint256 oldDeadline = deadline;
    deadline = newDeadline;
    emit DeadlineUpdated(oldDeadline, newDeadline);
}

function pause() external onlyOwner { _pause(); }
function unpause() external onlyOwner { _unpause(); }

function recoverToken(address token, address to, uint256 amount) external onlyOwner {
    if (to == address(0)) revert ZeroAddress();
    IERC20(token).safeTransfer(to, amount);
    emit TokenRecovered(token, to, amount);
}
```

**Notes:**
- `setDeadline` is fully unrestricted (no extend-only rail). Matches minimal-guardrails decision.
- `pause` blocks `migrate` only. Setters and `recoverToken` remain callable when paused.
- `recoverToken` is unrestricted by design — explicit trust trade.

---

## Tests

`contracts/test/GNDMtoGUNR.t.sol` is simplified significantly. New test surface:

| Test | Asserts |
|---|---|
| `testMigrateHappyPath` | User approves GNDM, calls migrate, receives GUNR 1:1; `Migrated` event fires |
| `testMigrateRevertsAfterDeadline` | After deadline passes, migrate reverts with `DeadlinePassed` |
| `testMigrateRevertsWithoutGndmApproval` | Without approval, `safeTransferFrom` reverts |
| `testMigrateRevertsWhenContractOutOfGunr` | Contract holds less GUNR than migrate amount → `safeTransfer` reverts |
| `testMigrateRevertsWhenPaused` | Owner pauses, user migrate reverts |
| `testMigrateSucceedsAfterUnpause` | pause → unpause → migrate succeeds |
| `testSetDeadline` | Owner updates deadline (both directions); migrate respects new value |
| `testSetDeadlineOnlyOwner` | Non-owner reverts |
| `testPauseOnlyOwner` / `testUnpauseOnlyOwner` | Access control |
| `testRecoverTokenTransfersBalance` | Owner drains GUNR + GNDM + a random token, to arbitrary `to`, partial amount |
| `testRecoverTokenOnlyOwner` | Non-owner reverts |
| `testRecoverTokenZeroAddressReverts` | `to == 0` reverts with `ZeroAddress` |
| `testSettersWorkWhenPaused` | Confirms pause does NOT block admin functions |
| `testConstructorRevertsOnZeroAddress` | Each zero address triggers `ZeroAddress` |
| `testConstructorRevertsOnPastDeadline` | `deadline_ <= block.timestamp` triggers `DeadlineInPast` |

Removed tests (no longer relevant): all merkle proof generation, all cap enforcement, all whitelist verification.

---

## Operational prereqs (before deploy)

The v1 prereq list shrinks dramatically — no Merkle generation step:

1. **Verify deployer balance** — confirm `0x9D62` holds ≥ 50M GUNR before deploy
2. **Update `contracts/script/DeployMigration.s.sol`** — change `deadline = block.timestamp + 30 days` to `60 days`; remove `MERKLE_ROOT` env var read; remove `merkleRoot` constructor arg from `new GNDMtoGUNR(...)` call

Removed prereqs (no longer needed):
- ~~Update `scripts/migration-whitelist.json` for Donald cap correction~~
- ~~Regenerate merkle tree + proofs~~
- ~~Verify all proofs via verifier script~~

The whitelist + proofs JSON files stay on disk as historical reference but are no longer consumed by anything.

## Deploy + transition flow

Per [[feedback_eip7702_deploy]] (no multi-tx forge broadcasts) and [[feedback_deploy_safety]] (keystore only, verify owner post-deploy):

1. `forge create src/GNDMtoGUNR.sol:GNDMtoGUNR --rpc-url $BASE_MAINNET_RPC_URL --account deployer --constructor-args $OWNER $GNDM $GUNR $DEADLINE --verify`
   - Single tx, EIP-7702 safe
   - `--verify` flag auto-verifies on Basescan
   - Note: 4 constructor args now, not 5 (merkleRoot is gone)
2. **Post-deploy verification (mandatory):**
   - `cast call $NEW_CONTRACT "owner()(address)"` → must equal `0x9D62...`
   - `cast call $NEW_CONTRACT "deadline()(uint256)"` → must equal block.timestamp + 60d
   - `cast call $NEW_CONTRACT "gndm()(address)"` → must equal `0xFc70...4ba3`
   - `cast call $NEW_CONTRACT "gunr()(address)"` → must equal `0x825E...DB07`
3. `cast send $GUNR "transfer(address,uint256)" $NEW_CONTRACT 50000000000000000000000000 --account deployer` (50M GUNR with 18 decimals)
4. **Update `src/lib/contracts/addresses.ts`** — replace `migration` field with new address
5. **Simplify `src/app/migrate/page.tsx`:**
   - Remove proof file fetch (`fetch('/migration-proofs.json')`)
   - Remove `cap` and `proof` arguments from `migrate()` call site
   - User input: amount only (gated by their actual GNDM balance, which the page already reads)
   - Set `MIGRATION_PAUSED = false`
6. **Remove `public/migration-proofs.json`** — no longer needed by frontend (or leave it; harmless either way)
7. `vercel --prod`
8. **Smoke test via a real GNDM holder** — Joshua's deployer is not a major GNDM holder, but anyone with GNDM can now test. Coordinate a live first migration with Donald or NomadicFrame. Watch the tx; confirm `Migrated` event fires. If it reverts: re-pause via `pause()`, debug, fix.
9. **Submit Base verification request** per `https://docs.base.org/base-chain/security/avoid-malicious-flags` — reduces Coinbase Wallet false-positive flags. Especially relevant given prior history with [[project_trust_wallet]] Blockaid flags.
10. **Announce** to Donald, NomadicFrame (3 wallets per [[reference_nomadicframe]]), Grat Pack, Kay — the announcement is now simpler since there's no whitelist proof to look up

---

## Out of scope (explicit non-goals)

- Migrating to UUPS for this contract — see UUPS policy decision above
- Changing the migration ratio (stays 1:1)
- Re-introducing any form of whitelist or per-address cap
- Permanently locking setters after some condition — the simple flat surface is the design
- Multi-signature ownership — single-EOA owner is the design
- Cross-chain migration — same chain (Base mainnet) only

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Owner key compromise during 60-day window | Out of scope; protected by Joshua's keystore (per [[feedback_deploy_safety]]) and EIP-7702 wallet warnings |
| **Logic bug in `migrate()` body itself** | Accepted — would require another flat redeploy. Surface is now 6 lines of pure transfer logic with no math — bug surface is minimal. This is the reason the next contract will be UUPS. |
| **Unknown GNDM holder appears and drains** | Total exposure is bounded by 50M GUNR funding. Per [[project_migration_bug]], 124 known holders total ~69M GNDM capped (actual balances ~42-44M). Worst case: more demand than supply → late comers get `safeTransfer` revert and Joshua can pause and decide whether to add funding. |
| **Total GNDM supply exceeds 50M GUNR funding** | First-come-first-served until 50M is drained. Joshua can pause and top up if he chooses. Joshua can also pause early and refuse to top up if he prefers. |
| Coinbase Wallet flags the new contract as malicious | Verify on Basescan via `--verify`; submit Base verification request; Blockaid contact ready per [[project_trust_wallet]] |
| GUNR insufficient when funding | Pre-deploy balance check is step 1 of operational prereqs |

**Risks REMOVED vs v1 design:**
- ~~Merkle leaf-encoding mismatch between contract and generator~~ — no merkle code in v2
- ~~Proof file out-of-sync with on-chain root~~ — no proofs
- ~~User not in whitelist edge cases~~ — no whitelist
- ~~Per-address cap accounting bugs~~ — no caps

---

## Affected files

| File | Change |
|---|---|
| `contracts/src/GNDMtoGUNR.sol` | Edit in place — simplified rewrite per design above |
| `contracts/script/DeployMigration.s.sol` | 60-day deadline; remove MERKLE_ROOT env var; 4-arg constructor call |
| `contracts/test/GNDMtoGUNR.t.sol` | Rewrite test suite — remove all merkle/cap tests, add admin function tests |
| `src/lib/contracts/addresses.ts` | `migration` field updated to new mainnet address post-deploy |
| `src/app/migrate/page.tsx` | Remove proof file fetch; remove cap+proof args from migrate call; `MIGRATION_PAUSED = false` |
| `src/lib/contracts/abis/` | Update migration contract ABI (signature changed) |
| `public/migration-proofs.json` | Delete or leave (frontend no longer reads it) |
| `scripts/migration-whitelist.json` | **Unchanged** — kept as historical reference |
| `scripts/migration-proofs.json` | **Unchanged** — kept as historical reference |
| `scripts/generate-migration-merkle.ts` | **Unchanged** — vestigial; kept as historical reference |
| `scripts/verify-migration-proofs.ts` | **Unchanged** — vestigial; kept as historical reference |
