// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GNDMtoGUNR} from "../src/GNDMtoGUNR.sol";

/**
 * @notice Deploys the simplified GNDM→GUNR migration contract v2.
 *
 * Required env vars:
 *   OWNER_ADDRESS — address that will own the contract
 *
 * Usage:
 *   OWNER_ADDRESS=0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7 \
 *     forge script script/DeployMigration.s.sol \
 *     --rpc-url https://mainnet.base.org \
 *     --account deployer --broadcast --verify -vvvv
 *
 * NOTE: Prefer `forge create` per [[feedback_eip7702_deploy]] for single-tx
 * deploys on the EIP-7702-delegated deployer wallet. This script is provided
 * for reference and dry-run via `forge script` without --broadcast.
 */
contract DeployMigration is Script {
    address constant GNDM = 0xFc7008F9157257a17a9Fb3c602b1CD56C27A4ba3;
    address constant GUNR = 0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07;

    function run() external {
        address owner_ = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast();

        uint256 deadline = block.timestamp + 60 days;

        console.log("=== GNDM->GUNR Migration v2 Deploy ===");
        console.log("Owner:    ", owner_);
        console.log("GNDM:     ", GNDM);
        console.log("GUNR:     ", GUNR);
        console.log("Deadline: ", deadline);

        GNDMtoGUNR migration = new GNDMtoGUNR(owner_, GNDM, GUNR, deadline);

        vm.stopBroadcast();

        console.log("Migration contract:", address(migration));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Transfer 50M GUNR to the contract");
        console.log("  2. Update src/lib/contracts/addresses.ts");
        console.log("  3. Set MIGRATION_PAUSED = false in src/app/migrate/page.tsx");
        console.log("  4. Deploy frontend");
    }
}
