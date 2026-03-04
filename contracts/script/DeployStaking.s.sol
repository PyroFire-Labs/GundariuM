// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GNDMStaking} from "../src/GNDMStaking.sol";

/**
 * @notice Deploys GNDMStaking as a UUPS proxy. Standalone — does not touch
 *         GunplaCard, GundaniumGame, or PrizePool.
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY   — deployer / owner wallet
 *   GNDM_ADDRESS           — $GNDM token address on the target chain
 *
 * Usage (Base Sepolia):
 *   forge script script/DeployStaking.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Usage (Base Mainnet):
 *   forge script script/DeployStaking.s.sol \
 *     --rpc-url $BASE_MAINNET_RPC \
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
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);
        address gndm        = vm.envAddress("GNDM_ADDRESS");

        console.log("=== GNDMStaking Deploy ===");
        console.log("Deployer:  ", deployer);
        console.log("GNDM:      ", gndm);

        vm.startBroadcast(deployerKey);

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
