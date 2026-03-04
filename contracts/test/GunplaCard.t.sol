// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GunplaCard} from "../src/GunplaCard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Minimal ERC20 mock for USDC
contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        require(balanceOf[from] >= amount, "insufficient");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract GunplaCardTest is Test {
    GunplaCard card;
    MockUSDC usdc;

    address owner   = address(0x1);
    address minter  = address(0x2);
    address receiver = address(0x3);

    uint256 constant MINT_PRICE     = 5_000_000;  // $5 USDC
    uint256 constant COSMETIC_PRICE = 1_000_000;  // $1 USDC

    GunplaCard.CardTraits sampleTraits = GunplaCard.CardTraits({
        name:             "RX-78-2 Gundam",
        series:           "Mobile Suit Gundam [Universal Century]",
        faction:          "EFSF",
        pilotName:        "Amuro Ray",
        rarity:           4,    // Legendary
        armorType:        5,    // Luna Titanium
        hp:               1500,
        primaryWeapon:    "Beam Rifle",
        primaryDamage:    320,
        secondaryWeapon:  "Beam Saber",
        secondaryDamage:  480,
        tertiaryWeapon:   "Hyper Bazooka",
        tertiaryDamage:   150,
        specialAttack:    "Fin Funnel Barrage",
        specialDamage:    850,
        repaintColor:     "",
        decalId:          ""
    });

    function setUp() public {
        usdc = new MockUSDC();

        GunplaCard impl = new GunplaCard();
        bytes memory init = abi.encodeCall(
            GunplaCard.initialize,
            (owner, address(usdc), MINT_PRICE, COSMETIC_PRICE)
        );
        card = GunplaCard(address(new ERC1967Proxy(address(impl), init)));

        // Fund minter with USDC
        usdc.mint(minter, 100_000_000); // $100
    }

    // ── Initialization ───────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(card.name(), "GundariuM Gunpla Card");
        assertEq(card.symbol(), "GUNPLA");
        assertEq(card.owner(), owner);
        assertEq(card.mintPriceUsdc(), MINT_PRICE);
        assertEq(card.cosmeticPriceUsdc(), COSMETIC_PRICE);
        assertEq(address(card.usdc()), address(usdc));
    }

    // ── Minting ──────────────────────────────────────────────────────────────

    function test_MintCard() public {
        vm.startPrank(minter);
        usdc.approve(address(card), MINT_PRICE);
        uint256 tokenId = card.mintCard(receiver, "ipfs://Qm123", sampleTraits);
        vm.stopPrank();

        assertEq(tokenId, 1);
        assertEq(card.ownerOf(1), receiver);
        assertEq(card.tokenURI(1), "ipfs://Qm123");
        assertEq(usdc.balanceOf(address(card)), MINT_PRICE);
    }

    function test_MintCard_TraitsStoredCorrectly() public {
        vm.startPrank(minter);
        usdc.approve(address(card), MINT_PRICE);
        card.mintCard(receiver, "ipfs://Qm123", sampleTraits);
        vm.stopPrank();

        GunplaCard.CardTraits memory t = card.getTraits(1);
        assertEq(t.name, "RX-78-2 Gundam");
        assertEq(t.rarity, 4);
        assertEq(t.hp, 1500);
        assertEq(t.primaryWeapon, "Beam Rifle");
        assertEq(t.specialDamage, 850);
    }

    function test_MintCard_TokenIdIncrementsFromOne() public {
        vm.startPrank(minter);
        usdc.approve(address(card), MINT_PRICE * 3);
        uint256 id1 = card.mintCard(receiver, "ipfs://1", sampleTraits);
        uint256 id2 = card.mintCard(receiver, "ipfs://2", sampleTraits);
        uint256 id3 = card.mintCard(receiver, "ipfs://3", sampleTraits);
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    function test_MintCard_RevertsOnInsufficientAllowance() public {
        vm.startPrank(minter);
        // No approval
        vm.expectRevert();
        card.mintCard(receiver, "ipfs://Qm123", sampleTraits);
        vm.stopPrank();
    }

    function test_MintCard_RevertsOnZeroAddress() public {
        vm.startPrank(minter);
        usdc.approve(address(card), MINT_PRICE);
        vm.expectRevert();
        card.mintCard(address(0), "ipfs://Qm123", sampleTraits);
        vm.stopPrank();
    }

    // ── Cosmetics ────────────────────────────────────────────────────────────

    function test_UpdateCosmetics() public {
        // Mint first
        vm.startPrank(minter);
        usdc.approve(address(card), MINT_PRICE);
        card.mintCard(minter, "ipfs://Qm123", sampleTraits);
        vm.stopPrank();

        // Update cosmetics as owner of token
        vm.startPrank(minter);
        usdc.approve(address(card), COSMETIC_PRICE);
        card.updateCosmetics(1, "#FF0000", "decal_01");
        vm.stopPrank();

        GunplaCard.CardTraits memory t = card.getTraits(1);
        assertEq(t.repaintColor, "#FF0000");
        assertEq(t.decalId, "decal_01");
    }

    function test_UpdateCosmetics_RevertsIfNotOwner() public {
        vm.startPrank(minter);
        usdc.approve(address(card), MINT_PRICE);
        card.mintCard(receiver, "ipfs://Qm123", sampleTraits); // minted to receiver
        vm.stopPrank();

        // minter tries to update cosmetics on receiver's token
        vm.startPrank(minter);
        usdc.approve(address(card), COSMETIC_PRICE);
        vm.expectRevert();
        card.updateCosmetics(1, "#FF0000", "");
        vm.stopPrank();
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function test_SetMintPrice() public {
        vm.prank(owner);
        card.setMintPrice(10_000_000);
        assertEq(card.mintPriceUsdc(), 10_000_000);
    }

    function test_SetMintPrice_RevertsIfNotOwner() public {
        vm.prank(minter);
        vm.expectRevert();
        card.setMintPrice(10_000_000);
    }

    function test_WithdrawUsdc() public {
        // Mint to fill contract balance
        vm.startPrank(minter);
        usdc.approve(address(card), MINT_PRICE);
        card.mintCard(receiver, "ipfs://Qm123", sampleTraits);
        vm.stopPrank();

        uint256 ownerBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        card.withdrawUsdc(MINT_PRICE);
        assertEq(usdc.balanceOf(owner), ownerBefore + MINT_PRICE);
        assertEq(usdc.balanceOf(address(card)), 0);
    }

    // ── ERC-721 standard ────────────────────────────────────────────────────

    function test_SupportsERC721Interface() public view {
        assertTrue(card.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(card.supportsInterface(0x780e9d63)); // ERC721Enumerable
        assertTrue(card.supportsInterface(0x5b5e139f)); // ERC721Metadata
    }

    function test_TotalSupplyIncrements() public {
        assertEq(card.totalSupply(), 0);

        vm.startPrank(minter);
        usdc.approve(address(card), MINT_PRICE * 2);
        card.mintCard(receiver, "ipfs://1", sampleTraits);
        card.mintCard(receiver, "ipfs://2", sampleTraits);
        vm.stopPrank();

        assertEq(card.totalSupply(), 2);
    }
}
