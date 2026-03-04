import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { simulateBattle } from "@/lib/battle/simulate";
import { getArc } from "@/lib/battle/arcs";
import type { TraitSet } from "@/types/nft";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
const GAME_ADDRESS = process.env.NEXT_PUBLIC_GAME_ADDRESS as `0x${string}`;
const RESOLVER_KEY = process.env.BATTLE_RESOLVER_PRIVATE_KEY as `0x${string}`;

export async function POST(request: NextRequest) {
  try {
    const { sessionId, arcId, playerAddress, playerTraits } = await request.json() as {
      sessionId: number;
      arcId: number;
      playerAddress: `0x${string}`;
      playerTraits: TraitSet;
    };

    const arc = getArc(arcId);
    if (!arc) {
      return NextResponse.json({ error: "Unknown arc" }, { status: 400 });
    }

    // Simulate the battle
    const result = simulateBattle(playerTraits, arc.enemy, sessionId);

    const winner: `0x${string}` =
      result.winner === "player"
        ? playerAddress
        : "0x0000000000000000000000000000000000000001"; // sentinel for enemy win — server won't sign player losing, player just can't claim

    const finalHpWinner = Math.min(result.finalHpWinner, 65535); // fits uint16
    const timestamp = Math.floor(Date.now() / 1000);

    // EIP-712 sign the battle result
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
          { name: "sessionId", type: "uint256" },
          { name: "winner",    type: "address" },
          { name: "finalHpWinner", type: "uint16" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      primaryType: "BattleResult",
      message: {
        sessionId: BigInt(sessionId),
        winner,
        finalHpWinner,
        timestamp: BigInt(timestamp),
      },
    });

    return NextResponse.json({
      winner: result.winner,          // "player" | "enemy"
      winnerAddress: winner,
      finalHpWinner,
      timestamp,
      signature,
      log: result.log,
      enemyName: arc.enemy.name,
      enemyFaction: arc.enemy.faction,
    });
  } catch (err) {
    console.error("[battle/resolve]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resolve failed" },
      { status: 500 }
    );
  }
}
