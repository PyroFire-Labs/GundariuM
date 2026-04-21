// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GunplaCard} from "../src/GunplaCard.sol";

/**
 * @notice Upgrades the existing GunplaCard UUPS proxy to the latest
 *         implementation (whitelist + Merkle proof minting).
 *
 * Required env vars:
 *   GUNPLA_CARD_PROXY  — address of the existing GunplaCard proxy
 *
 * Usage (Base Sepolia):
 *   forge script script/UpgradeGunplaCard.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --account deployer \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract UpgradeGunplaCard is Script {
    function run() external {
        address proxy = vm.envAddress("GUNPLA_CARD_PROXY");

        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));

        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        console.log("=== GunplaCard Upgrade ===");
        console.log("Proxy:    ", proxy);
        console.log("Chain ID: ", block.chainid);

        // 1. Deploy new implementation
        GunplaCard newImpl = new GunplaCard();
        console.log("New impl: ", address(newImpl));

        // 2. Upgrade proxy (no initializer needed — new whitelist slots default to safe zeros)
        GunplaCard(proxy).upgradeToAndCall(address(newImpl), "");

        // 3. Verify state preserved
        GunplaCard upgraded = GunplaCard(proxy);
        console.log("Upgrade complete");
        console.log("cosmeticPriceUsdc:", upgraded.cosmeticPriceUsdc());
        console.log("mintPriceUsdc:    ", upgraded.mintPriceUsdc());

        vm.stopBroadcast();
    }
}
