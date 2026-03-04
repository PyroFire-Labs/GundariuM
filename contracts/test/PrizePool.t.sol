// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PrizePool} from "../src/PrizePool.sol";

contract MockToken {
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

contract PrizePoolTest is Test {
    PrizePool pool;
    MockToken gndm;
    MockToken usdc;

    uint256 ownerKey = 0xABCD;
    address owner;
    address depositor = address(0x10);
    address winner1   = address(0x11);
    address winner2   = address(0x12);

    function setUp() public {
        owner = vm.addr(ownerKey);
        gndm  = new MockToken();
        usdc  = new MockToken();

        PrizePool impl = new PrizePool();
        bytes memory init = abi.encodeCall(
            PrizePool.initialize,
            (owner, address(gndm), address(usdc))
        );
        pool = PrizePool(address(new ERC1967Proxy(address(impl), init)));

        gndm.mint(depositor, 1_000 ether);
        usdc.mint(depositor, 1_000_000_000); // $1000 USDC

        // Advance past the initial cadence window so first distribute() isn't blocked
        vm.warp(2 days);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _signDistribution(
        uint8 poolType,
        address[] memory winners,
        uint256[] memory gndmShares,
        uint256[] memory usdcShares,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 domainSep = pool.DOMAIN_SEPARATOR();
        bytes32 TYPEHASH = keccak256(
            "Distribution(uint8 poolType,address[] winners,uint256[] gndmShares,uint256[] usdcShares,uint256 nonce)"
        );
        bytes32 structHash = keccak256(abi.encode(
            TYPEHASH,
            poolType,
            keccak256(abi.encode(winners)),
            keccak256(abi.encode(gndmShares)),
            keccak256(abi.encode(usdcShares)),
            nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ── Deposits ─────────────────────────────────────────────────────────────

    function test_DepositGndm() public {
        vm.startPrank(depositor);
        gndm.approve(address(pool), 100 ether);
        pool.depositGndm(0, 100 ether);
        vm.stopPrank();

        PrizePool.Pool memory p = pool.getPool(0);
        assertEq(p.gndmBalance, 100 ether);
    }

    function test_DepositUsdc() public {
        vm.startPrank(depositor);
        usdc.approve(address(pool), 100_000_000);
        pool.depositUsdc(1, 100_000_000);
        vm.stopPrank();

        PrizePool.Pool memory p = pool.getPool(1);
        assertEq(p.usdcBalance, 100_000_000);
    }

    function test_Deposit_RevertsOnInvalidPoolType() public {
        vm.startPrank(depositor);
        gndm.approve(address(pool), 100 ether);
        vm.expectRevert("PrizePool: invalid pool type");
        pool.depositGndm(3, 100 ether); // invalid type
        vm.stopPrank();
    }

    // ── Distribution ─────────────────────────────────────────────────────────

    function test_Distribute_Daily() public {
        // Deposit into daily pool
        vm.startPrank(depositor);
        gndm.approve(address(pool), 100 ether);
        pool.depositGndm(0, 100 ether);
        vm.stopPrank();

        address[] memory winners   = new address[](2);
        uint256[] memory gndmShares = new uint256[](2);
        uint256[] memory usdcShares = new uint256[](2);
        winners[0]    = winner1;
        winners[1]    = winner2;
        gndmShares[0] = 60 ether;
        gndmShares[1] = 40 ether;

        bytes memory sig = _signDistribution(0, winners, gndmShares, usdcShares, 0);
        pool.distribute(0, winners, gndmShares, usdcShares, sig);

        assertEq(gndm.balanceOf(winner1), 60 ether);
        assertEq(gndm.balanceOf(winner2), 40 ether);
        assertEq(pool.distributionNonce(), 1);
    }

    function test_Distribute_RevertsIfTooSoon() public {
        vm.startPrank(depositor);
        gndm.approve(address(pool), 200 ether);
        pool.depositGndm(0, 200 ether);
        vm.stopPrank();

        address[] memory winners    = new address[](1);
        uint256[] memory gndmShares = new uint256[](1);
        uint256[] memory usdcShares = new uint256[](1);
        winners[0]    = winner1;
        gndmShares[0] = 50 ether;

        // First distribution
        bytes memory sig = _signDistribution(0, winners, gndmShares, usdcShares, 0);
        pool.distribute(0, winners, gndmShares, usdcShares, sig);

        // Immediately try again — should fail
        gndmShares[0] = 50 ether;
        sig = _signDistribution(0, winners, gndmShares, usdcShares, 1);
        vm.expectRevert("PrizePool: too soon");
        pool.distribute(0, winners, gndmShares, usdcShares, sig);
    }

    function test_Distribute_SucceedsAfterCadence() public {
        vm.startPrank(depositor);
        gndm.approve(address(pool), 200 ether);
        pool.depositGndm(0, 200 ether);
        vm.stopPrank();

        address[] memory winners    = new address[](1);
        uint256[] memory gndmShares = new uint256[](1);
        uint256[] memory usdcShares = new uint256[](1);
        winners[0]    = winner1;
        gndmShares[0] = 50 ether;

        bytes memory sig = _signDistribution(0, winners, gndmShares, usdcShares, 0);
        pool.distribute(0, winners, gndmShares, usdcShares, sig);

        // Advance time by 1 day
        vm.warp(block.timestamp + 1 days + 1);

        gndmShares[0] = 50 ether;
        sig = _signDistribution(0, winners, gndmShares, usdcShares, 1);
        pool.distribute(0, winners, gndmShares, usdcShares, sig);

        assertEq(gndm.balanceOf(winner1), 100 ether);
    }

    function test_Distribute_RevertsOnInvalidSignature() public {
        vm.startPrank(depositor);
        gndm.approve(address(pool), 100 ether);
        pool.depositGndm(0, 100 ether);
        vm.stopPrank();

        address[] memory winners    = new address[](1);
        uint256[] memory gndmShares = new uint256[](1);
        uint256[] memory usdcShares = new uint256[](1);
        winners[0]    = winner1;
        gndmShares[0] = 50 ether;

        // Sign with wrong key
        uint256 fakeKey = 0xDEAD;
        bytes32 domainSep = pool.DOMAIN_SEPARATOR();
        bytes32 TYPEHASH = keccak256(
            "Distribution(uint8 poolType,address[] winners,uint256[] gndmShares,uint256[] usdcShares,uint256 nonce)"
        );
        bytes32 structHash = keccak256(abi.encode(
            TYPEHASH, uint8(0),
            keccak256(abi.encode(winners)),
            keccak256(abi.encode(gndmShares)),
            keccak256(abi.encode(usdcShares)),
            uint256(0)
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(fakeKey, digest);
        bytes memory fakeSig = abi.encodePacked(r, s, v);

        vm.expectRevert("PrizePool: invalid signature");
        pool.distribute(0, winners, gndmShares, usdcShares, fakeSig);
    }

    function test_Distribute_RevertsOnInsufficientBalance() public {
        // Pool is empty — don't deposit
        address[] memory winners    = new address[](1);
        uint256[] memory gndmShares = new uint256[](1);
        uint256[] memory usdcShares = new uint256[](1);
        winners[0]    = winner1;
        gndmShares[0] = 50 ether; // more than pool balance

        bytes memory sig = _signDistribution(0, winners, gndmShares, usdcShares, 0);
        vm.expectRevert("PrizePool: insufficient GNDM");
        pool.distribute(0, winners, gndmShares, usdcShares, sig);
    }

    function test_Distribute_NoncePreventReplay() public {
        vm.startPrank(depositor);
        gndm.approve(address(pool), 200 ether);
        pool.depositGndm(0, 200 ether);
        vm.stopPrank();

        address[] memory winners    = new address[](1);
        uint256[] memory gndmShares = new uint256[](1);
        uint256[] memory usdcShares = new uint256[](1);
        winners[0]    = winner1;
        gndmShares[0] = 50 ether;

        // Valid sig for nonce 0
        bytes memory sig = _signDistribution(0, winners, gndmShares, usdcShares, 0);
        pool.distribute(0, winners, gndmShares, usdcShares, sig);

        // Advance time, try to replay same sig (nonce is now 1, sig was for 0)
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert("PrizePool: invalid signature");
        pool.distribute(0, winners, gndmShares, usdcShares, sig);
    }

    // ── Emergency Withdraw ───────────────────────────────────────────────────

    function test_EmergencyWithdraw() public {
        vm.startPrank(depositor);
        gndm.approve(address(pool), 100 ether);
        pool.depositGndm(0, 100 ether);
        vm.stopPrank();

        uint256 before = gndm.balanceOf(owner);
        vm.prank(owner);
        pool.emergencyWithdraw(address(gndm), 100 ether);
        assertEq(gndm.balanceOf(owner), before + 100 ether);
    }

    function test_EmergencyWithdraw_RevertsIfNotOwner() public {
        vm.prank(depositor);
        vm.expectRevert();
        pool.emergencyWithdraw(address(gndm), 1 ether);
    }
}
