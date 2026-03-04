// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GundaniumGame} from "../src/GundaniumGame.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MockGNDM {
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

contract GundaniumGameTest is Test {
    GundaniumGame game;
    MockGNDM gndm;

    address owner    = address(0x1);
    address player1  = address(0x2);
    address player2  = address(0x3);

    uint256 resolverKey = 0xBEEF;
    address resolver;

    uint256 constant PVE_FEE   = 10 ether;
    uint256 constant PVP_STAKE = 10 ether;

    function setUp() public {
        resolver = vm.addr(resolverKey);
        gndm = new MockGNDM();

        GundaniumGame impl = new GundaniumGame();
        bytes memory init = abi.encodeCall(
            GundaniumGame.initialize,
            (owner, address(gndm), resolver, PVE_FEE, PVP_STAKE)
        );
        game = GundaniumGame(address(new ERC1967Proxy(address(impl), init)));

        gndm.mint(player1, 1000 ether);
        gndm.mint(player2, 1000 ether);
        gndm.mint(address(game), 500 ether); // seed arc rewards

        // Advance time so timestamp arithmetic doesn't underflow in tests
        vm.warp(1 hours);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _signBattleResult(
        uint256 sessionId,
        address winner,
        uint16 finalHp,
        uint256 timestamp
    ) internal view returns (bytes memory) {
        bytes32 domainSep = game.DOMAIN_SEPARATOR();
        bytes32 TYPEHASH = keccak256(
            "BattleResult(uint256 sessionId,address winner,uint16 finalHpWinner,uint256 timestamp)"
        );
        bytes32 structHash = keccak256(
            abi.encode(TYPEHASH, sessionId, winner, finalHp, timestamp)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(resolverKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ── Initialization ───────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(address(game.gndm()), address(gndm));
        assertEq(game.trustedResolver(), resolver);
        assertEq(game.pveEntryFee(), PVE_FEE);
        assertEq(game.pvpMinStake(), PVP_STAKE);
        assertEq(game.pvpFeePercent(), 10);
    }

    // ── PVE ──────────────────────────────────────────────────────────────────

    function test_StartPVE() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVE_FEE);
        uint256 sessionId = game.startPVE(1, 1);
        vm.stopPrank();

        assertEq(sessionId, 1);
        assertEq(gndm.balanceOf(address(game)), 500 ether + PVE_FEE);

        (address p1,,,,,GundaniumGame.BattleType btype, GundaniumGame.BattleStatus status,,,,) =
            game.sessions(sessionId);
        assertEq(p1, player1);
        assertEq(uint8(btype), uint8(GundaniumGame.BattleType.PVE));
        assertEq(uint8(status), uint8(GundaniumGame.BattleStatus.Active));
    }

    function test_StartPVE_RevertsOnInvalidArc() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVE_FEE);
        vm.expectRevert("GundaniumGame: invalid arc");
        game.startPVE(1, 0);
        vm.stopPrank();
    }

    function test_SettlePVE_AndClaimReward() public {
        // Set arc reward
        vm.prank(owner);
        game.setArcReward(1, 20 ether, false);

        // Start PVE
        vm.startPrank(player1);
        gndm.approve(address(game), PVE_FEE);
        uint256 sessionId = game.startPVE(1, 1);
        vm.stopPrank();

        // Settle with resolver signature
        uint256 ts = block.timestamp;
        bytes memory sig = _signBattleResult(sessionId, player1, 800, ts);
        game.settleBattle(sessionId, player1, 800, ts, sig);

        // Claim
        uint256 before = gndm.balanceOf(player1);
        vm.prank(player1);
        game.claimPVEReward(sessionId);

        // Should receive stake back + arc reward
        assertEq(gndm.balanceOf(player1), before + PVE_FEE + 20 ether);
        assertEq(game.pveCampaignProgress(player1), 1);
    }

    function test_ClaimPVEReward_RevertsIfNotWinner() public {
        vm.prank(owner);
        game.setArcReward(1, 0, false);

        vm.startPrank(player1);
        gndm.approve(address(game), PVE_FEE);
        uint256 sessionId = game.startPVE(1, 1);
        vm.stopPrank();

        uint256 ts = block.timestamp;
        bytes memory sig = _signBattleResult(sessionId, player1, 800, ts);
        game.settleBattle(sessionId, player1, 800, ts, sig);

        vm.prank(player2); // wrong player
        vm.expectRevert("GundaniumGame: not winner");
        game.claimPVEReward(sessionId);
    }

    // ── PVP ──────────────────────────────────────────────────────────────────

    function test_StartAndJoinPVP() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVP_STAKE);
        uint256 sessionId = game.startPVP(1, PVP_STAKE);
        vm.stopPrank();

        vm.startPrank(player2);
        gndm.approve(address(game), PVP_STAKE);
        game.joinPVP(sessionId, 2);
        vm.stopPrank();

        (,address p2,,,,,GundaniumGame.BattleStatus status,,,,) = game.sessions(sessionId);
        assertEq(p2, player2);
        assertEq(uint8(status), uint8(GundaniumGame.BattleStatus.Active));
    }

    function test_PVP_WinnerReceivesCorrectPayout() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVP_STAKE);
        uint256 sessionId = game.startPVP(1, PVP_STAKE);
        vm.stopPrank();

        vm.startPrank(player2);
        gndm.approve(address(game), PVP_STAKE);
        game.joinPVP(sessionId, 2);
        vm.stopPrank();

        uint256 p1Before = gndm.balanceOf(player1);

        uint256 ts = block.timestamp;
        bytes memory sig = _signBattleResult(sessionId, player1, 500, ts);
        game.settleBattle(sessionId, player1, 500, ts, sig);

        // Winner gets both stakes minus fee on one stake: 20 - (10 * 10%) = 19 GNDM
        uint256 expectedPayout = PVP_STAKE * 2 - (PVP_STAKE * game.pvpFeePercent() / 100);
        assertEq(gndm.balanceOf(player1), p1Before + expectedPayout);
    }

    function test_PVP_RevertsOnStakeTooLow() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVP_STAKE);
        vm.expectRevert("GundaniumGame: stake too low");
        game.startPVP(1, PVP_STAKE - 1);
        vm.stopPrank();
    }

    function test_PVP_RevertsOnJoinOwnSession() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVP_STAKE * 2);
        uint256 sessionId = game.startPVP(1, PVP_STAKE);
        vm.expectRevert("GundaniumGame: cannot join own session");
        game.joinPVP(sessionId, 2);
        vm.stopPrank();
    }

    // ── Settlement ───────────────────────────────────────────────────────────

    function test_SettleBattle_RevertsOnExpiredSignature() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVE_FEE);
        uint256 sessionId = game.startPVE(1, 1);
        vm.stopPrank();

        // Sign with a timestamp 10 minutes in the past
        uint256 staleTs = block.timestamp - 10 minutes;
        bytes memory sig = _signBattleResult(sessionId, player1, 800, staleTs);

        vm.expectRevert("GundaniumGame: result too old");
        game.settleBattle(sessionId, player1, 800, staleTs, sig);
    }

    function test_SettleBattle_RevertsOnFakeSignature() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVE_FEE);
        uint256 sessionId = game.startPVE(1, 1);
        vm.stopPrank();

        uint256 ts = block.timestamp;
        // Sign with a different key (not the resolver)
        uint256 fakeKey = 0xDEAD;
        bytes32 domainSep = game.DOMAIN_SEPARATOR();
        bytes32 TYPEHASH = keccak256(
            "BattleResult(uint256 sessionId,address winner,uint16 finalHpWinner,uint256 timestamp)"
        );
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, sessionId, player1, uint16(800), ts));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(fakeKey, digest);
        bytes memory fakeSig = abi.encodePacked(r, s, v);

        vm.expectRevert("GundaniumGame: invalid signature");
        game.settleBattle(sessionId, player1, 800, ts, fakeSig);
    }

    function test_SettleBattle_RevertsOnInvalidWinner() public {
        vm.startPrank(player1);
        gndm.approve(address(game), PVE_FEE);
        uint256 sessionId = game.startPVE(1, 1);
        vm.stopPrank();

        uint256 ts = block.timestamp;
        // Sign with player2 as winner (not a participant)
        bytes memory sig = _signBattleResult(sessionId, player2, 800, ts);

        vm.expectRevert("GundaniumGame: invalid winner");
        game.settleBattle(sessionId, player2, 800, ts, sig);
    }
}
