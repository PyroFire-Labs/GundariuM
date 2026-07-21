// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DailyCheckIn} from "../src/DailyCheckIn.sol";

/**
 * @notice Deploys DailyCheckIn as a UUPS proxy. Standalone — does not touch
 *         GunplaCard, GundaniumGame, or PrizePool.
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
 *   OWNER_ADDRESS — address that will own the proxy (the existing deployer wallet)
 *
 * Usage (Base Sepolia):
 *   OWNER_ADDRESS=0x9D6277E24eFE034dE2F44dD9aDfE0f24b8B08bB7 \
 *     forge script script/DeployDailyCheckIn.s.sol \
 *     --rpc-url https://sepolia.base.org --account deployer --broadcast --verify -vvvv
 *
 * After deploy: paste the logged proxy address into
 *   src/lib/contracts/addresses.ts  (dailyCheckIn key, 84532 entry)
 * then redeploy the frontend.
 */
contract DeployDailyCheckIn is Script {
    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");

        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        console.log("=== DailyCheckIn Deploy ===");
        console.log("Owner: ", owner_);

        DailyCheckIn impl = new DailyCheckIn();
        bytes memory init = abi.encodeCall(DailyCheckIn.initialize, (owner_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);

        vm.stopBroadcast();

        console.log("Implementation:    ", address(impl));
        console.log("Proxy (use this):  ", address(proxy));
        console.log("");
        console.log("Next step: add proxy address to src/lib/contracts/addresses.ts (dailyCheckIn)");
    }
}
