// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RerollBurner
 * @notice Charges a GNRM fee to reroll a Gundar-Frame during the mint flow,
 *         burning it to a dead address and tracking reroll activity
 *         on-chain. Owner-adjustable cost since mint pricing and whitelist
 *         tiers have both needed tuning post-launch before.
 */
contract RerollBurner is OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ─── Constants ──────────────────────────────────────────────────────────

    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ─── Errors ─────────────────────────────────────────────────────────────

    error ZeroAddress();

    // ─── Events ─────────────────────────────────────────────────────────────

    event Rerolled(address indexed user, uint256 amount, uint256 userRerollCount, uint256 totalRerolls);
    event RerollCostUpdated(uint256 oldCost, uint256 newCost);

    // ─── State ──────────────────────────────────────────────────────────────

    IERC20 public gnrm;
    uint256 public rerollCost;
    mapping(address => uint256) public rerollCount;
    uint256 public totalRerolls;
    uint256 public totalBurned;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address gnrm_, uint256 rerollCost_, address owner_) external initializer {
        if (gnrm_ == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        gnrm = IERC20(gnrm_);
        rerollCost = rerollCost_;
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /// @notice Burn `rerollCost` GNRM from the caller to reroll. Reverts if
    ///         the caller hasn't approved enough GNRM, or doesn't hold enough.
    /// @dev Checks-Effects-Interactions: counters and the event are committed
    ///      before the transfer, because GNRM is a Superfluid Pure Super Token
    ///      and therefore fires an ERC-777-style `tokensToSend` hook on the
    ///      SENDER mid-transfer. No explicit reentrancy guard is needed on top
    ///      of that ordering: with effects committed first, a reentrant call is
    ///      fully accounted — it performs a real transfer, a real counter
    ///      increment, and a real event of its own — so a reentrant caller can
    ///      only ever waste their own GNRM, never extract funds or claim
    ///      rerolls they didn't pay for.
    function reroll() external {
        uint256 cost = rerollCost;

        rerollCount[msg.sender] += 1;
        totalRerolls += 1;
        totalBurned += cost;

        emit Rerolled(msg.sender, cost, rerollCount[msg.sender], totalRerolls);

        gnrm.safeTransferFrom(msg.sender, BURN_ADDRESS, cost);
    }

    // ─── Owner Actions ──────────────────────────────────────────────────────

    function setRerollCost(uint256 newCost) external onlyOwner {
        emit RerollCostUpdated(rerollCost, newCost);
        rerollCost = newCost;
    }

    // ─── Upgradeability ─────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
