// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GNDMStaking} from "../src/GNDMStaking.sol";

/**
 * @notice Deploys GNDMStaking as a UUPS proxy. Standalone — does not touch
 *         GunplaCard, GundaniumGame, or PrizePool.
 *
 * Key injection (two options — pick one):
 *   A) cast wallet keystore (recommended):
 *        cast wallet import deployer --interactive
 *        forge script ... --account deployer
 *      (no DEPLOYER_PRIVATE_KEY needed in .env)
 *
 *   B) env var fallback (pass at runtime, not stored):
 *        DEPLOYER_PRIVATE_KEY=0x... forge script ...
 *
 * Required env vars:
 *   OWNER_ADDRESS           — address that will own the proxy (your wallet)
 *   GNDM_ADDRESS            — $GNDM token address on the target chain
 *
 * Usage (Base Mainnet):
 *   OWNER_ADDRESS=0x... GNDM_ADDRESS=0x... forge script script/DeployStaking.s.sol \
 *     --rpc-url https://mainnet.base.org --account deployer --broadcast --verify -vvvv
 *
 * After deploy: paste the logged proxy address into
 *   src/lib/contracts/addresses.ts  (GNDM_STAKING key)
 * then redeploy the frontend.
 */
contract DeployStaking is Script {
    function run() external {
        address owner_       = vm.envAddress("OWNER_ADDRESS");
        address gndm         = vm.envAddress("GNDM_ADDRESS");

        // Broadcast with --account keystore (recommended) or DEPLOYER_PRIVATE_KEY env var.
        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        address deployer = owner_;

        console.log("=== GNDMStaking Deploy ===");
        console.log("Deployer:  ", deployer);
        console.log("GNDM:      ", gndm);

        // 1. Deploy implementation (initializers disabled in constructor)
        GNDMStaking impl = new GNDMStaking();

        // 2. Deploy proxy, calling initialize(owner, gndm)
        bytes memory init = abi.encodeCall(GNDMStaking.initialize, (deployer, gndm));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);

        vm.stopBroadcast();

        console.log("Implementation: ", address(impl));
        console.log("Proxy (use this):", address(proxy));
        console.log("");
        console.log("Next step: add proxy address to src/lib/contracts/addresses.ts");
    }
}
