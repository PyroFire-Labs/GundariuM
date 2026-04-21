#!/usr/bin/env bash
# Unstake all GNDM from the mainnet staking contract
# Wallet: 0xb98f0c9b8522f9295bb26bda0f5490e1872e7fa5
# Contract: 0x43b2d1ABE4086c81A1eb6679f2c7Ea238fAbbdA6

set -euo pipefail

STAKING_CONTRACT="0x43b2d1ABE4086c81A1eb6679f2c7Ea238fAbbdA6"
RPC="https://mainnet.base.org"

# ── Preflight checks ────────────────────────────────────────────────
echo "=== GNDM Unstake Script ==="
echo ""

# Derive address from the private key
WALLET=$(cast wallet address --private-key "$PRIVATE_KEY" 2>/dev/null) || {
  echo "ERROR: PRIVATE_KEY env var not set or invalid."
  echo "Usage: PRIVATE_KEY=0x... bash scripts/unstake-gndm.sh"
  exit 1
}
echo "Wallet: $WALLET"

# Check staked balance
STAKED_RAW=$(cast call "$STAKING_CONTRACT" "stakedBalance(address)(uint256)" "$WALLET" --rpc-url "$RPC")
STAKED_RAW=$(echo "$STAKED_RAW" | awk '{print $1}')
echo "Staked (raw): $STAKED_RAW"

if [ "$STAKED_RAW" = "0" ]; then
  echo "Nothing staked — exiting."
  exit 0
fi

STAKED_HUMAN=$(python3 -c "print(f'{int($STAKED_RAW) / 10**18:,.0f}')")
echo "Staked: $STAKED_HUMAN GNDM"

# Check lock
LOCK=$(cast call "$STAKING_CONTRACT" "lockUntil(address)(uint256)" "$WALLET" --rpc-url "$RPC" | awk '{print $1}')
NOW=$(date +%s)
if [ "$LOCK" -gt "$NOW" ]; then
  echo "ERROR: Tokens still locked until $(date -r "$LOCK" 2>/dev/null || date -d "@$LOCK")"
  exit 1
fi
echo "Lock: expired (safe to unstake)"
echo ""

# ── Unstake ─────────────────────────────────────────────────────────
echo "Unstaking $STAKED_HUMAN GNDM..."
cast send "$STAKING_CONTRACT" "unstake(uint256)" "$STAKED_RAW" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$RPC" \
  --chain-id 8453

echo ""
echo "=== Done ==="

# Verify
NEW_BALANCE=$(cast call "$STAKING_CONTRACT" "stakedBalance(address)(uint256)" "$WALLET" --rpc-url "$RPC" | awk '{print $1}')
echo "Remaining staked: $NEW_BALANCE"
