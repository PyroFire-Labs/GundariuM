# GUNR Clean Pool — Execution Runbook

> **Manual execution by the owner.** This runbook moves real funds and requires the
> `deployer` keystore (wallet `0x9D62`). It is NOT for a subagent and NOT for the
> assistant to run — the assistant stands by to verify each step on-chain. Run it
> when fresh and unhurried.

**Goal:** Create a fresh, hookless Uniswap V3 GUNR/WETH pool on Base, seeded with
**0.026385 WETH + ~267M GUNR** at the current market price, so GUNR becomes buyable on
every wallet and aggregator.

> **UPDATED 2026-06-17:** Actual on-chain WETH = `0.026385210459845447` (less than the
> original 0.03 target; only 0.0014 ETH left, needed for gas → NO wrapping). Seed amounts
> below recomputed to match. Price (sqrtPriceX96) is unchanged — the GUNR side scales down
> with the WETH. Pre-flight re-verified: no V3 1% pool exists, GUNR balance 18.1B.

**Architecture:** Uniswap V3 (no hooks → universal router/aggregator support).
Pool created and full-range liquidity minted via the canonical
NonfungiblePositionManager, funded entirely from the deployer wallet which already
holds both assets. Single `cast send` calls (the wallet is EIP-7702 delegated, so
no multi-tx forge broadcasts — see `feedback_eip7702_deploy`).

**Tech stack:** Foundry `cast`, Uniswap V3 on Base mainnet (chainid 8453).

Approved spec: `docs/superpowers/specs/2026-06-05-gunr-clean-pool-design.md`

---

## Constants (verified on-chain 2026-06-05)

```
WETH     = 0x4200000000000000000000000000000000000006   (token0 — lower address)
GUNR     = 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07   (token1)
NFPM     = 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1   (V3 NonfungiblePositionManager, Base)
FACTORY  = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD   (V3 Factory, Base)
QUOTERV2 = 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a   (V3 QuoterV2, Base)
DEPLOYER = 0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7   (owner / recipient)

fee          = 10000            (1% tier, tickSpacing 200)
sqrtPriceX96 = 7973503768384402773302369423813468   (clone of current Clanker price)
tickLower    = -887200
tickUpper    =  887200
```

Seed amounts (wei) — **UPDATED 2026-06-17 for 0.026385 WETH**:
```
WETH seed (amount0Desired) = 26385210459845447                    (0.026385 WETH, full balance)
WETH amount0Min            = 26000000000000000                    (0.026, ~98.5%)
GUNR amount1Desired        = 275000000000000000000000000          (275M, ~3% buffer over ~267.24M)
GUNR amount1Min            = 255000000000000000000000000          (255M floor)
```
At our self-set price the mint pulls ~0.026385 WETH (WETH is the binding side) and
~267.24M GUNR; the unused GUNR buffer (~7.8M) is returned.

**Shell setup (paste once per terminal session):**
```bash
export RPC="https://mainnet.base.org"   # or your Coinbase CDP Base mainnet RPC
WETH=0x4200000000000000000000000000000000000006
GUNR=0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07
NFPM=0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1
FACTORY=0x33128a8fC17869897dcE68Ed026d694621f6FDfD
QUOTERV2=0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
DEPLOYER=0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7
```
Every `cast send` uses `--account deployer --rpc-url $RPC` (you'll be prompted for
the keystore password). Each waits for confirmation before you run the next.

---

## Task 1: Pre-flight checks

- [ ] **Step 1: Confirm no V3 1% pool exists yet**

```bash
cast call $FACTORY "getPool(address,address,uint24)(address)" $WETH $GUNR 10000 --rpc-url $RPC
```
Expected: `0x0000000000000000000000000000000000000000` (if it returns a non-zero
address, the pool already exists — STOP and skip to Task 3, mint only).

- [ ] **Step 2: Confirm balances cover the seed**

```bash
echo "ETH:  $(cast from-wei $(cast balance $DEPLOYER --rpc-url $RPC))"
echo "WETH: $(cast call $WETH 'balanceOf(address)(uint256)' $DEPLOYER --rpc-url $RPC)"
echo "GUNR: $(cast call $GUNR 'balanceOf(address)(uint256)' $DEPLOYER --rpc-url $RPC)"
```
Expected: WETH = 0.026385; GUNR ≫ 275M (you have 18.1B); ETH ≥ ~0.0013 for gas (you have 0.001397 — thin but OK on Base).

---

## Task 2: Wrap ETH → WETH — **SKIP (2026-06-17)**

Do NOT wrap. You already hold 0.026385 WETH and only 0.0014 ETH (reserved for gas).
The seed uses your existing WETH as-is. Go straight to Task 3.

---

## Task 3: Approvals

- [ ] **Step 1: Approve WETH to the position manager**

```bash
cast send $WETH "approve(address,uint256)" $NFPM 27000000000000000 --account deployer --rpc-url $RPC
```
Expected: confirmed.

- [ ] **Step 2: Approve GUNR to the position manager**

```bash
cast send $GUNR "approve(address,uint256)" $NFPM 280000000000000000000000000 --account deployer --rpc-url $RPC
```
Expected: confirmed.

- [ ] **Step 3: Verify allowances**

```bash
cast call $WETH "allowance(address,address)(uint256)" $DEPLOYER $NFPM --rpc-url $RPC
cast call $GUNR "allowance(address,address)(uint256)" $DEPLOYER $NFPM --rpc-url $RPC
```
Expected: ≥ 27000000000000000 and ≥ 280000000000000000000000000 respectively.

---

## Task 4: Create + initialize the pool at the cloned price

- [ ] **Step 1: Create and initialize**

```bash
cast send $NFPM "createAndInitializePoolIfNecessary(address,address,uint24,uint160)" \
  $WETH $GUNR 10000 7973503768384402773302369423813468 \
  --account deployer --rpc-url $RPC
```
Expected: confirmed.

- [ ] **Step 2: Verify the pool now exists**

```bash
cast call $FACTORY "getPool(address,address,uint24)(address)" $WETH $GUNR 10000 --rpc-url $RPC
```
Expected: a non-zero pool address. Save it as `POOL=<address>`.

---

## Task 5: Mint the full-range liquidity position

- [ ] **Step 1: Mint (sets a fresh 20-minute deadline inline)**

```bash
DEADLINE=$(( $(date +%s) + 1200 ))
cast send $NFPM \
  "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))" \
  "($WETH,$GUNR,10000,-887200,887200,26385210459845447,275000000000000000000000000,26000000000000000,255000000000000000000000000,$DEPLOYER,$DEADLINE)" \
  --account deployer --rpc-url $RPC
```
Expected: confirmed. Emits an `IncreaseLiquidity` / `Transfer` (LP NFT) to `$DEPLOYER`.

- [ ] **Step 2: Verify the pool holds liquidity**

```bash
cast call $POOL "liquidity()(uint128)" --rpc-url $RPC
```
Expected: a large non-zero number.

---

## Task 6: Verify GUNR is now buyable

- [ ] **Step 1: On-chain quote (no funds spent)**

```bash
cast call $QUOTERV2 \
  "quoteExactInputSingle((address,address,uint256,uint24,uint160))(uint256,uint160,uint32,uint256)" \
  "($WETH,$GUNR,1000000000000000,10000,0)" --rpc-url $RPC
```
Expected: a non-zero `amountOut` (GUNR for 0.001 WETH) — proves the V3 route prices.

- [ ] **Step 2: Real buy from a separate wallet**

From any wallet that is NOT the deployer (a clean test wallet), open `app.uniswap.org`,
Base network, swap a small amount of ETH → GUNR. Expected: the Swap button is
**clickable** (no "may fail"), and the swap confirms. This is the first real buy and
the first green candle on Dexscreener/GeckoTerminal.

---

## Rollback / notes

- If Task 4 or 5 reverts, nothing is lost beyond gas; re-check allowances (Task 3)
  and balances (Task 1) and retry the single failing step.
- The old Clanker pool is untouched (locked, unswappable). Aggregators will route to
  this new V3 pool because it is the only swappable market.
- This is a thin seed (~$90–100). A ~$20 buy moves price materially — expected and
  acceptable for V1. Deepening (concentrated range, backer co-LP, Aerodrome
  emissions, V2 staking) is tracked in the spec's follow-on section and
  `project_lp_staking_brainstorm`.
- Post-execution: confirm the LP NFT landed in `0x9D62` (`cast call $NFPM
  "balanceOf(address)(uint256)" $DEPLOYER`).
