// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GunplaCard} from "../src/GunplaCard.sol";
import {GundaniumGame} from "../src/GundaniumGame.sol";
import {PrizePool} from "../src/PrizePool.sol";
import {MockERC20} from "../src/MockERC20.sol";

/**
 * @notice Deploys GunplaCard, GundaniumGame, and PrizePool as UUPS proxies.
 *         On testnets (GNDM_ADDRESS unset), also deploys a MockERC20 for $GNDM.
 *
 * Key injection (two options — pick one):
 *   A) cast wallet keystore (recommended):
 *        cast wallet import deployer --interactive
 *        forge script ... --account deployer
 *      (no DEPLOYER_PRIVATE_KEY needed in .env)
 *
 *   B) env var fallback:
 *        DEPLOYER_PRIVATE_KEY=0x... forge script ...
 *      (key read from env at runtime, never stored in .env)
 *
 * Required env vars:
 *   USDC_ADDRESS              — USDC on the target chain
 *   BATTLE_RESOLVER_ADDRESS   — trusted off-chain resolver EOA
 *
 * Optional env vars:
 *   GNDM_ADDRESS              — $GNDM token address (if unset, MockERC20 is deployed)
 *
 * Usage (Base Sepolia):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --account deployer \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract Deploy is Script {
    // Mint price: $2 USDC (6 decimals)
    uint256 constant MINT_PRICE_USDC     = 2_000_000;
    // Cosmetics price: $1 USDC
    uint256 constant COSMETIC_PRICE_USDC = 1_000_000;
    // PVE entry fee: 10 GNDM (18 decimals)
    uint256 constant PVE_ENTRY_FEE       = 10 ether;
    // PVP minimum stake: 10 GNDM
    uint256 constant PVP_MIN_STAKE       = 10 ether;
    // Initial mock GNDM supply: 1,000,000 tokens
    uint256 constant MOCK_GNDM_SUPPLY    = 1_000_000 ether;

    function run() external {
        // Key injection: prefer --account keystore; fall back to DEPLOYER_PRIVATE_KEY env var.
        uint256 deployerKey    = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address usdc           = vm.envAddress("USDC_ADDRESS");
        address battleResolver = vm.envAddress("BATTLE_RESOLVER_ADDRESS");

        // If GNDM_ADDRESS is not set, deploy a MockERC20 for testnet use.
        address gndm;
        bool deployMock;
        try vm.envAddress("GNDM_ADDRESS") returns (address addr) {
            gndm = addr;
            deployMock = false;
        } catch {
            deployMock = true;
        }

        // Start broadcast: with key (env var) or without (--account keystore).
        address deployer;
        if (deployerKey != 0) {
            deployer = vm.addr(deployerKey);
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast();
            deployer = msg.sender; // populated by --account flag
        }

        console.log("=== GundariuM Deploy ===");
        console.log("Deployer:         ", deployer);
        console.log("USDC:             ", usdc);
        console.log("Battle resolver:  ", battleResolver);
        console.log("Chain ID:         ", block.chainid);
        if (deployMock) {
            console.log("GNDM:              (deploying MockERC20)");
        } else {
            console.log("GNDM:             ", gndm);
        }

        // ── 0. MockERC20 (testnet only) ──────────────────────────────────────
        if (deployMock) {
            MockERC20 mockGndm = new MockERC20(
                "GundariuM",
                "GNDM",
                MOCK_GNDM_SUPPLY,
                deployer
            );
            gndm = address(mockGndm);
            console.log("MockGNDM deployed:", gndm);
        }

        // ── 1. GunplaCard ────────────────────────────────────────────────────
        GunplaCard cardImpl = new GunplaCard();
        bytes memory cardInit = abi.encodeCall(
            GunplaCard.initialize,
            (deployer, usdc, MINT_PRICE_USDC, COSMETIC_PRICE_USDC)
        );
        ERC1967Proxy cardProxy = new ERC1967Proxy(address(cardImpl), cardInit);
        address cardAddress = address(cardProxy);
        GunplaCard card = GunplaCard(cardAddress);
        console.log("GunplaCard proxy: ", cardAddress);

        // ─── Whitelist Configuration ───────────────────────────────
        card.setTierPrice(1, 1_000_000);    // VIP: $1
        card.setTierPrice(2, 1_500_000);    // WL: $1.50
        card.setWhitelistMintCap(5);
        // Merkle root set separately after tree generation
        // Phase starts as PAUSED (default 0)

        // ── 2. GundaniumGame ─────────────────────────────────────────────────
        GundaniumGame gameImpl = new GundaniumGame();
        bytes memory gameInit = abi.encodeCall(
            GundaniumGame.initialize,
            (deployer, gndm, battleResolver, PVE_ENTRY_FEE, PVP_MIN_STAKE)
        );
        ERC1967Proxy gameProxy = new ERC1967Proxy(address(gameImpl), gameInit);
        address gameAddress = address(gameProxy);
        console.log("GundaniumGame proxy:", gameAddress);

        // ── 3. PrizePool ─────────────────────────────────────────────────────
        PrizePool poolImpl = new PrizePool();
        bytes memory poolInit = abi.encodeCall(
            PrizePool.initialize,
            (deployer, gndm, usdc)
        );
        ERC1967Proxy poolProxy = new ERC1967Proxy(address(poolImpl), poolInit);
        address poolAddress = address(poolProxy);
        console.log("PrizePool proxy:  ", poolAddress);

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("\n=== Deployment complete ===");
        console.log("Copy these into .env.local and src/lib/contracts/addresses.ts:");
        if (deployMock) {
            console.log("  NEXT_PUBLIC_GNDM_ADDRESS:         ", gndm);
        }
        console.log("  NEXT_PUBLIC_GUNPLA_CARD_ADDRESS:  ", cardAddress);
        console.log("  NEXT_PUBLIC_GAME_ADDRESS:         ", gameAddress);
        console.log("  NEXT_PUBLIC_PRIZE_POOL_ADDRESS:   ", poolAddress);
    }
}
