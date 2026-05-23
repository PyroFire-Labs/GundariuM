// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GNDMtoGUNR} from "../src/GNDMtoGUNR.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract GNDMtoGUNRTest is Test {
    GNDMtoGUNR migration;
    MockERC20 gndm;
    MockERC20 gunr;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);
    address rando = address(4);

    uint256 constant FUNDING = 50_000_000e18;
    uint256 constant ALICE_GNDM = 33_000_000e18;
    uint256 constant BOB_GNDM = 10_000_000e18;

    function setUp() public {
        gndm = new MockERC20("GNDM", "GNDM", 100_000_000e18, owner);
        gunr = new MockERC20("GUNR", "GUNR", 100_000_000e18, owner);

        vm.prank(owner);
        migration = new GNDMtoGUNR(owner, address(gndm), address(gunr), block.timestamp + 60 days);

        vm.prank(owner);
        gunr.transfer(address(migration), FUNDING);

        vm.startPrank(owner);
        gndm.transfer(alice, ALICE_GNDM);
        gndm.transfer(bob, BOB_GNDM);
        vm.stopPrank();

        vm.prank(alice);
        gndm.approve(address(migration), type(uint256).max);
        vm.prank(bob);
        gndm.approve(address(migration), type(uint256).max);
    }

    // ─── Happy Path ───────────────────────────────────────────────────

    function test_migrate_happyPath() public {
        uint256 amount = 5_000_000e18;
        vm.prank(alice);
        migration.migrate(amount);

        assertEq(gndm.balanceOf(alice), ALICE_GNDM - amount);
        assertEq(gunr.balanceOf(alice), amount);
        assertEq(gndm.balanceOf(address(migration)), amount);
        assertEq(gunr.balanceOf(address(migration)), FUNDING - amount);
    }

    function test_migrate_emitsEvent() public {
        uint256 amount = 1_000_000e18;
        vm.expectEmit(true, false, false, true);
        emit GNDMtoGUNR.Migrated(alice, amount);

        vm.prank(alice);
        migration.migrate(amount);
    }

    function test_migrate_multipleCalls() public {
        vm.startPrank(alice);
        migration.migrate(1_000_000e18);
        migration.migrate(2_000_000e18);
        vm.stopPrank();

        assertEq(gunr.balanceOf(alice), 3_000_000e18);
    }

    function test_migrate_anyHolderCanMigrate() public {
        // Rando holds GNDM → can migrate. No whitelist.
        vm.prank(owner);
        gndm.transfer(rando, 1_000_000e18);
        vm.prank(rando);
        gndm.approve(address(migration), type(uint256).max);

        vm.prank(rando);
        migration.migrate(1_000_000e18);

        assertEq(gunr.balanceOf(rando), 1_000_000e18);
    }

    // ─── Rejection Cases ─────────────────────────────────────────────

    function test_migrate_revertsAfterDeadline() public {
        vm.warp(block.timestamp + 61 days);

        vm.prank(alice);
        vm.expectRevert(GNDMtoGUNR.DeadlinePassed.selector);
        migration.migrate(1e18);
    }

    function test_migrate_revertsWithoutApproval() public {
        // rando has GNDM but did not approve
        vm.prank(owner);
        gndm.transfer(rando, 1_000_000e18);

        vm.prank(rando);
        vm.expectRevert();
        migration.migrate(1_000_000e18);
    }

    function test_migrate_revertsWhenOutOfGunr() public {
        // Drain contract via owner first
        vm.prank(owner);
        migration.recoverToken(address(gunr), owner, FUNDING);

        vm.prank(alice);
        vm.expectRevert();
        migration.migrate(1e18);
    }

    function test_migrate_revertsWhenPaused() public {
        vm.prank(owner);
        migration.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        migration.migrate(1e18);
    }

    function test_migrate_succeedsAfterUnpause() public {
        vm.prank(owner);
        migration.pause();
        vm.prank(owner);
        migration.unpause();

        vm.prank(alice);
        migration.migrate(1e18);
        assertEq(gunr.balanceOf(alice), 1e18);
    }

    // ─── Admin: setDeadline ──────────────────────────────────────────

    function test_setDeadline_updatesValue() public {
        uint256 newDeadline = block.timestamp + 365 days;
        vm.prank(owner);
        migration.setDeadline(newDeadline);

        assertEq(migration.deadline(), newDeadline);
    }

    function test_setDeadline_emitsEvent() public {
        uint256 oldDeadline = migration.deadline();
        uint256 newDeadline = oldDeadline + 30 days;
        vm.expectEmit(false, false, false, true);
        emit GNDMtoGUNR.DeadlineUpdated(oldDeadline, newDeadline);

        vm.prank(owner);
        migration.setDeadline(newDeadline);
    }

    function test_setDeadline_canShorten() public {
        // No extend-only rail — owner can shorten
        uint256 newDeadline = block.timestamp + 1;
        vm.prank(owner);
        migration.setDeadline(newDeadline);

        assertEq(migration.deadline(), newDeadline);
    }

    function test_setDeadline_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        migration.setDeadline(block.timestamp + 1 days);
    }

    // ─── Admin: pause / unpause ───────────────────────────────────────

    function test_pause_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        migration.pause();
    }

    function test_unpause_onlyOwner_reverts() public {
        vm.prank(owner);
        migration.pause();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        migration.unpause();
    }

    function test_settersWorkWhenPaused() public {
        vm.prank(owner);
        migration.pause();

        // setDeadline still callable when paused
        uint256 newDeadline = block.timestamp + 100 days;
        vm.prank(owner);
        migration.setDeadline(newDeadline);
        assertEq(migration.deadline(), newDeadline);

        // recoverToken still callable when paused
        vm.prank(owner);
        migration.recoverToken(address(gunr), owner, 1e18);
    }

    // ─── Admin: recoverToken ──────────────────────────────────────────

    function test_recoverToken_transfersGUNR() public {
        uint256 ownerBefore = gunr.balanceOf(owner);
        vm.prank(owner);
        migration.recoverToken(address(gunr), owner, 1_000_000e18);

        assertEq(gunr.balanceOf(owner), ownerBefore + 1_000_000e18);
        assertEq(gunr.balanceOf(address(migration)), FUNDING - 1_000_000e18);
    }

    function test_recoverToken_transfersGNDM() public {
        vm.prank(alice);
        migration.migrate(1_000_000e18);

        uint256 ownerBefore = gndm.balanceOf(owner);
        vm.prank(owner);
        migration.recoverToken(address(gndm), owner, 1_000_000e18);

        assertEq(gndm.balanceOf(owner), ownerBefore + 1_000_000e18);
        assertEq(gndm.balanceOf(address(migration)), 0);
    }

    function test_recoverToken_arbitraryRecipient() public {
        vm.prank(owner);
        migration.recoverToken(address(gunr), bob, 100e18);

        assertEq(gunr.balanceOf(bob), 100e18);
    }

    function test_recoverToken_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit GNDMtoGUNR.TokenRecovered(address(gunr), bob, 100e18);

        vm.prank(owner);
        migration.recoverToken(address(gunr), bob, 100e18);
    }

    function test_recoverToken_onlyOwner_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        migration.recoverToken(address(gunr), alice, 1e18);
    }

    function test_recoverToken_zeroAddress_reverts() public {
        vm.prank(owner);
        vm.expectRevert(GNDMtoGUNR.ZeroAddress.selector);
        migration.recoverToken(address(gunr), address(0), 1e18);
    }

    // ─── Constructor Validation ───────────────────────────────────────

    function test_constructor_zeroOwner_reverts() public {
        // OZ Ownable enforces this check before our body runs
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new GNDMtoGUNR(address(0), address(gndm), address(gunr), block.timestamp + 30 days);
    }

    function test_constructor_zeroGndm_reverts() public {
        vm.expectRevert(GNDMtoGUNR.ZeroAddress.selector);
        new GNDMtoGUNR(owner, address(0), address(gunr), block.timestamp + 30 days);
    }

    function test_constructor_zeroGunr_reverts() public {
        vm.expectRevert(GNDMtoGUNR.ZeroAddress.selector);
        new GNDMtoGUNR(owner, address(gndm), address(0), block.timestamp + 30 days);
    }

    function test_constructor_deadlineInPast_reverts() public {
        vm.warp(100);
        vm.expectRevert(GNDMtoGUNR.DeadlineInPast.selector);
        new GNDMtoGUNR(owner, address(gndm), address(gunr), 50);
    }

    function test_constructor_setsOwner() public {
        assertEq(migration.owner(), owner);
    }

    function test_constructor_setsTokens() public {
        assertEq(address(migration.gndm()), address(gndm));
        assertEq(address(migration.gunr()), address(gunr));
    }
}
