import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { simulateBattle } from "@/lib/battle/simulate";
import type { TraitSet } from "@/types/nft";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
const GAME_ADDRESS = process.env.NEXT_PUBLIC_GAME_ADDRESS as `0x${string}`;
const RESOLVER_KEY = process.env.BATTLE_RESOLVER_PRIVATE_KEY as `0x${string}`;

export async function POST(request: NextRequest) {
  try {
    const { sessionId, player1Address, player2Address, player1Traits, player2Traits } =
      await request.json() as {
        sessionId: number;
        player1Address: `0x${string}`;
        player2Address: `0x${string}`;
        player1Traits: TraitSet;
        player2Traits: TraitSet;
      };

    // Simulate: player1 is "player", player2 is "enemy"
    const result = simulateBattle(player1Traits, player2Traits, sessionId);

    const winner: "player1" | "player2" = result.winner === "player" ? "player1" : "player2";
    const winnerAddress: `0x${string}` =
      winner === "player1" ? player1Address : player2Address;

    const finalHpWinner = Math.min(result.finalHpWinner, 65535);
    const timestamp = Math.floor(Date.now() / 1000);

    const account = privateKeyToAccount(RESOLVER_KEY);
    const signature = await account.signTypedData({
      domain: {
        name: "GundariuM",
        version: "1",
        chainId: CHAIN_ID,
        verifyingContract: GAME_ADDRESS,
      },
      types: {
        BattleResult: [
          { name: "sessionId",     type: "uint256" },
          { name: "winner",        type: "address" },
          { name: "finalHpWinner", type: "uint16" },
          { name: "timestamp",     type: "uint256" },
        ],
      },
      primaryType: "BattleResult",
      message: {
        sessionId:     BigInt(sessionId),
        winner:        winnerAddress,
        finalHpWinner,
        timestamp:     BigInt(timestamp),
      },
    });

    return NextResponse.json({
      winner,
      winnerAddress,
      finalHpWinner,
      timestamp,
      signature,
      log: result.log,
      player1Name: player1Traits.name,
      player2Name: player2Traits.name,
    });
  } catch (err) {
    console.error("[battle/resolve-pvp]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resolve failed" },
      { status: 500 },
    );
  }
}
