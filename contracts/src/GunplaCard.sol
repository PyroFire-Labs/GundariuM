// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721URIStorageUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {ERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title GunplaCard
 * @notice ERC-721 NFT for the GundariuM Gunpla TCG.
 *         Each token represents a user-photographed Gunpla model kit with
 *         lore-accurate stats minted on Base. Supports USDC minting and
 *         USDC-gated cosmetic updates (repaints, decals).
 */
contract GunplaCard is
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // ─── Structs ────────────────────────────────────────────────────────────

    struct CardTraits {
        string name;            // "RX-78-2 Gundam"
        string series;          // "Mobile Suit Gundam [Universal Century]"
        string faction;         // "EFSF"
        string pilotName;       // "Amuro Ray"
        uint8  rarity;          // 0=Common, 1=Uncommon, 2=Rare, 3=Ultra Rare, 4=Legendary
        uint8  armorType;       // 0=Standard, 1=Gundanium, 2=Phase Shift, 3=I-Field, 4=GN Particle, 5=Luna Titanium
        uint16 hp;
        string primaryWeapon;
        uint16 primaryDamage;
        string secondaryWeapon;
        uint16 secondaryDamage;
        string tertiaryWeapon;
        uint16 tertiaryDamage;
        string specialAttack;
        uint16 specialDamage;
        // Cosmetics — updatable via USDC payment
        string repaintColor;    // hex or empty string
        string decalId;         // decal identifier or empty string
    }

    // ─── State ──────────────────────────────────────────────────────────────

    IERC20 public usdc;
    uint256 public mintPriceUsdc;   // 6-decimal USDC (e.g. 5_000_000 = $5)
    uint256 public cosmeticPriceUsdc; // e.g. 10_000_000 = $10

    uint256 private _nextTokenId;

    mapping(uint256 => CardTraits) private _traits;

    // ─── Whitelist ─────────────────────────────────────────────────
    enum MintPhase { PAUSED, WHITELIST, PUBLIC }

    MintPhase public mintPhase;
    bytes32 public merkleRoot;
    mapping(address => uint256) public whitelistMintCount;
    mapping(uint8 => uint256) public tierPrice;
    uint256 public whitelistMintCap;

    // ─── Events ─────────────────────────────────────────────────────────────

    event CardMinted(address indexed to, uint256 indexed tokenId, string name, uint8 rarity);
    event CosmeticsUpdated(uint256 indexed tokenId, string repaintColor, string decalId);
    event MintPriceUpdated(uint256 newPrice);
    event CosmeticPriceUpdated(uint256 newPrice);

    // ─── Initializer ────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address usdcAddress_,
        uint256 mintPriceUsdc_,
        uint256 cosmeticPriceUsdc_
    ) external initializer {
        __ERC721_init("GundariuM Gunpla Card", "GUNPLA");
        __ERC721URIStorage_init();
        __ERC721Enumerable_init();
        __Ownable_init(owner_);

        usdc = IERC20(usdcAddress_);
        mintPriceUsdc = mintPriceUsdc_;
        cosmeticPriceUsdc = cosmeticPriceUsdc_;
        _nextTokenId = 1; // token IDs start at 1; 0 is reserved as "nonexistent"
    }

    // ─── Minting ────────────────────────────────────────────────────────────

    /**
     * @notice Mint a new Gunpla card. Caller must have approved `mintPriceUsdc`
     *         USDC to this contract before calling.
     * @param to        Recipient of the NFT.
     * @param tokenUri  IPFS URI of the card metadata JSON.
     * @param traits    On-chain trait struct assigned by the game server.
     */
    function mintCard(
        address to,
        string calldata tokenUri,
        CardTraits calldata traits
    ) external returns (uint256 tokenId) {
        require(mintPhase == MintPhase.PUBLIC, "GunplaCard: not in public phase");
        require(
            usdc.transferFrom(msg.sender, address(this), mintPriceUsdc),
            "GunplaCard: USDC transfer failed"
        );

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
        _traits[tokenId] = traits;

        emit CardMinted(to, tokenId, traits.name, traits.rarity);
    }

    /// @notice Mint during whitelist phase with Merkle proof
    function mintCardWhitelist(
        address to,
        string calldata tokenUri,
        CardTraits calldata traits,
        uint8 tier,
        bytes32[] calldata proof
    ) external returns (uint256 tokenId) {
        require(mintPhase == MintPhase.WHITELIST, "GunplaCard: not in whitelist phase");
        require(whitelistMintCap == 0 || whitelistMintCount[msg.sender] < whitelistMintCap, "GunplaCard: mint cap reached");
        require(tierPrice[tier] > 0, "GunplaCard: invalid tier");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, tier));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "GunplaCard: invalid proof");

        require(
            usdc.transferFrom(msg.sender, address(this), tierPrice[tier]),
            "GunplaCard: USDC transfer failed"
        );

        whitelistMintCount[msg.sender]++;

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
        _traits[tokenId] = traits;

        emit CardMinted(to, tokenId, traits.name, traits.rarity);
    }

    // ─── Cosmetics ──────────────────────────────────────────────────────────

    /**
     * @notice Apply a repaint color or decal to a card. Costs `cosmeticPriceUsdc`.
     *         Only the token owner may call this.
     */
    function updateCosmetics(
        uint256 tokenId,
        string calldata repaintColor,
        string calldata decalId
    ) external {
        require(ownerOf(tokenId) == msg.sender, "GunplaCard: not owner");
        require(
            usdc.transferFrom(msg.sender, address(this), cosmeticPriceUsdc),
            "GunplaCard: USDC transfer failed"
        );

        _traits[tokenId].repaintColor = repaintColor;
        _traits[tokenId].decalId = decalId;

        emit CosmeticsUpdated(tokenId, repaintColor, decalId);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getTraits(uint256 tokenId) external view returns (CardTraits memory) {
        require(_ownerOf(tokenId) != address(0), "GunplaCard: token does not exist");
        return _traits[tokenId];
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPriceUsdc = newPrice;
        emit MintPriceUpdated(newPrice);
    }

    function setCosmeticPrice(uint256 newPrice) external onlyOwner {
        cosmeticPriceUsdc = newPrice;
        emit CosmeticPriceUpdated(newPrice);
    }

    function setMintPhase(MintPhase phase_) external onlyOwner {
        mintPhase = phase_;
    }

    function setMerkleRoot(bytes32 root_) external onlyOwner {
        merkleRoot = root_;
    }

    function setTierPrice(uint8 tier_, uint256 price_) external onlyOwner {
        tierPrice[tier_] = price_;
    }

    function setWhitelistMintCap(uint256 cap_) external onlyOwner {
        whitelistMintCap = cap_;
    }

    function withdrawUsdc(uint256 amount) external onlyOwner {
        require(usdc.transfer(owner(), amount), "GunplaCard: withdraw failed");
    }

    // ─── UUPS ───────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ─── Overrides required by Solidity ─────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
