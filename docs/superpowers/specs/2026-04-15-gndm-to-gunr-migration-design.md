# GNDM→GUNR Migration — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Ship deadline:** Today (2026-04-15)

---

## Overview

A one-time migration contract that allows whitelisted GNDM holders to swap their GNDM for GUNR at a fixed 1:1 rate. Merkle-based whitelist with per-address caps prevents arbitrage abuse. 30-day window.

## Context

- $GNDM (old token): `0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3` — LP locked by Bankr, token abandoned
- $GUNR (new token): `0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07` — deployed via Clanker
- ~98M GUNR available in Treasury (0x6e5b...) + Farcaster wallet (0xB98F...)
- ~44.4M GNDM in real holder wallets needing migration
- 193 total GNDM holders, most are airdrop dust

## Known Holders

| Who | Address | GNDM Balance | Cap |
|-----|---------|-------------|-----|
| Donald (darganmage35) | 0xdff4c57a8d0e025931a725197c9412920b385bbc | 32.44M | 33,000,000 |
| nomadicframe | 0xa036225142c4f464Ac1c1E04cA663809B4CFc1BC | 9.77M | 10,000,000 |
| Unknown | 0x4ed1db2e021a1807c329cd069151309f43fc39c2 | ~2M | 2,000,000 |
| Unknown | 0x6e92a772b1bd702209434190d71c276a57311109 | 151K | 200,000 |
| ~256 airdrop claimers | various | ~100K each | 200,000 each |

## Smart Contract: `GNDMtoGUNR.sol`

**Not upgradeable.** Single-use, flat, auditable. Target: under 80 lines.

### State

```
IERC20 public immutable gndm;
IERC20 public immutable gunr;
bytes32 public immutable merkleRoot;
uint256 public immutable deadline;
address public immutable owner;
mapping(address => uint256) public migrated;  // tracks how much each address has swapped
```

### Functions

| Function | Access | Description |
|----------|--------|-------------|
| `constructor(gndm, gunr, merkleRoot, deadline)` | deploy | Sets immutable state, deployer = owner |
| `migrate(uint256 amount, uint256 cap, bytes32[] proof)` | public | Verify proof for `(msg.sender, cap)`, check `migrated[sender] + amount <= cap`, check `block.timestamp <= deadline`, transfer GNDM in, transfer GUNR out |
| `withdrawGUNR()` | owner, after deadline | Withdraw remaining GUNR to owner |
| `withdrawGNDM()` | owner only | Withdraw accumulated GNDM at any time |

### Merkle Leaf Encoding

```solidity
bytes32 leaf = keccak256(abi.encodePacked(address, uint256 cap));
```

Each address is whitelisted with a specific migration cap. The user passes their cap + proof when calling `migrate()`.

### Events

```solidity
event Migrated(address indexed user, uint256 amount, uint256 totalMigrated);
```

### Error Cases

- "Migration: not in whitelist" — invalid proof
- "Migration: cap exceeded" — migrated + amount > cap
- "Migration: deadline passed" — block.timestamp > deadline
- "Migration: insufficient GUNR" — contract doesn't have enough GUNR to send

## Migration Whitelist Script

**File:** `scripts/migration-whitelist.json`

```json
[
  { "address": "0xdff4c57a8d0e025931a725197c9412920b385bbc", "cap": 33000000 },
  { "address": "0xa036225142c4f464Ac1c1E04cA663809B4CFc1BC", "cap": 10000000 },
  { "address": "0x4ed1db2e021a1807c329cd069151309f43fc39c2", "cap": 2000000 },
  { "address": "0x6e92a772b1bd702209434190d71c276a57311109", "cap": 200000 }
]
```

Plus airdrop claimers added from Basescan holder export (cap: 200,000 each).

**File:** `scripts/generate-migration-merkle.ts`

Same pattern as mint whitelist — uses `@openzeppelin/merkle-tree` with leaf type `["address", "uint256"]`. Outputs root + per-address proofs to `scripts/migration-proofs.json`.

## Frontend: `/migrate` Page

### Layout

Single-card centered page matching GundariuM dark theme:

1. **Header:** "GNDM → GUNR MIGRATION" with countdown timer showing days remaining
2. **Info bar:** GUNR available in contract / user's GNDM balance / user's migration cap
3. **Input:** Amount field with MAX button (capped at min(balance, remaining cap))
4. **Button:** "MIGRATE" — approve GNDM → call migrate() → success
5. **Status:** Shows amount already migrated out of cap
6. **Not whitelisted state:** Message explaining only verified holders can migrate, link to contact Joshua

### Flow

1. Connect wallet
2. Page reads: user's GNDM balance, their migration cap from proofs JSON, amount already migrated
3. User enters amount (or clicks MAX)
4. Click MIGRATE → approve GNDM → call migrate(amount, cap, proof)
5. Success screen: "Migrated X GNDM → X GUNR" with BaseScan link

### Files

| File | Action |
|------|--------|
| `contracts/src/GNDMtoGUNR.sol` | Create |
| `contracts/test/GNDMtoGUNR.t.sol` | Create |
| `contracts/script/DeployMigration.s.sol` | Create |
| `scripts/migration-whitelist.json` | Create |
| `scripts/generate-migration-merkle.ts` | Create |
| `src/app/migrate/page.tsx` | Create |
| `src/lib/contracts/abis/GNDMtoGUNR.ts` | Create (after forge build) |
| `src/lib/contracts/addresses.ts` | Modify (add migration contract address) |
| `src/components/nav/Navbar.tsx` | Modify (add Migrate link) |

## Deploy Plan

1. Compile contract + run tests
2. Deploy to Base mainnet: `forge script script/DeployMigration.s.sol --broadcast --account deployer`
3. Verify on Basescan
4. Deposit GUNR into the contract (transfer from Treasury wallet)
5. Verify: `cast call $MIGRATION "gunr()" && cast call $MIGRATION "deadline()"`
6. Update `addresses.ts` with deployed address
7. Deploy frontend to Vercel

## Not In Scope

- No upgradeable proxy
- No admin rate changes (fixed 1:1)
- No pause mechanism (deadline is the cutoff)
