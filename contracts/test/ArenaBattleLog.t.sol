// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ArenaBattleLog} from "../src/ArenaBattleLog.sol";

contract ArenaBattleLogTest is Test {
    ArenaBattleLog arenaLog;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    function setUp() public {
        vm.warp(1_000_000 days);

        ArenaBattleLog impl = new ArenaBattleLog();
        bytes memory init = abi.encodeCall(ArenaBattleLog.initialize, (owner));
        arenaLog = ArenaBattleLog(address(new ERC1967Proxy(address(impl), init)));
    }

    // ─── Intent ──────────────────────────────────────────────────────────────

    function test_intentToShare_firstOfDay_succeeds() public {
        vm.prank(alice);
        arenaLog.intentToShare();

        assertEq(arenaLog.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    function test_intentToShare_sameDayTwice_succeedsIfNotYetConfirmed() public {
        vm.startPrank(alice);
        arenaLog.intentToShare();
        arenaLog.intentToShare();
        vm.stopPrank();

        assertEq(arenaLog.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    function test_intentToShare_afterAlreadyConfirmedToday_reverts() public {
        vm.startPrank(alice);
        arenaLog.intentToShare();
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);

        vm.expectRevert(ArenaBattleLog.AlreadySharedToday.selector);
        arenaLog.intentToShare();
        vm.stopPrank();
    }

    // ─── Confirm ─────────────────────────────────────────────────────────────

    function test_confirmBattleShare_withoutIntent_reverts() public {
        vm.prank(alice);
        vm.expectRevert(ArenaBattleLog.NoIntentForToday.selector);
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
    }

    function test_confirmBattleShare_afterIntent_succeeds() public {
        vm.startPrank(alice);
        arenaLog.intentToShare();
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();

        assertEq(arenaLog.lastConfirmedDay(alice), block.timestamp / 1 days);
    }

    function test_confirmBattleShare_sameDayTwice_reverts() public {
        vm.startPrank(alice);
        arenaLog.intentToShare();
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);

        vm.expectRevert(ArenaBattleLog.AlreadyConfirmedToday.selector);
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();
    }

    function test_confirmBattleShare_recordsLossCorrectly() public {
        vm.startPrank(alice);
        arenaLog.intentToShare();
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", false, 0);
        vm.stopPrank();

        assertTrue(arenaLog.hasSharedToday(alice));
    }

    // ─── hasSharedToday ──────────────────────────────────────────────────────

    function test_hasSharedToday_beforeConfirm_returnsFalse() public {
        assertFalse(arenaLog.hasSharedToday(alice));
    }

    function test_hasSharedToday_afterConfirm_returnsTrue() public {
        vm.startPrank(alice);
        arenaLog.intentToShare();
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();

        assertTrue(arenaLog.hasSharedToday(alice));
    }

    // ─── Day bucket reset ────────────────────────────────────────────────────

    function test_dayBucket_resetsNextDay() public {
        vm.startPrank(alice);
        arenaLog.intentToShare();
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        assertFalse(arenaLog.hasSharedToday(alice));

        vm.prank(alice);
        arenaLog.intentToShare();
        assertEq(arenaLog.pendingIntentDay(alice), block.timestamp / 1 days);
    }

    // ─── Independent users ───────────────────────────────────────────────────

    function test_independentUsers_trackedSeparately() public {
        vm.startPrank(alice);
        arenaLog.intentToShare();
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
        vm.stopPrank();

        assertTrue(arenaLog.hasSharedToday(alice));
        assertFalse(arenaLog.hasSharedToday(bob));
    }

    // ─── Events ──────────────────────────────────────────────────────────────

    function test_intentToShare_emitsShareIntentLogged() public {
        vm.expectEmit(true, false, false, true);
        emit ArenaBattleLog.ShareIntentLogged(alice, block.timestamp / 1 days);

        vm.prank(alice);
        arenaLog.intentToShare();
    }

    function test_confirmBattleShare_emitsBattleShareConfirmed() public {
        vm.prank(alice);
        arenaLog.intentToShare();

        vm.expectEmit(true, false, false, true);
        emit ArenaBattleLog.BattleShareConfirmed(alice, block.timestamp / 1 days, "Alice", "Zeon Grunt", true, 87);

        vm.prank(alice);
        arenaLog.confirmBattleShare("Alice", "Zeon Grunt", true, 87);
    }

    // ─── Upgrade authorization ───────────────────────────────────────────────

    function test_upgrade_nonOwner_reverts() public {
        ArenaBattleLog newImpl = new ArenaBattleLog();
        vm.prank(alice);
        vm.expectRevert();
        arenaLog.upgradeToAndCall(address(newImpl), "");
    }
}
