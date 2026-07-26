// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DossierShareLog
 * @notice Verifies a Dossier share actually completed before EXP is granted.
 *         Two-transaction intent/confirm model: intentToShare() fires the
 *         moment Share is clicked, confirmShare() fires only after a real
 *         composeCast() result. Standalone contract — does not touch
 *         GunplaCard, GundaniumGame, or DailyCheckIn.
 */
contract DossierShareLog is OwnableUpgradeable, UUPSUpgradeable {
    // ─── Errors ─────────────────────────────────────────────────────────────

    error AlreadySharedToday();
    error NoIntentForToday();
    error AlreadyConfirmedToday();

    // ─── Events ─────────────────────────────────────────────────────────────

    event ShareIntentLogged(address indexed user, uint256 day);
    event ShareConfirmed(address indexed user, uint256 day, uint256 streak, uint256 exp);

    // ─── State ──────────────────────────────────────────────────────────────

    mapping(address => uint256) public pendingIntentDay;
    mapping(address => uint256) public lastConfirmedDay;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /// @notice Logs intent to share. Callable repeatedly the same day (covers
    ///         retry-after-cancel) as long as today isn't already confirmed.
    function intentToShare() external {
        uint256 today = block.timestamp / 1 days;
        if (lastConfirmedDay[msg.sender] == today) revert AlreadySharedToday();

        pendingIntentDay[msg.sender] = today;
        emit ShareIntentLogged(msg.sender, today);
    }

    /// @notice Confirms a share actually completed. Reverts unless intent was
    ///         logged today first, and unless today isn't already confirmed.
    function confirmShare(uint256 streak, uint256 exp) external {
        uint256 today = block.timestamp / 1 days;
        if (pendingIntentDay[msg.sender] != today) revert NoIntentForToday();
        if (lastConfirmedDay[msg.sender] == today) revert AlreadyConfirmedToday();

        lastConfirmedDay[msg.sender] = today;
        emit ShareConfirmed(msg.sender, today, streak, exp);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function hasSharedToday(address user) external view returns (bool) {
        return lastConfirmedDay[user] == block.timestamp / 1 days;
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
