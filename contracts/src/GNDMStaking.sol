// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GNDMStaking
 * @notice Lock GNDM to earn tier access and staking rewards.
 *
 * Rules:
 *  - 24-hour lock: tokens cannot be unstaked within 24h of staking. Re-staking resets the clock.
 *  - 7-day reward eligibility: rewards only claimable after 7 days of continuous stake. Re-staking resets the clock.
 *  - Yield: Synthetix pattern. Owner can deposit reward pools; authorized contracts can route game fees in.
 */
contract GNDMStaking is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuard, PausableUpgradeable {

    using SafeERC20 for IERC20;

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
    event RewardForfeited(address indexed user, uint256 amount);

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
        __Pausable_init();
        require(gndm_ != address(0), "GNDMStaking: zero address");
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
    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();

        // Save old eligibility BEFORE resetting timestamps
        uint256 oldEligibleAt = rewardEligibleAt[msg.sender];

        stakedBalance[msg.sender] += amount;
        totalStaked += amount;

        lockUntil[msg.sender]        = block.timestamp + LOCK_DURATION;
        rewardEligibleAt[msg.sender] = block.timestamp + REWARD_DELAY;

        // Handle previously accrued rewards before resetting the reward checkpoint
        uint256 pendingReward = rewards[msg.sender];
        if (pendingReward > 0) {
            if (block.timestamp >= oldEligibleAt) {
                // User was eligible — auto-pay before the window resets
                rewards[msg.sender] = 0;
                gndm.safeTransfer(msg.sender, pendingReward);
                emit RewardClaimed(msg.sender, pendingReward);
            } else {
                // User re-staked before eligibility window — rewards forfeited by design
                emit RewardForfeited(msg.sender, pendingReward);
                rewards[msg.sender] = 0;
            }
        }
        userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;

        gndm.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, lockUntil[msg.sender], rewardEligibleAt[msg.sender]);
    }

    /**
     * @notice Unstake GNDM. Reverts if within 24h lock window.
     */
    function unstake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        if (stakedBalance[msg.sender] < amount) revert NoStakeToUnstake();
        if (block.timestamp < lockUntil[msg.sender]) revert StillLocked(lockUntil[msg.sender]);

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;

        gndm.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Claim accrued rewards. Reverts if < 7 days since last stake.
     */
    function claimRewards() external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (block.timestamp < rewardEligibleAt[msg.sender]) {
            revert NotEligibleYet(rewardEligibleAt[msg.sender]);
        }
        uint256 reward = rewards[msg.sender];
        if (reward == 0) revert NoPendingRewards();

        rewards[msg.sender] = 0;
        gndm.safeTransfer(msg.sender, reward);

        emit RewardClaimed(msg.sender, reward);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit a reward pool. duration in seconds (e.g. 30 days = 2_592_000).
     *         Can be called again before period ends — remaining rewards roll over.
     */
    function notifyRewardAmount(uint256 amount, uint256 duration)
        external
        nonReentrant
        onlyOwner
        updateReward(address(0))
    {
        if (amount == 0 || duration == 0) revert ZeroAmount();

        gndm.safeTransferFrom(msg.sender, address(this), amount);

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
    function receiveGameFees(uint256 amount) external nonReentrant updateReward(address(0)) {
        if (!authorizedFeeRouters[msg.sender]) revert Unauthorized();
        if (amount == 0) revert ZeroAmount();
        gndm.safeTransferFrom(msg.sender, address(this), amount);

        if (block.timestamp >= periodFinish) {
            // No active period — start a new 30-day emission
            rewardRate = amount / 30 days;
            periodFinish = block.timestamp + 30 days;
        } else {
            // Mid-period: fold fees into remaining window, keep periodFinish unchanged
            uint256 remaining = periodFinish - block.timestamp;
            rewardRate = (amount + remaining * rewardRate) / remaining;
            // periodFinish stays the same — fees are distributed over the existing period
        }

        lastUpdateTime = block.timestamp;
        emit RewardAdded(amount);
    }

    /**
     * @notice Grant or revoke fee routing authorization.
     */
    function setFeeRouter(address addr, bool authorized) external onlyOwner {
        if (addr == address(0)) revert ZeroAmount();
        authorizedFeeRouters[addr] = authorized;
        emit FeeRouterSet(addr, authorized);
    }

    /**
     * @notice Emergency token rescue. Cannot be used to drain staked GNDM.
     */
    function emergencyWithdraw(address token, uint256 amount) external nonReentrant onlyOwner {
        if (token == address(gndm)) revert("GNDMStaking: use unstake");
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Pause staking, unstaking, and reward claiming.
     */
    function pause() external onlyOwner { _pause(); }

    /**
     * @notice Unpause the contract.
     */
    function unpause() external onlyOwner { _unpause(); }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
