// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Testnet-only mock ERC20 for $GNDM.
 * @dev    Deployer receives the full initial supply. Never use on mainnet.
 */
contract MockERC20 is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        address recipient
    ) ERC20(name_, symbol_) {
        _mint(recipient, initialSupply);
    }
}
