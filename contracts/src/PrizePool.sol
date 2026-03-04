// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

/**
 * @title PrizePool
 * @notice Holds and distributes daily, weekly, and monthly prize pools for GundariuM.
 *         Anyone can deposit GNDM or USDC into a pool (game contract auto-deposits fees).
 *         The owner submits winner lists via EIP-712 signed distribution calls.
 *         Distributions are capped to cadence (daily: 24h, weekly: 7d, monthly: 30d).
 */
contract PrizePool is OwnableUpgradeable, UUPSUpgradeable, EIP712Upgradeable {
    using ECDSA for bytes32;

    // ─── Constants ──────────────────────────────────────────────────────────

    uint8 public constant DAILY   = 0;
    uint8 public constant WEEKLY  = 1;
    uint8 public constant MONTHLY = 2;

    uint64 private constant DAY   = 86_400;
    uint64 private constant WEEK  = 604_800;
    uint64 private constant MONTH = 2_592_000; // 30 days

    bytes32 private constant DISTRIBUTION_TYPEHASH = keccak256(
        "Distribution(uint8 poolType,address[] winners,uint256[] gndmShares,uint256[] usdcShares,uint256 nonce)"
    );

    // ─── State ──────────────────────────────────────────────────────────────

    IERC20 public gndm;
    IERC20 public usdc;

    struct Pool {
        uint256 gndmBalance;
        uint256 usdcBalance;
        uint64  lastDistributed;
    }

    mapping(uint8 => Pool) public pools;
    uint256 public distributionNonce;

    // ─── Events ─────────────────────────────────────────────────────────────

    event Deposited(uint8 indexed poolType, address indexed token, uint256 amount);
    event Distributed(uint8 indexed poolType, uint256 gndmTotal, uint256 usdcTotal, uint256 winnerCount);

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address gndmAddress_,
        address usdcAddress_
    ) external initializer {
        __Ownable_init(owner_);
        __EIP712_init("GundariuM PrizePool", "1");

        gndm = IERC20(gndmAddress_);
        usdc = IERC20(usdcAddress_);
    }

    // ─── Deposits ───────────────────────────────────────────────────────────

    function depositGndm(uint8 poolType, uint256 amount) external {
        require(poolType <= MONTHLY, "PrizePool: invalid pool type");
        require(gndm.transferFrom(msg.sender, address(this), amount), "PrizePool: transfer failed");
        pools[poolType].gndmBalance += amount;
        emit Deposited(poolType, address(gndm), amount);
    }

    function depositUsdc(uint8 poolType, uint256 amount) external {
        require(poolType <= MONTHLY, "PrizePool: invalid pool type");
        require(usdc.transferFrom(msg.sender, address(this), amount), "PrizePool: transfer failed");
        pools[poolType].usdcBalance += amount;
        emit Deposited(poolType, address(usdc), amount);
    }

    // ─── Distribution ───────────────────────────────────────────────────────

    /**
     * @notice Distribute prizes to ranked winners.
     *         Signature must come from the contract owner's EOA to prevent tampering.
     *         Enforces cadence: can only distribute each pool type once per period.
     *
     * @param poolType      DAILY, WEEKLY, or MONTHLY
     * @param winners       Ordered array of winner addresses (1st = top rank)
     * @param gndmShares    GNDM amount for each winner (must sum to <= pool.gndmBalance)
     * @param usdcShares    USDC amount for each winner (must sum to <= pool.usdcBalance)
     * @param signature     EIP-712 signature from owner
     */
    function distribute(
        uint8 poolType,
        address[] calldata winners,
        uint256[] calldata gndmShares,
        uint256[] calldata usdcShares,
        bytes calldata signature
    ) external {
        require(poolType <= MONTHLY, "PrizePool: invalid pool type");
        require(winners.length > 0, "PrizePool: no winners");
        require(
            winners.length == gndmShares.length && winners.length == usdcShares.length,
            "PrizePool: length mismatch"
        );

        Pool storage p = pools[poolType];

        // Enforce cadence
        uint64 cadence = poolType == DAILY ? DAY : poolType == WEEKLY ? WEEK : MONTH;
        require(
            block.timestamp >= p.lastDistributed + cadence,
            "PrizePool: too soon"
        );

        // Verify owner EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                DISTRIBUTION_TYPEHASH,
                poolType,
                keccak256(abi.encode(winners)),
                keccak256(abi.encode(gndmShares)),
                keccak256(abi.encode(usdcShares)),
                distributionNonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == owner(), "PrizePool: invalid signature");

        distributionNonce++;

        // Compute totals and validate balances
        uint256 totalGndm;
        uint256 totalUsdc;
        for (uint256 i = 0; i < gndmShares.length; i++) {
            totalGndm += gndmShares[i];
            totalUsdc += usdcShares[i];
        }
        require(totalGndm <= p.gndmBalance, "PrizePool: insufficient GNDM");
        require(totalUsdc <= p.usdcBalance, "PrizePool: insufficient USDC");

        p.gndmBalance -= totalGndm;
        p.usdcBalance -= totalUsdc;
        p.lastDistributed = uint64(block.timestamp);

        // Transfer to winners
        for (uint256 i = 0; i < winners.length; i++) {
            if (gndmShares[i] > 0) require(gndm.transfer(winners[i], gndmShares[i]), "PrizePool: GNDM transfer failed");
            if (usdcShares[i] > 0) require(usdc.transfer(winners[i], usdcShares[i]), "PrizePool: USDC transfer failed");
        }

        emit Distributed(poolType, totalGndm, totalUsdc, winners.length);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getPool(uint8 poolType) external view returns (Pool memory) {
        return pools[poolType];
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(owner(), amount), "PrizePool: withdraw failed");
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
