// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title GNDMtoGUNR
/// @notice One-time 1:1 migration from $GNDM to $GUNR with Merkle whitelist and per-address caps.
contract GNDMtoGUNR {
    IERC20 public immutable gndm;
    IERC20 public immutable gunr;
    bytes32 public immutable merkleRoot;
    uint256 public immutable deadline;
    address public immutable owner;

    mapping(address => uint256) public migrated;

    event Migrated(address indexed user, uint256 amount, uint256 totalMigrated);

    constructor(address owner_, address gndm_, address gunr_, bytes32 merkleRoot_, uint256 deadline_) {
        require(owner_ != address(0) && gndm_ != address(0) && gunr_ != address(0), "Migration: zero address");
        require(deadline_ > block.timestamp, "Migration: deadline in past");
        owner = owner_;
        gndm = IERC20(gndm_);
        gunr = IERC20(gunr_);
        merkleRoot = merkleRoot_;
        deadline = deadline_;
    }

    /// @notice Swap GNDM for GUNR at 1:1. Caller must have approved GNDM to this contract.
    function migrate(uint256 amount, uint256 cap, bytes32[] calldata proof) external {
        require(block.timestamp <= deadline, "Migration: deadline passed");
        require(migrated[msg.sender] + amount <= cap, "Migration: cap exceeded");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, cap));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Migration: not in whitelist");

        migrated[msg.sender] += amount;

        require(gndm.transferFrom(msg.sender, address(this), amount), "Migration: GNDM transfer failed");
        require(gunr.transfer(msg.sender, amount), "Migration: GUNR transfer failed");

        emit Migrated(msg.sender, amount, migrated[msg.sender]);
    }

    /// @notice Owner withdraws remaining GUNR after deadline.
    function withdrawGUNR() external {
        require(msg.sender == owner, "Migration: not owner");
        require(block.timestamp > deadline, "Migration: deadline not passed");
        uint256 bal = gunr.balanceOf(address(this));
        require(gunr.transfer(owner, bal), "Migration: GUNR withdraw failed");
    }

    /// @notice Owner withdraws accumulated GNDM at any time.
    function withdrawGNDM() external {
        require(msg.sender == owner, "Migration: not owner");
        uint256 bal = gndm.balanceOf(address(this));
        require(gndm.transfer(owner, bal), "Migration: GNDM withdraw failed");
    }
}
