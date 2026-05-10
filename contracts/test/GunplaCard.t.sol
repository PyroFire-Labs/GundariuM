// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {GunplaCard} from "../src/GunplaCard.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract GunplaCardTest is Test {
    GunplaCard card;
    MockERC20  usdc;

    address owner = address(1);
    address alice = address(2);
    address bob   = address(3);
    address charlie = address(4);

    uint256 constant MINT_PRICE     = 2_000_000;   // $2.00
    uint256 constant COSMETIC_PRICE = 500_000;      // $0.50

    // Whitelist test state
    bytes32 merkleRoot;
    bytes32[] aliceProof;
    bytes32[] bobProof;

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 1_000_000e6, owner);

        GunplaCard impl = new GunplaCard();
        bytes memory init = abi.encodeCall(
            GunplaCard.initialize,
            (owner, address(usdc), MINT_PRICE, COSMETIC_PRICE)
        );
        card = GunplaCard(address(new ERC1967Proxy(address(impl), init)));

        // Fund alice and bob
        vm.startPrank(owner);
        usdc.transfer(alice, 100_000_000); // $100
        usdc.transfer(bob,   100_000_000);
        vm.stopPrank();

        vm.prank(alice);
        usdc.approve(address(card), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(card), type(uint256).max);

        // Configure whitelist
        _buildMerkleTree();
        vm.startPrank(owner);
        card.setMerkleRoot(merkleRoot);
        card.setTierPrice(1, 1_000_000);    // VIP: $1
        card.setTierPrice(2, 1_500_000);    // WL: $1.50
        card.setWhitelistMintCap(5);
        card.setMintPhase(GunplaCard.MintPhase.PUBLIC); // default to PUBLIC so existing mint tests work
        vm.stopPrank();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    function _defaultTraits() internal pure returns (GunplaCard.CardTraits memory) {
        return GunplaCard.CardTraits({
            name: "RX-78-2 Gundam",
            series: "MSG",
            faction: "EFSF",
            pilotName: "Amuro Ray",
            rarity: 2,
            armorType: 0,
            hp: 1200,
            primaryWeapon: "Beam Rifle",
            primaryDamage: 300,
            secondaryWeapon: "Beam Saber",
            secondaryDamage: 250,
            tertiaryWeapon: "Shield Bash",
            tertiaryDamage: 150,
            specialAttack: "Last Shooting",
            specialDamage: 500,
            repaintColor: "",
            decalId: ""
        });
    }

    function _mintAsAlice() internal returns (uint256) {
        vm.prank(alice);
        return card.mintCard(alice, "ipfs://QmTest123", _defaultTraits());
    }

    function _buildMerkleTree() internal {
        // Tier 1 = VIP ($1), Tier 2 = WL ($1.50)
        // Leaves: keccak256(abi.encodePacked(address, uint8))
        bytes32 leafAlice = keccak256(abi.encodePacked(alice, uint8(1)));   // VIP
        bytes32 leafBob   = keccak256(abi.encodePacked(bob, uint8(2)));     // WL

        // Simple 2-leaf Merkle tree
        if (leafAlice <= leafBob) {
            merkleRoot = keccak256(abi.encodePacked(leafAlice, leafBob));
        } else {
            merkleRoot = keccak256(abi.encodePacked(leafBob, leafAlice));
        }

        // Proofs — each is sibling hash
        aliceProof = new bytes32[](1);
        aliceProof[0] = leafBob;

        bobProof = new bytes32[](1);
        bobProof[0] = leafAlice;
    }

    // ─── Minting ──────────────────────────────────────────────────────────

    function test_mintCard() public {
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 tokenId = card.mintCard(alice, "ipfs://QmTest123", _defaultTraits());

        assertEq(tokenId, 1);
        assertEq(card.ownerOf(1), alice);
        assertEq(card.balanceOf(alice), 1);
        assertEq(usdc.balanceOf(alice), balanceBefore - MINT_PRICE);
        assertEq(usdc.balanceOf(address(card)), MINT_PRICE);

        GunplaCard.CardTraits memory t = card.getTraits(1);
        assertEq(t.name, "RX-78-2 Gundam");
        assertEq(t.pilotName, "Amuro Ray");
        assertEq(t.rarity, 2);
        assertEq(t.hp, 1200);
        assertEq(t.primaryDamage, 300);

        assertEq(card.tokenURI(1), "ipfs://QmTest123");
    }

    function test_mintCard_incrementsTokenId() public {
        vm.startPrank(alice);
        uint256 id1 = card.mintCard(alice, "ipfs://1", _defaultTraits());
        uint256 id2 = card.mintCard(alice, "ipfs://2", _defaultTraits());
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(card.balanceOf(alice), 2);
    }

    function test_mintCard_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit GunplaCard.CardMinted(alice, 1, "RX-78-2 Gundam", 2);

        vm.prank(alice);
        card.mintCard(alice, "ipfs://QmTest123", _defaultTraits());
    }

    function test_mintCard_noApproval_reverts() public {
        vm.prank(owner);
        usdc.transfer(charlie, 10_000_000);

        vm.expectRevert(abi.encodeWithSelector(
            IERC20Errors.ERC20InsufficientAllowance.selector,
            address(card), 0, MINT_PRICE
        ));
        vm.prank(charlie);
        card.mintCard(charlie, "ipfs://fail", _defaultTraits());
    }

    function test_mintCard_insufficientBalance_reverts() public {
        address broke = address(5);
        vm.prank(broke);
        usdc.approve(address(card), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(
            IERC20Errors.ERC20InsufficientBalance.selector,
            broke, 0, MINT_PRICE
        ));
        vm.prank(broke);
        card.mintCard(broke, "ipfs://fail", _defaultTraits());
    }

    // ─── Cosmetics ────────────────────────────────────────────────────────

    function test_updateCosmetics() public {
        _mintAsAlice();
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        card.updateCosmetics(1, "#FF0000", "ace-badge");

        GunplaCard.CardTraits memory t = card.getTraits(1);
        assertEq(t.repaintColor, "#FF0000");
        assertEq(t.decalId, "ace-badge");
        assertEq(usdc.balanceOf(alice), balanceBefore - COSMETIC_PRICE);
    }

    function test_updateCosmetics_emitsEvent() public {
        _mintAsAlice();

        vm.expectEmit(true, false, false, true);
        emit GunplaCard.CosmeticsUpdated(1, "#FF0000", "ace-badge");

        vm.prank(alice);
        card.updateCosmetics(1, "#FF0000", "ace-badge");
    }

    function test_updateCosmetics_notOwner_reverts() public {
        _mintAsAlice();

        vm.expectRevert("GunplaCard: not owner");
        vm.prank(bob);
        card.updateCosmetics(1, "#000", "decal");
    }

    function test_updateCosmetics_noApproval_reverts() public {
        _mintAsAlice();

        vm.prank(alice);
        usdc.approve(address(card), 0);

        vm.expectRevert(abi.encodeWithSelector(
            IERC20Errors.ERC20InsufficientAllowance.selector,
            address(card), 0, COSMETIC_PRICE
        ));
        vm.prank(alice);
        card.updateCosmetics(1, "#000", "decal");
    }

    // ─── Views ────────────────────────────────────────────────────────────

    function test_getTraits_nonexistent_reverts() public {
        vm.expectRevert("GunplaCard: token does not exist");
        card.getTraits(999);
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    function test_setMintPrice() public {
        vm.expectEmit(false, false, false, true);
        emit GunplaCard.MintPriceUpdated(5_000_000);

        vm.prank(owner);
        card.setMintPrice(5_000_000);

        assertEq(card.mintPriceUsdc(), 5_000_000);
    }

    function test_setCosmeticPrice() public {
        vm.expectEmit(false, false, false, true);
        emit GunplaCard.CosmeticPriceUpdated(1_000_000);

        vm.prank(owner);
        card.setCosmeticPrice(1_000_000);

        assertEq(card.cosmeticPriceUsdc(), 1_000_000);
    }

    function test_setPrices_nonOwner_reverts() public {
        vm.startPrank(alice);

        vm.expectRevert();
        card.setMintPrice(1);

        vm.expectRevert();
        card.setCosmeticPrice(1);

        vm.stopPrank();
    }

    function test_withdrawUsdc() public {
        _mintAsAlice();

        uint256 ownerBefore = usdc.balanceOf(owner);

        vm.prank(owner);
        card.withdrawUsdc(MINT_PRICE);

        assertEq(usdc.balanceOf(owner), ownerBefore + MINT_PRICE);
        assertEq(usdc.balanceOf(address(card)), 0);
    }

    function test_withdrawUsdc_nonOwner_reverts() public {
        _mintAsAlice();

        vm.expectRevert();
        vm.prank(alice);
        card.withdrawUsdc(MINT_PRICE);
    }

    // ─── Whitelist Phase Tests ────────────────────────────────────────────

    function test_pausedPhaseBlocksMint() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.PAUSED);

        vm.prank(alice);
        vm.expectRevert("GunplaCard: not in public phase");
        card.mintCard(alice, "ipfs://test", _defaultTraits());
    }

    function test_pausedPhaseBlocksWhitelistMint() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.PAUSED);

        vm.prank(alice);
        vm.expectRevert("GunplaCard: minting paused");
        card.mintCardWhitelist(alice, "ipfs://test", _defaultTraits(), 1, aliceProof);
    }

    // VIPs must keep their discount after public mint opens. The contract
    // upgrade in feat/wl-mint-during-public-phase changes the require in
    // mintCardWhitelist from `phase == WHITELIST` to `phase != PAUSED` so a
    // whitelisted user can still mint at tier price during PUBLIC phase.
    function test_publicPhaseAllowsWhitelistMint() public {
        // setUp already sets phase to PUBLIC
        assertEq(uint8(card.mintPhase()), uint8(GunplaCard.MintPhase.PUBLIC));

        uint256 balanceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 tokenId = card.mintCardWhitelist(alice, "ipfs://vip-during-public", _defaultTraits(), 1, aliceProof);

        assertEq(card.ownerOf(tokenId), alice);
        assertEq(card.whitelistMintCount(alice), 1);
        // Confirm she paid tier 1 price ($1) not the public price ($2)
        assertEq(usdc.balanceOf(alice), balanceBefore - 1_000_000);
    }

    function test_publicPhaseStillRejectsInvalidProof() public {
        // Phase is PUBLIC from setUp
        // Fund and approve charlie (not on whitelist)
        vm.prank(owner);
        usdc.transfer(charlie, 10_000_000);
        vm.prank(charlie);
        usdc.approve(address(card), type(uint256).max);

        bytes32[] memory fakeProof = new bytes32[](1);
        fakeProof[0] = bytes32(uint256(0xdead));

        vm.prank(charlie);
        vm.expectRevert("GunplaCard: invalid proof");
        card.mintCardWhitelist(charlie, "ipfs://fake", _defaultTraits(), 2, fakeProof);
    }

    function test_publicPhaseStillEnforcesMintCap() public {
        // Phase is PUBLIC from setUp
        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            card.mintCardWhitelist(alice, "ipfs://test", _defaultTraits(), 1, aliceProof);
        }
        vm.expectRevert("GunplaCard: mint cap reached");
        card.mintCardWhitelist(alice, "ipfs://test", _defaultTraits(), 1, aliceProof);
        vm.stopPrank();
    }

    function test_whitelistPhaseAllowsWLMint() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        vm.prank(alice);
        uint256 tokenId = card.mintCardWhitelist(alice, "ipfs://vip", _defaultTraits(), 1, aliceProof);
        assertEq(card.ownerOf(tokenId), alice);
        assertEq(card.whitelistMintCount(alice), 1);
    }

    function test_whitelistPhaseBlocksPublicMint() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        vm.prank(alice);
        vm.expectRevert("GunplaCard: not in public phase");
        card.mintCard(alice, "ipfs://test", _defaultTraits());
    }

    function test_vipPaysCorrectPrice() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        uint256 balanceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        card.mintCardWhitelist(alice, "ipfs://vip", _defaultTraits(), 1, aliceProof);
        assertEq(usdc.balanceOf(alice), balanceBefore - 1_000_000); // $1
    }

    function test_wlPaysCorrectPrice() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        uint256 balanceBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        card.mintCardWhitelist(bob, "ipfs://wl", _defaultTraits(), 2, bobProof);
        assertEq(usdc.balanceOf(bob), balanceBefore - 1_500_000); // $1.50
    }

    function test_invalidProofRejected() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        // Fund and approve charlie (not on whitelist)
        vm.prank(owner);
        usdc.transfer(charlie, 10_000_000);
        vm.prank(charlie);
        usdc.approve(address(card), type(uint256).max);

        bytes32[] memory fakeProof = new bytes32[](1);
        fakeProof[0] = bytes32(uint256(0xdead));

        vm.prank(charlie);
        vm.expectRevert("GunplaCard: invalid proof");
        card.mintCardWhitelist(charlie, "ipfs://fake", _defaultTraits(), 2, fakeProof);
    }

    function test_mintCapEnforced() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            card.mintCardWhitelist(alice, "ipfs://test", _defaultTraits(), 1, aliceProof);
        }
        // 6th mint should fail
        vm.expectRevert("GunplaCard: mint cap reached");
        card.mintCardWhitelist(alice, "ipfs://test", _defaultTraits(), 1, aliceProof);
        vm.stopPrank();
    }

    function test_publicPhaseAllowsAnyMint() public {
        // Phase is already PUBLIC from setUp

        // Fund charlie
        vm.prank(owner);
        usdc.transfer(charlie, 10_000_000);
        vm.prank(charlie);
        usdc.approve(address(card), type(uint256).max);

        vm.prank(charlie);
        uint256 tokenId = card.mintCard(charlie, "ipfs://public", _defaultTraits());
        assertEq(card.ownerOf(tokenId), charlie);
    }
}
