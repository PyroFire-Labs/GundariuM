// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ArenaBattleLog} from "../src/ArenaBattleLog.sol";

/**
 * @notice Deploys ArenaBattleLog as a UUPS proxy. Standalone — does not
 *         touch GunplaCard, GundaniumGame, DailyCheckIn, or DossierShareLog.
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
 *     forge script script/DeployArenaBattleLog.s.sol \
 *     --rpc-url https://sepolia.base.org --account deployer --broadcast --verify -vvvv
 *
 * After deploy: paste the logged proxy address into
 *   src/lib/contracts/addresses.ts  (arenaBattleLog key, matching chain entry)
 * then redeploy the frontend.
 */
contract DeployArenaBattleLog is Script {
    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");

        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        console.log("=== ArenaBattleLog Deploy ===");
        console.log("Owner: ", owner_);

        ArenaBattleLog impl = new ArenaBattleLog();
        bytes memory init = abi.encodeCall(ArenaBattleLog.initialize, (owner_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);

        vm.stopBroadcast();

        console.log("Implementation:    ", address(impl));
        console.log("Proxy (use this):  ", address(proxy));
        console.log("");
        console.log("Next step: add proxy address to src/lib/contracts/addresses.ts (arenaBattleLog)");
    }
}
