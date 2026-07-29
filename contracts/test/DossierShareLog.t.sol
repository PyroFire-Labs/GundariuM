// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DossierShareLog} from "../src/DossierShareLog.sol";

contract DossierShareLogTest is Test {
    DossierShareLog dossierLog;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    function setUp() public {
        vm.warp(1_000_000 days);

        DossierShareLog impl = new DossierShareLog();
        bytes memory init = abi.encodeCall(DossierShareLog.initialize, (owner));
        dossierLog = DossierShareLog(address(new ERC1967Proxy(address(impl), init)));
    }

    // ─── Intent ──────────────────────────────────────────────────────────────

    function test_intentToShare_firstOfDay_succeeds() public {
        vm.prank(alice);
        dossierLog.intentToShare();

        assertEq(dossierLog.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    function test_intentToShare_sameDayTwice_succeedsIfNotYetConfirmed() public {
        vm.startPrank(alice);
        dossierLog.intentToShare();
        dossierLog.intentToShare(); // retry-after-cancel — must not revert
        vm.stopPrank();

        assertEq(dossierLog.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    function test_intentToShare_afterAlreadyConfirmedToday_reverts() public {
        vm.startPrank(alice);
        dossierLog.intentToShare();
        dossierLog.confirmShare(5, 100);

        vm.expectRevert(DossierShareLog.AlreadySharedToday.selector);
        dossierLog.intentToShare();
        vm.stopPrank();
    }

    // ─── Confirm ─────────────────────────────────────────────────────────────

    function test_confirmShare_withoutIntent_reverts() public {
        vm.prank(alice);
        vm.expectRevert(DossierShareLog.NoIntentForToday.selector);
        dossierLog.confirmShare(5, 100);
    }

    function test_confirmShare_afterIntent_succeeds() public {
        vm.startPrank(alice);
        dossierLog.intentToShare();
        dossierLog.confirmShare(5, 100);
        vm.stopPrank();

        assertEq(dossierLog.lastConfirmedDay(alice), block.timestamp / 1 days);
    }

    function test_confirmShare_sameDayTwice_reverts() public {
        vm.startPrank(alice);
        dossierLog.intentToShare();
        dossierLog.confirmShare(5, 100);

        vm.expectRevert(DossierShareLog.AlreadyConfirmedToday.selector);
        dossierLog.confirmShare(5, 100);
        vm.stopPrank();
    }

    // ─── hasSharedToday ──────────────────────────────────────────────────────

    function test_hasSharedToday_beforeConfirm_returnsFalse() public {
        assertFalse(dossierLog.hasSharedToday(alice));
    }

    function test_hasSharedToday_afterConfirm_returnsTrue() public {
        vm.startPrank(alice);
        dossierLog.intentToShare();
        dossierLog.confirmShare(5, 100);
        vm.stopPrank();

        assertTrue(dossierLog.hasSharedToday(alice));
    }

    // ─── Day bucket reset ────────────────────────────────────────────────────

    function test_dayBucket_resetsNextDay() public {
        vm.startPrank(alice);
        dossierLog.intentToShare();
        dossierLog.confirmShare(5, 100);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        assertFalse(dossierLog.hasSharedToday(alice));

        vm.prank(alice);
        dossierLog.intentToShare(); // must succeed again on the new day
        assertEq(dossierLog.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    // ─── Independent users ───────────────────────────────────────────────────

    function test_independentUsers_trackedSeparately() public {
        vm.startPrank(alice);
        dossierLog.intentToShare();
        dossierLog.confirmShare(5, 100);
        vm.stopPrank();

        assertTrue(dossierLog.hasSharedToday(alice));
        assertFalse(dossierLog.hasSharedToday(bob));
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    function test_intentToShare_emitsShareIntentLogged() public {
        vm.expectEmit(true, false, false, true);
        emit DossierShareLog.ShareIntentLogged(alice, block.timestamp / 1 days);

        vm.prank(alice);
        dossierLog.intentToShare();
    }

    function test_confirmShare_emitsShareConfirmed() public {
        vm.prank(alice);
        dossierLog.intentToShare();

        vm.expectEmit(true, false, false, true);
        emit DossierShareLog.ShareConfirmed(alice, block.timestamp / 1 days, 5, 100);

        vm.prank(alice);
        dossierLog.confirmShare(5, 100);
    }

    // ─── Upgrade authorization ───────────────────────────────────────────────

    function test_upgrade_nonOwner_reverts() public {
        DossierShareLog newImpl = new DossierShareLog();
        vm.prank(alice);
        vm.expectRevert();
        dossierLog.upgradeToAndCall(address(newImpl), "");
    }
}
