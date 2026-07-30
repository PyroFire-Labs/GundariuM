// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {RerollBurner} from "../src/RerollBurner.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract RerollBurnerTest is Test {
    RerollBurner burner;
    MockERC20 gnrm;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);

    uint256 constant INITIAL_COST = 60_000e18;
    address constant BURN = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        gnrm = new MockERC20("Mock GNRM", "mGNRM", 1_000_000e18, alice);

        RerollBurner impl = new RerollBurner();
        bytes memory init = abi.encodeCall(RerollBurner.initialize, (address(gnrm), INITIAL_COST, owner));
        burner = RerollBurner(address(new ERC1967Proxy(address(impl), init)));

        vm.prank(alice);
        gnrm.approve(address(burner), type(uint256).max);
    }

    // ─── reroll() ────────────────────────────────────────────────────────────

    function test_reroll_burnsExactCostToDeadAddress() public {
        uint256 balanceBefore = gnrm.balanceOf(alice);

        vm.prank(alice);
        burner.reroll();

        assertEq(gnrm.balanceOf(alice), balanceBefore - INITIAL_COST);
        assertEq(gnrm.balanceOf(BURN), INITIAL_COST);
    }

    function test_reroll_incrementsAllCounters() public {
        vm.prank(alice);
        burner.reroll();

        assertEq(burner.rerollCount(alice), 1);
        assertEq(burner.totalRerolls(), 1);
        assertEq(burner.totalBurned(), INITIAL_COST);

        vm.prank(alice);
        burner.reroll();

        assertEq(burner.rerollCount(alice), 2);
        assertEq(burner.totalRerolls(), 2);
        assertEq(burner.totalBurned(), INITIAL_COST * 2);
    }

    function test_reroll_tracksPerUserSeparately() public {
        vm.prank(alice);
        gnrm.transfer(bob, 200_000e18);
        vm.prank(bob);
        gnrm.approve(address(burner), type(uint256).max);

        vm.prank(alice);
        burner.reroll();
        vm.prank(bob);
        burner.reroll();
        vm.prank(bob);
        burner.reroll();

        assertEq(burner.rerollCount(alice), 1);
        assertEq(burner.rerollCount(bob), 2);
        assertEq(burner.totalRerolls(), 3);
    }

    function test_reroll_emitsRerolledEvent() public {
        vm.expectEmit(true, false, false, true, address(burner));
        emit RerollBurner.Rerolled(alice, INITIAL_COST, 1, 1);

        vm.prank(alice);
        burner.reroll();
    }

    function test_reroll_revertsOnInsufficientAllowance() public {
        vm.prank(alice);
        gnrm.approve(address(burner), 0);

        vm.prank(alice);
        vm.expectRevert();
        burner.reroll();
    }

    function test_reroll_revertsOnInsufficientBalance() public {
        vm.prank(bob); // bob holds zero mock GNRM and has approved nothing
        vm.expectRevert();
        burner.reroll();
    }

    // ─── setRerollCost() ─────────────────────────────────────────────────────

    function test_setRerollCost_ownerCanUpdate() public {
        vm.prank(owner);
        burner.setRerollCost(100_000e18);

        assertEq(burner.rerollCost(), 100_000e18);
    }

    function test_setRerollCost_revertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        burner.setRerollCost(100_000e18);
    }

    function test_setRerollCost_emitsRerollCostUpdated() public {
        vm.expectEmit(true, false, false, true, address(burner));
        emit RerollBurner.RerollCostUpdated(INITIAL_COST, 100_000e18);

        vm.prank(owner);
        burner.setRerollCost(100_000e18);
    }
}
