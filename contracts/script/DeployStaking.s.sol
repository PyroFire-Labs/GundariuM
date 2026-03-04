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
 *   GNDM_ADDRESS           — $GNDM token address on the target chain
 *
 * Usage (Base Sepolia):
 *   forge script script/DeployStaking.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --account deployer \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Usage (Base Mainnet):
 *   forge script script/DeployStaking.s.sol \
 *     --rpc-url $BASE_MAINNET_RPC \
 *     --account deployer \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * After deploy: paste the logged proxy address into
 *   src/lib/contracts/addresses.ts  (GNDM_STAKING key)
 * then redeploy the frontend.
 */
contract DeployStaking is Script {
    function run() external {
        // Key injection: prefer --account keystore; fall back to DEPLOYER_PRIVATE_KEY env var.
        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address gndm        = vm.envAddress("GNDM_ADDRESS");

        // Start broadcast: with key (env var) or without (--account keystore).
        address deployer;
        if (deployerKey != 0) {
            deployer = vm.addr(deployerKey);
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
            deployer = msg.sender; // populated by --account flag
        }

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
