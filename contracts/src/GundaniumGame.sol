// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

/**
 * @title GundaniumGame
 * @notice Battle contract for GundariuM TCG.
 *         Uses a hybrid on-chain/off-chain model:
 *         - Session creation and GNDM stake locking happen on-chain.
 *         - Battle resolution happens off-chain by the trusted game server.
 *         - The server submits an EIP-712 signed BattleResult for settlement.
 *         This keeps gas costs to one transaction per battle (not one per turn).
 */
contract GundaniumGame is OwnableUpgradeable, UUPSUpgradeable, EIP712Upgradeable {
    using ECDSA for bytes32;

    // ─── Constants ──────────────────────────────────────────────────────────

    bytes32 private constant BATTLE_RESULT_TYPEHASH =
        keccak256("BattleResult(uint256 sessionId,address winner,uint16 finalHpWinner,uint256 timestamp)");

    // ─── Enums & Structs ────────────────────────────────────────────────────

    enum BattleType { PVE, PVP }
    enum BattleStatus { Pending, Active, Complete, Abandoned }

    struct BattleSession {
        address player1;
        address player2;        // address(0) for PVE
        uint256 card1TokenId;
        uint256 card2TokenId;   // 0 for PVE until opponent chosen server-side
        uint256 gndmStaked;     // per player
        BattleType battleType;
        BattleStatus status;
        uint256 arcId;          // PVE: campaign arc; PVP: 0
        address winner;
        uint64  createdAt;
        bool    rewardClaimed;
    }

    // ─── State ──────────────────────────────────────────────────────────────

    IERC20 public gndm;
    address public trustedResolver;     // server EOA whose EIP-712 sigs are accepted

    uint256 public pveEntryFee;         // GNDM to lock for PVE (returned on completion)
    uint256 public pvpMinStake;         // minimum GNDM stake per PVP player
    uint256 public pvpFeePercent;       // % of losing stake taken as protocol fee (e.g. 10 = 10%)

    uint256 private _nextSessionId;

    mapping(uint256 => BattleSession) public sessions;
    mapping(address => uint256) public pveCampaignProgress;  // player → highest arc completed
    mapping(uint256 => uint256) public arcGndmReward;        // arcId → GNDM reward amount
    mapping(uint256 => bool) public arcLegendaryDrop;        // arcId → grants legendary NFT drop

    // PVP matchmaking queue
    uint256[] private _pvpQueue;

    // ─── Events ─────────────────────────────────────────────────────────────

    event PVEStarted(address indexed player, uint256 indexed sessionId, uint256 arcId, uint256 cardTokenId);
    event PVPStarted(address indexed player, uint256 indexed sessionId, uint256 cardTokenId, uint256 stake);
    event PVPJoined(address indexed player, uint256 indexed sessionId, uint256 cardTokenId);
    event BattleSettled(uint256 indexed sessionId, address indexed winner);
    event PVERewardClaimed(uint256 indexed sessionId, address indexed player, uint256 gndmAmount);
    event ResolverUpdated(address indexed newResolver);

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address gndmAddress_,
        address trustedResolver_,
        uint256 pveEntryFee_,
        uint256 pvpMinStake_
    ) external initializer {
        __Ownable_init(owner_);
        __EIP712_init("GundariuM", "1");

        gndm = IERC20(gndmAddress_);
        trustedResolver = trustedResolver_;
        pveEntryFee = pveEntryFee_;
        pvpMinStake = pvpMinStake_;
        pvpFeePercent = 10;
        _nextSessionId = 1; // session IDs start at 1; 0 is reserved as "nonexistent"
    }

    // ─── PVE ────────────────────────────────────────────────────────────────

    /**
     * @notice Start a PVE campaign battle. Locks `pveEntryFee` GNDM.
     *         Must pre-approve GNDM transfer.
     * @param cardTokenId  The player's GunplaCard token to use.
     * @param arcId        Campaign arc index (1-based).
     */
    function startPVE(uint256 cardTokenId, uint256 arcId) external returns (uint256 sessionId) {
        require(arcId > 0, "GundaniumGame: invalid arc");

        if (pveEntryFee > 0) {
            require(
                gndm.transferFrom(msg.sender, address(this), pveEntryFee),
                "GundaniumGame: GNDM transfer failed"
            );
        }

        sessionId = _nextSessionId++;
        sessions[sessionId] = BattleSession({
            player1: msg.sender,
            player2: address(0),
            card1TokenId: cardTokenId,
            card2TokenId: 0,
            gndmStaked: pveEntryFee,
            battleType: BattleType.PVE,
            status: BattleStatus.Active,
            arcId: arcId,
            winner: address(0),
            createdAt: uint64(block.timestamp),
            rewardClaimed: false
        });

        emit PVEStarted(msg.sender, sessionId, arcId, cardTokenId);
    }

    /**
     * @notice Claim PVE reward after the server settles the battle.
     */
    function claimPVEReward(uint256 sessionId) external {
        BattleSession storage s = sessions[sessionId];
        require(s.battleType == BattleType.PVE, "GundaniumGame: not PVE");
        require(s.status == BattleStatus.Complete, "GundaniumGame: not complete");
        require(s.winner == msg.sender, "GundaniumGame: not winner");
        require(!s.rewardClaimed, "GundaniumGame: already claimed");

        s.rewardClaimed = true;

        uint256 arcReward = arcGndmReward[s.arcId];
        uint256 totalReturn = s.gndmStaked + arcReward;

        if (s.arcId > pveCampaignProgress[msg.sender]) {
            pveCampaignProgress[msg.sender] = s.arcId;
        }

        if (totalReturn > 0) {
            require(gndm.transfer(msg.sender, totalReturn), "GundaniumGame: GNDM transfer failed");
        }

        emit PVERewardClaimed(sessionId, msg.sender, totalReturn);
    }

    // ─── PVP ────────────────────────────────────────────────────────────────

    /**
     * @notice Enter the PVP queue. Stakes `stakeAmount` GNDM.
     *         Must pre-approve GNDM transfer.
     */
    function startPVP(uint256 cardTokenId, uint256 stakeAmount) external returns (uint256 sessionId) {
        require(stakeAmount >= pvpMinStake, "GundaniumGame: stake too low");

        require(
            gndm.transferFrom(msg.sender, address(this), stakeAmount),
            "GundaniumGame: GNDM transfer failed"
        );

        sessionId = _nextSessionId++;
        sessions[sessionId] = BattleSession({
            player1: msg.sender,
            player2: address(0),
            card1TokenId: cardTokenId,
            card2TokenId: 0,
            gndmStaked: stakeAmount,
            battleType: BattleType.PVP,
            status: BattleStatus.Pending,
            arcId: 0,
            winner: address(0),
            createdAt: uint64(block.timestamp),
            rewardClaimed: false
        });

        _pvpQueue.push(sessionId);

        emit PVPStarted(msg.sender, sessionId, cardTokenId, stakeAmount);
    }

    /**
     * @notice Join an existing PVP session as player 2.
     *         Stake must match player 1's stake.
     */
    function joinPVP(uint256 sessionId, uint256 cardTokenId) external {
        BattleSession storage s = sessions[sessionId];
        require(s.battleType == BattleType.PVP, "GundaniumGame: not PVP");
        require(s.status == BattleStatus.Pending, "GundaniumGame: not pending");
        require(s.player2 == address(0), "GundaniumGame: already has opponent");
        require(s.player1 != msg.sender, "GundaniumGame: cannot join own session");

        require(
            gndm.transferFrom(msg.sender, address(this), s.gndmStaked),
            "GundaniumGame: GNDM transfer failed"
        );

        s.player2 = msg.sender;
        s.card2TokenId = cardTokenId;
        s.status = BattleStatus.Active;

        emit PVPJoined(msg.sender, sessionId, cardTokenId);
    }

    // ─── Settlement ─────────────────────────────────────────────────────────

    /**
     * @notice Settle a completed battle. The result must be signed by the
     *         trusted off-chain game server using EIP-712.
     *         For PVP: winner receives their stake back plus (loser_stake * (100 - fee) / 100).
     *         For PVE: winner must call claimPVEReward separately.
     */
    function settleBattle(
        uint256 sessionId,
        address winner,
        uint16 finalHpWinner,
        uint256 timestamp,
        bytes calldata signature
    ) external {
        BattleSession storage s = sessions[sessionId];
        require(s.status == BattleStatus.Active, "GundaniumGame: not active");
        require(block.timestamp <= timestamp + 5 minutes, "GundaniumGame: result too old");

        // Verify EIP-712 signature from trusted resolver
        bytes32 structHash = keccak256(
            abi.encode(BATTLE_RESULT_TYPEHASH, sessionId, winner, finalHpWinner, timestamp)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == trustedResolver, "GundaniumGame: invalid signature");

        // Validate winner is a battle participant
        require(
            winner == s.player1 || (s.battleType == BattleType.PVP && winner == s.player2),
            "GundaniumGame: invalid winner"
        );

        s.winner = winner;
        s.status = BattleStatus.Complete;

        // Distribute PVP rewards immediately
        if (s.battleType == BattleType.PVP) {
            uint256 fee = (s.gndmStaked * pvpFeePercent) / 100;
            uint256 winnerPayout = s.gndmStaked * 2 - fee; // both stakes minus protocol fee

            require(gndm.transfer(winner, winnerPayout), "GundaniumGame: GNDM transfer failed");
            // Fee stays in contract (owner can withdraw via withdrawGndm)
        }

        emit BattleSettled(sessionId, winner);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function setTrustedResolver(address resolver) external onlyOwner {
        trustedResolver = resolver;
        emit ResolverUpdated(resolver);
    }

    function setArcReward(uint256 arcId, uint256 gndmAmount, bool legendaryDrop) external onlyOwner {
        arcGndmReward[arcId] = gndmAmount;
        arcLegendaryDrop[arcId] = legendaryDrop;
    }

    function setPVPFeePercent(uint256 feePercent) external onlyOwner {
        require(feePercent <= 30, "GundaniumGame: fee too high");
        pvpFeePercent = feePercent;
    }

    function setPveEntryFee(uint256 fee) external onlyOwner {
        pveEntryFee = fee;
    }

    function setPvpMinStake(uint256 minStake) external onlyOwner {
        pvpMinStake = minStake;
    }

    function withdrawGndm(uint256 amount) external onlyOwner {
        require(gndm.transfer(owner(), amount), "GundaniumGame: withdraw failed");
    }

    function getPVPQueue() external view returns (uint256[] memory) {
        return _pvpQueue;
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
