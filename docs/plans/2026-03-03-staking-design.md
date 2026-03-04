# GNDM Staking Page — Design Doc
_2026-03-03_

## Overview

Build a `/stake` page where users can stake GNDM tokens to unlock game tiers. PVP and leaderboard access require a minimum of 5M GNDM staked (Sergeant tier). UI hooks are wired to a placeholder contract address — drop in the real address + ABI when the contract is deployed.

## Scope

- **New:** `src/app/stake/page.tsx` — staking page
- **New:** `src/lib/contracts/abis/GNDMStaking.ts` — staking contract ABI
- **New:** `src/lib/contracts/hooks/useStaking.ts` — staking read/write hooks
- **Modify:** `src/lib/contracts/addresses.ts` — add `gndmStaking` placeholder
- **Modify:** `src/components/nav/Navbar.tsx` — add Stake link
- Middleware unchanged — `/stake` is live immediately

---

## Tiers

| Tier | Min Staked | Unlocks |
|------|-----------|---------|
| Recruit | 1,000,000 GNDM | Dashboard access |
| Sergeant | 5,000,000 GNDM | ⚔️ PVP + 🏆 Leaderboard |
| Commander | 25,000,000 GNDM | Prize pool multiplier |
| Legend | 100,000,000 GNDM | Exclusive status + all perks |

---

## Page Sections

### 1. Header
Title: "STAKE GNDM" · Subtitle: "Lock your tokens. Unlock the battlefield."

### 2. Stats Bar
Three cards: GNDM Balance · Currently Staked · Current Tier

### 3. Tier Ladder
Visual strip — current tier highlighted, locked tiers dimmed, unlock badges per tier.

### 4. Stake / Unstake Panel
Two tabs (Stake | Unstake). Input + quick amounts. Two-step ERC20 approve → stake flow. Shows projected tier after staking.

### 5. Contract Interface

**Reads (via wagmi `useReadContract`):**
- `balanceOf(address)` → ERC20 GNDM balance
- `stakedBalance(address)` → amount staked by user
- `totalStaked()` → protocol-wide total

**Writes (via wagmi `useWriteContract`):**
- `approve(spender, amount)` → ERC20 approve staking contract
- `stake(uint256 amount)` → lock GNDM
- `unstake(uint256 amount)` → withdraw GNDM

---

## Constants
- GNDM token: `0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3` (Base mainnet)
- Staking contract: `0x0000000000000000000000000000000000000000` (placeholder)
- Chain: Base mainnet (8453)

## Constraints
- No new npm packages
- TypeScript strict, no `tsc` errors
- Dark sci-fi theme consistent with rest of site
- Staking contract not yet deployed — UI must gracefully handle missing contract (show "Coming Soon" state when address is zero)
