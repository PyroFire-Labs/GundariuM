// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GNDMtoGUNR} from "../src/GNDMtoGUNR.sol";

/**
 * @notice Deploys the GNDM→GUNR migration contract.
 *
 * Required env vars:
 *   OWNER_ADDRESS — address that will own the contract (for withdrawals)
 *   MERKLE_ROOT   — from scripts/generate-migration-merkle.ts output
 *
 * Usage:
 *   OWNER_ADDRESS=0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7 \
 *   MERKLE_ROOT=0x... forge script script/DeployMigration.s.sol \
 *     --rpc-url https://mainnet.base.org --account deployer --broadcast --verify -vvvv
 */
contract DeployMigration is Script {
    address constant GNDM = 0xFc7008F9157257a17a9Fb3c602b1CD56C27A4ba3;
    address constant GUNR = 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07;

    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");
        bytes32 merkleRoot = vm.envBytes32("MERKLE_ROOT");

        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
        }

        uint256 deadline = block.timestamp + 30 days;

        console.log("=== GNDM->GUNR Migration Deploy ===");
        console.log("Owner:       ", owner_);
        console.log("GNDM:        ", GNDM);
        console.log("GUNR:        ", GUNR);
        console.log("Merkle Root: ");
        console.logBytes32(merkleRoot);
        console.log("Deadline:    ", deadline);

        GNDMtoGUNR migration = new GNDMtoGUNR(owner_, GNDM, GUNR, merkleRoot, deadline);

        vm.stopBroadcast();

        console.log("Migration contract:", address(migration));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Transfer GUNR to the contract");
        console.log("  2. Add address to src/lib/contracts/addresses.ts");
        console.log("  3. Deploy frontend");
    }
}
