// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {DailyCheckIn} from "../src/DailyCheckIn.sol";

contract DailyCheckInTest is Test {
    DailyCheckIn checkIn;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    function setUp() public {
        // Start at a large, realistic day count to avoid T=0 edge cases.
        vm.warp(1_000_000 days);

        DailyCheckIn impl = new DailyCheckIn();
        bytes memory init = abi.encodeCall(DailyCheckIn.initialize, (owner));
        checkIn = DailyCheckIn(address(new ERC1967Proxy(address(impl), init)));
    }

    // ─── First check-in ─────────────────────────────────────────────────────

    function test_checkIn_firstEver_setsStreakToOne() public {
        vm.prank(alice);
        checkIn.checkIn();

        (uint256 current, uint256 longest, uint256 total, uint256 lastDay) = checkIn.getStreak(alice);
        assertEq(current, 1);
        assertEq(longest, 1);
        assertEq(total, 1);
        assertEq(lastDay, block.timestamp / 1 days);
    }

    // ─── Consecutive days ────────────────────────────────────────────────────

    function test_checkIn_consecutiveDays_incrementsStreak() public {
        vm.prank(alice);
        checkIn.checkIn();

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        checkIn.checkIn();

        (uint256 current,,,) = checkIn.getStreak(alice);
        assertEq(current, 2);
    }

    // ─── Gap resets streak ───────────────────────────────────────────────────

    function test_checkIn_gapOfTwoDays_resetsStreakToOne() public {
        vm.prank(alice);
        checkIn.checkIn();

        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        checkIn.checkIn();

        (uint256 current,,,) = checkIn.getStreak(alice);
        assertEq(current, 1);
    }

    // ─── Same-day double check-in reverts ────────────────────────────────────

    function test_checkIn_sameDayTwice_reverts() public {
        vm.prank(alice);
        checkIn.checkIn();

        vm.prank(alice);
        vm.expectRevert(DailyCheckIn.AlreadyCheckedInToday.selector);
        checkIn.checkIn();
    }

    // ─── Longest streak survives a reset ─────────────────────────────────────

    function test_checkIn_longestStreak_survivesReset() public {
        // Pure numeric-literal warp targets, matching setUp()'s own
        // 1_000_000 days literal exactly — no arithmetic expression, no
        // re-read of block.timestamp, no accumulated local. Two prior
        // attempts using block.timestamp-derived expressions produced
        // wrong values on the 3rd/4th warp in this function specifically
        // (verified via trace) despite working in every single-warp test
        // elsewhere in this file; literals are the only pattern confirmed
        // reliable here.
        vm.prank(alice);
        checkIn.checkIn(); // streak = 1

        vm.warp(1_000_001 days);
        vm.prank(alice);
        checkIn.checkIn(); // streak = 2

        vm.warp(1_000_002 days);
        vm.prank(alice);
        checkIn.checkIn(); // streak = 3

        vm.warp(1_000_005 days); // gap
        vm.prank(alice);
        checkIn.checkIn(); // streak resets to 1

        (uint256 current, uint256 longest,,) = checkIn.getStreak(alice);
        assertEq(current, 1);
        assertEq(longest, 3);
    }

    // ─── totalCheckIns only ever increments ──────────────────────────────────

    function test_checkIn_totalCheckIns_incrementsEveryTime() public {
        vm.prank(alice);
        checkIn.checkIn();
        vm.warp(block.timestamp + 5 days); // big gap, streak resets, total still climbs
        vm.prank(alice);
        checkIn.checkIn();

        (,, uint256 total,) = checkIn.getStreak(alice);
        assertEq(total, 2);
    }

    // ─── Independent users tracked separately ────────────────────────────────

    function test_checkIn_independentUsers_trackedSeparately() public {
        vm.prank(alice);
        checkIn.checkIn();

        (uint256 aliceStreak,,,) = checkIn.getStreak(alice);
        (uint256 bobStreak,,,) = checkIn.getStreak(bob);
        assertEq(aliceStreak, 1);
        assertEq(bobStreak, 0);
    }

    // ─── Event emission ──────────────────────────────────────────────────────

    function test_checkIn_emitsCheckedInEvent() public {
        vm.expectEmit(true, false, false, true);
        emit DailyCheckIn.CheckedIn(alice, block.timestamp / 1 days, 1);

        vm.prank(alice);
        checkIn.checkIn();
    }

    // ─── Upgrade authorization ────────────────────────────────────────────────

    function test_upgrade_nonOwner_reverts() public {
        DailyCheckIn newImpl = new DailyCheckIn();
        vm.prank(alice);
        vm.expectRevert();
        checkIn.upgradeToAndCall(address(newImpl), "");
    }
}
