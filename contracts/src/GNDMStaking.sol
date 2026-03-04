// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GNDMStaking
 * @notice Lock GNDM to earn tier access and staking rewards.
 *
 * Rules:
 *  - 24-hour lock: tokens cannot be unstaked within 24h of staking. Re-staking resets the clock.
 *  - 7-day reward eligibility: rewards only claimable after 7 days of continuous stake. Re-staking resets the clock.
 *  - Yield: Synthetix pattern. Owner can deposit reward pools; authorized contracts can route game fees in.
 */
contract GNDMStaking is OwnableUpgradeable, UUPSUpgradeable {

    // ─── Errors ─────────────────────────────────────────────────────────────

    error StillLocked(uint256 unlockTime);
    error NotEligibleYet(uint256 eligibleAt);
    error NoPendingRewards();
    error NoStakeToUnstake();
    error Unauthorized();
    error ZeroAmount();

    // ─── Events ─────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount, uint256 lockUntil, uint256 rewardEligibleAt);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount);
    event FeeRouterSet(address indexed addr, bool authorized);

    // ─── Constants ──────────────────────────────────────────────────────────

    uint256 private constant LOCK_DURATION    = 24 hours;
    uint256 private constant REWARD_DELAY     = 7 days;
    uint256 private constant PRECISION        = 1e18;

    // ─── State ──────────────────────────────────────────────────────────────

    IERC20 public gndm;

    // Staking balances
    mapping(address => uint256) public stakedBalance;
    uint256 public totalStaked;

    // Lockup timestamps
    mapping(address => uint256) public lockUntil;
    mapping(address => uint256) public rewardEligibleAt;

    // Synthetix yield accounting
    uint256 public rewardPerTokenStored;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public periodFinish;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // Fee routing
    mapping(address => bool) public authorizedFeeRouters;

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address gndm_) external initializer {
        __Ownable_init(owner_);
        gndm = IERC20(gndm_);
    }

    // ─── Modifiers ──────────────────────────────────────────────────────────

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastApplicableTime();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function lastApplicableTime() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + (lastApplicableTime() - lastUpdateTime) * rewardRate * PRECISION / totalStaked;
    }

    /**
     * @notice Returns 0 if user is not yet past their 7-day eligibility window.
     */
    function earned(address account) public view returns (uint256) {
        if (block.timestamp < rewardEligibleAt[account]) return 0;
        return stakedBalance[account]
            * (rewardPerToken() - userRewardPerTokenPaid[account]) / PRECISION
            + rewards[account];
    }

    // ─── User Actions ───────────────────────────────────────────────────────

    /**
     * @notice Stake GNDM. Resets 24h lock and 7-day reward eligibility.
     */
    function stake(uint256 amount) external updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();

        stakedBalance[msg.sender] += amount;
        totalStaked += amount;

        lockUntil[msg.sender]        = block.timestamp + LOCK_DURATION;
        rewardEligibleAt[msg.sender] = block.timestamp + REWARD_DELAY;

        // Reset pending reward snapshot so they don't get credit for the new 7-day window
        rewards[msg.sender] = 0;
        userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;

        require(gndm.transferFrom(msg.sender, address(this), amount), "GNDMStaking: transfer failed");

        emit Staked(msg.sender, amount, lockUntil[msg.sender], rewardEligibleAt[msg.sender]);
    }

    /**
     * @notice Unstake GNDM. Reverts if within 24h lock window.
     */
    function unstake(uint256 amount) external updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        if (stakedBalance[msg.sender] < amount) revert NoStakeToUnstake();
        if (block.timestamp < lockUntil[msg.sender]) revert StillLocked(lockUntil[msg.sender]);

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;

        require(gndm.transfer(msg.sender, amount), "GNDMStaking: transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Claim accrued rewards. Reverts if < 7 days since last stake.
     */
    function claimRewards() external updateReward(msg.sender) {
        if (block.timestamp < rewardEligibleAt[msg.sender]) {
            revert NotEligibleYet(rewardEligibleAt[msg.sender]);
        }
        uint256 reward = rewards[msg.sender];
        if (reward == 0) revert NoPendingRewards();

        rewards[msg.sender] = 0;
        require(gndm.transfer(msg.sender, reward), "GNDMStaking: reward transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit a reward pool. duration in seconds (e.g. 30 days = 2_592_000).
     *         Can be called again before period ends — remaining rewards roll over.
     */
    function notifyRewardAmount(uint256 amount, uint256 duration)
        external
        onlyOwner
        updateReward(address(0))
    {
        require(gndm.transferFrom(msg.sender, address(this), amount), "GNDMStaking: transfer failed");

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / duration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover  = remaining * rewardRate;
            rewardRate = (amount + leftover) / duration;
        }

        lastUpdateTime = block.timestamp;
        periodFinish   = block.timestamp + duration;

        emit RewardAdded(amount);
    }

    /**
     * @notice Route game fees into the reward pool.
     *         Called by authorized contracts (GundaniumGame, PrizePool).
     */
    function receiveGameFees(uint256 amount) external updateReward(address(0)) {
        if (!authorizedFeeRouters[msg.sender]) revert Unauthorized();
        require(gndm.transferFrom(msg.sender, address(this), amount), "GNDMStaking: transfer failed");

        uint256 duration = block.timestamp >= periodFinish
            ? 30 days
            : periodFinish - block.timestamp;

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / duration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover  = remaining * rewardRate;
            rewardRate = (amount + leftover) / duration;
        }

        lastUpdateTime = block.timestamp;
        periodFinish   = block.timestamp + duration;

        emit RewardAdded(amount);
    }

    /**
     * @notice Grant or revoke fee routing authorization.
     */
    function setFeeRouter(address addr, bool authorized) external onlyOwner {
        authorizedFeeRouters[addr] = authorized;
        emit FeeRouterSet(addr, authorized);
    }

    /**
     * @notice Emergency token rescue.
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(owner(), amount), "GNDMStaking: withdraw failed");
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
