// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GunplaCard} from "../src/GunplaCard.sol";

/**
 * @notice Mainnet-only minimal deploy for GunplaCard.
 *         GundaniumGame + PrizePool are deferred to a future session when
 *         battle features come online — they are not required for the
 *         whitelist mint launch.
 *
 *         The merkle root for the 391-address mainnet whitelist is hardcoded
 *         in this script so it cannot be forgotten at deploy time. Mint phase
 *         is left at PAUSED (0); activate it with a `cast send setMintPhase(1)`
 *         at launch time.
 *
 * Required env vars (BOTH MUST BE SET):
 *   OWNER_ADDRESS  — contract owner (your deployer wallet 0x9D62...)
 *   USDC_ADDRESS   — canonical USDC on Base mainnet
 *
 * Usage:
 *   export OWNER_ADDRESS=0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7
 *   export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 *   forge script script/DeployGunplaCard.s.sol \
 *     --rpc-url $BASE_RPC_URL \
 *     --account deployer \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract DeployGunplaCard is Script {
    uint256 constant MINT_PRICE_USDC     = 2_000_000; // $2 USDC public-phase price
    uint256 constant COSMETIC_PRICE_USDC = 1_000_000; // $1 USDC cosmetics price

    // Mainnet whitelist merkle root — generated 2026-04-27 from the
    // 394-address final whitelist (391 community handles + 3 project
    // wallets at VIP tier 1: deployer, treasury, GundariuM Farcaster).
    // See scripts/whitelist-proofs.mainnet.json for the full proof set.
    bytes32 constant MAINNET_MERKLE_ROOT =
        0x1cb2f45d724c456b3db6ec373f1929211cdc1329fdaf6a8cd10a1fc7bad21c60;

    function run() external {
        address owner = vm.envAddress("OWNER_ADDRESS");
        address usdc  = vm.envAddress("USDC_ADDRESS");

        require(block.chainid == 8453, "This script is mainnet-only (chainid 8453)");

        vm.startBroadcast();

        console.log("=== GunplaCard Mainnet Deploy ===");
        console.log("Owner:    ", owner);
        console.log("USDC:     ", usdc);
        console.log("Chain ID: ", block.chainid);

        // ── Implementation + proxy ────────────────────────────────────────
        GunplaCard cardImpl = new GunplaCard();
        bytes memory cardInit = abi.encodeCall(
            GunplaCard.initialize,
            (owner, usdc, MINT_PRICE_USDC, COSMETIC_PRICE_USDC)
        );
        ERC1967Proxy cardProxy = new ERC1967Proxy(address(cardImpl), cardInit);
        address cardAddress = address(cardProxy);
        GunplaCard card = GunplaCard(cardAddress);

        console.log("GunplaCard impl: ", address(cardImpl));
        console.log("GunplaCard proxy:", cardAddress);

        // ── Whitelist configuration ───────────────────────────────────────
        card.setTierPrice(1, 1_000_000);   // VIP tier: $1 USDC
        card.setTierPrice(2, 1_500_000);   // WL tier:  $1.50 USDC
        card.setWhitelistMintCap(5);       // 5 mints per address per phase
        card.setMerkleRoot(MAINNET_MERKLE_ROOT);
        // Mint phase intentionally stays at PAUSED (0). Activate with:
        //   cast send <proxy> "setMintPhase(uint8)" 1 --rpc-url $BASE_RPC_URL --account deployer

        vm.stopBroadcast();

        // ── Sanity check ──────────────────────────────────────────────────
        require(card.owner() == owner, "Owner mismatch after deploy");
        require(card.merkleRoot() == MAINNET_MERKLE_ROOT, "Merkle root mismatch");

        // ── Summary ───────────────────────────────────────────────────────
        console.log("\n=== Deployment complete ===");
        console.log("Update src/lib/contracts/addresses.ts:");
        console.log("  gunplaCard:", cardAddress);
        console.log("\nAt launch time, run:");
        console.log("  cast send", cardAddress, "'setMintPhase(uint8)' 1 --rpc-url $BASE_RPC_URL --account deployer");
    }
}
