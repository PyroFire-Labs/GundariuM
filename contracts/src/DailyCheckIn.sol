// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DailyCheckIn
 * @notice Tracks daily check-in streaks per address. Bragging-rights only —
 *         no rewards, no token transfers, no spendable balance. Standalone
 *         contract, does not touch GunplaCard, GundaniumGame, or GNDMStaking.
 */
contract DailyCheckIn is OwnableUpgradeable, UUPSUpgradeable {
    // ─── Errors ─────────────────────────────────────────────────────────────

    error AlreadyCheckedInToday();

    // ─── Events ─────────────────────────────────────────────────────────────

    event CheckedIn(address indexed user, uint256 day, uint256 streak);

    // ─── State ──────────────────────────────────────────────────────────────

    mapping(address => uint256) public lastCheckInDay;
    mapping(address => uint256) public currentStreak;
    mapping(address => uint256) public longestStreak;
    mapping(address => uint256) public totalCheckIns;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /// @notice Check in for the current UTC day. Reverts if already checked
    ///         in today. Increments the streak if yesterday was the last
    ///         check-in; resets to 1 on any gap (or a first-ever check-in).
    function checkIn() external {
        uint256 today = block.timestamp / 1 days;
        if (lastCheckInDay[msg.sender] == today) revert AlreadyCheckedInToday();

        uint256 newStreak = (lastCheckInDay[msg.sender] == today - 1)
            ? currentStreak[msg.sender] + 1
            : 1;

        currentStreak[msg.sender] = newStreak;
        if (newStreak > longestStreak[msg.sender]) {
            longestStreak[msg.sender] = newStreak;
        }
        totalCheckIns[msg.sender] += 1;
        lastCheckInDay[msg.sender] = today;

        emit CheckedIn(msg.sender, today, newStreak);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    /// @notice Single-call read of a user's full check-in state.
    function getStreak(address user)
        external
        view
        returns (uint256 current, uint256 longest, uint256 total, uint256 lastDay)
    {
        return (currentStreak[user], longestStreak[user], totalCheckIns[user], lastCheckInDay[user]);
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
