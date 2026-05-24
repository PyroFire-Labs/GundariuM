// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title GNDMtoGUNR
/// @notice Time-gated 1:1 migration from $GNDM to $GUNR. No whitelist; total
///         migration is bounded by the contract's GUNR funding amount.
contract GNDMtoGUNR is Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable gndm;
    IERC20 public immutable gunr;
    uint256 public deadline;

    event Migrated(address indexed user, uint256 amount);
    event DeadlineUpdated(uint256 oldDeadline, uint256 newDeadline);
    event TokenRecovered(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error DeadlineInPast();
    error DeadlinePassed();

    constructor(
        address owner_,
        address gndm_,
        address gunr_,
        uint256 deadline_
    ) Ownable(owner_) {
        if (gndm_ == address(0) || gunr_ == address(0)) revert ZeroAddress();
        if (deadline_ <= block.timestamp) revert DeadlineInPast();
        gndm = IERC20(gndm_);
        gunr = IERC20(gunr_);
        deadline = deadline_;
    }

    // ─── User ─────────────────────────────────────────────────────────

    /// @notice Swap GNDM for GUNR at 1:1. Caller must have approved GNDM.
    function migrate(uint256 amount) external whenNotPaused {
        if (block.timestamp > deadline) revert DeadlinePassed();
        gndm.safeTransferFrom(msg.sender, address(this), amount);
        gunr.safeTransfer(msg.sender, amount);
        emit Migrated(msg.sender, amount);
    }

    // ─── Admin ────────────────────────────────────────────────────────

    function setDeadline(uint256 newDeadline) external onlyOwner {
        uint256 oldDeadline = deadline;
        deadline = newDeadline;
        emit DeadlineUpdated(oldDeadline, newDeadline);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function recoverToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokenRecovered(token, to, amount);
    }
}
