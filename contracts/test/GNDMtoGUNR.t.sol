// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GNDMtoGUNR} from "../src/GNDMtoGUNR.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract GNDMtoGUNRTest is Test {
    GNDMtoGUNR migration;
    MockERC20 gndm;
    MockERC20 gunr;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    uint256 constant ALICE_CAP = 33_000_000e18;
    uint256 constant BOB_CAP   = 10_000_000e18;

    bytes32 merkleRoot;
    bytes32[] aliceProof;
    bytes32[] bobProof;

    function setUp() public {
        gndm = new MockERC20("GNDM", "GNDM", 100_000_000e18, owner);
        gunr = new MockERC20("GUNR", "GUNR", 100_000_000e18, owner);

        _buildMerkleTree();

        vm.prank(owner);
        uint256 deadline = block.timestamp + 30 days;
        migration = new GNDMtoGUNR(owner, address(gndm), address(gunr), merkleRoot, deadline);

        // Fund contract with GUNR
        vm.prank(owner);
        gunr.transfer(address(migration), 50_000_000e18);

        // Fund alice and bob with GNDM
        vm.startPrank(owner);
        gndm.transfer(alice, 33_000_000e18);
        gndm.transfer(bob,   10_000_000e18);
        vm.stopPrank();

        // Approve
        vm.prank(alice);
        gndm.approve(address(migration), type(uint256).max);
        vm.prank(bob);
        gndm.approve(address(migration), type(uint256).max);
    }

    function _buildMerkleTree() internal {
        bytes32 leafAlice = keccak256(abi.encodePacked(alice, ALICE_CAP));
        bytes32 leafBob   = keccak256(abi.encodePacked(bob, BOB_CAP));

        if (leafAlice <= leafBob) {
            merkleRoot = keccak256(abi.encodePacked(leafAlice, leafBob));
        } else {
            merkleRoot = keccak256(abi.encodePacked(leafBob, leafAlice));
        }

        aliceProof = new bytes32[](1);
        aliceProof[0] = leafBob;

        bobProof = new bytes32[](1);
        bobProof[0] = leafAlice;
    }

    // ─── Happy Path ───────────────────────────────────────────────────

    function test_migrate_alice() public {
        uint256 amount = 10_000_000e18;

        vm.prank(alice);
        migration.migrate(amount, ALICE_CAP, aliceProof);

        assertEq(migration.migrated(alice), amount);
        assertEq(gndm.balanceOf(alice), 23_000_000e18);
        assertEq(gunr.balanceOf(alice), amount);
        assertEq(gndm.balanceOf(address(migration)), amount);
    }

    function test_migrate_fullCap() public {
        vm.prank(alice);
        migration.migrate(ALICE_CAP, ALICE_CAP, aliceProof);

        assertEq(migration.migrated(alice), ALICE_CAP);
        assertEq(gndm.balanceOf(alice), 0);
        assertEq(gunr.balanceOf(alice), ALICE_CAP);
    }

    function test_migrate_multipleCallsUpToCap() public {
        vm.startPrank(alice);
        migration.migrate(10_000_000e18, ALICE_CAP, aliceProof);
        migration.migrate(10_000_000e18, ALICE_CAP, aliceProof);
        migration.migrate(13_000_000e18, ALICE_CAP, aliceProof);
        vm.stopPrank();

        assertEq(migration.migrated(alice), ALICE_CAP);
    }

    function test_migrate_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit GNDMtoGUNR.Migrated(alice, 5_000_000e18, 5_000_000e18);

        vm.prank(alice);
        migration.migrate(5_000_000e18, ALICE_CAP, aliceProof);
    }

    // ─── Rejection Cases ──────────────────────────────────────────────

    function test_migrate_capExceeded() public {
        vm.prank(alice);
        vm.expectRevert("Migration: cap exceeded");
        migration.migrate(ALICE_CAP + 1, ALICE_CAP, aliceProof);
    }

    function test_migrate_capExceededMultipleCalls() public {
        vm.startPrank(alice);
        migration.migrate(ALICE_CAP, ALICE_CAP, aliceProof);
        vm.expectRevert("Migration: cap exceeded");
        migration.migrate(1, ALICE_CAP, aliceProof);
        vm.stopPrank();
    }

    function test_migrate_invalidProof() public {
        bytes32[] memory fakeProof = new bytes32[](1);
        fakeProof[0] = bytes32(uint256(0xdead));

        vm.prank(alice);
        vm.expectRevert("Migration: not in whitelist");
        migration.migrate(1e18, ALICE_CAP, fakeProof);
    }

    function test_migrate_notWhitelisted() public {
        address charlie = address(4);
        vm.prank(owner);
        gndm.transfer(charlie, 1_000_000e18);
        vm.prank(charlie);
        gndm.approve(address(migration), type(uint256).max);

        bytes32[] memory emptyProof = new bytes32[](0);

        vm.prank(charlie);
        vm.expectRevert("Migration: not in whitelist");
        migration.migrate(1_000_000e18, 1_000_000e18, emptyProof);
    }

    function test_migrate_deadlinePassed() public {
        vm.warp(block.timestamp + 31 days);

        vm.prank(alice);
        vm.expectRevert("Migration: deadline passed");
        migration.migrate(1e18, ALICE_CAP, aliceProof);
    }

    // ─── Owner Withdrawals ────────────────────────────────────────────

    function test_withdrawGUNR_afterDeadline() public {
        uint256 contractGunr = gunr.balanceOf(address(migration));
        vm.warp(block.timestamp + 31 days);

        vm.prank(owner);
        migration.withdrawGUNR();

        assertEq(gunr.balanceOf(address(migration)), 0);
        assertEq(gunr.balanceOf(owner), gunr.totalSupply() - contractGunr + contractGunr);
    }

    function test_withdrawGUNR_beforeDeadline_reverts() public {
        vm.prank(owner);
        vm.expectRevert("Migration: deadline not passed");
        migration.withdrawGUNR();
    }

    function test_withdrawGUNR_notOwner_reverts() public {
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        vm.expectRevert("Migration: not owner");
        migration.withdrawGUNR();
    }

    function test_withdrawGNDM() public {
        vm.prank(alice);
        migration.migrate(10_000_000e18, ALICE_CAP, aliceProof);

        uint256 ownerBefore = gndm.balanceOf(owner);
        vm.prank(owner);
        migration.withdrawGNDM();

        assertEq(gndm.balanceOf(owner), ownerBefore + 10_000_000e18);
        assertEq(gndm.balanceOf(address(migration)), 0);
    }

    function test_withdrawGNDM_notOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert("Migration: not owner");
        migration.withdrawGNDM();
    }

    // ─── Constructor Validation ───────────────────────────────────────

    function test_constructor_zeroAddress_reverts() public {
        vm.expectRevert("Migration: zero address");
        new GNDMtoGUNR(owner, address(0), address(gunr), merkleRoot, block.timestamp + 30 days);
    }

    function test_constructor_deadlineInPast_reverts() public {
        vm.expectRevert("Migration: deadline in past");
        new GNDMtoGUNR(owner, address(gndm), address(gunr), merkleRoot, block.timestamp - 1);
    }
}
