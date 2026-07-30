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
        __Ownable_init(owner_);
        gnrm = IERC20(gnrm_);
        rerollCost = rerollCost_;
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /// @notice Burn `rerollCost` GNRM from the caller to reroll. Reverts if
    ///         the caller hasn't approved enough GNRM, or doesn't hold enough.
    function reroll() external {
        gnrm.safeTransferFrom(msg.sender, BURN_ADDRESS, rerollCost);

        rerollCount[msg.sender] += 1;
        totalRerolls += 1;
        totalBurned += rerollCost;

        emit Rerolled(msg.sender, rerollCost, rerollCount[msg.sender], totalRerolls);
    }

    // ─── Owner Actions ──────────────────────────────────────────────────────

    function setRerollCost(uint256 newCost) external onlyOwner {
        emit RerollCostUpdated(rerollCost, newCost);
        rerollCost = newCost;
    }

    // ─── Upgradeability ─────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
