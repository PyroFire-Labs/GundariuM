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
