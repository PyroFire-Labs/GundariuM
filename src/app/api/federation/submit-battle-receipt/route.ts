import { NextResponse } from "next/server";
import { replayBattle, type BattleCard, type WeaponSlot } from "@/lib/battle/deterministicSim";
import { computeProofHash } from "@/lib/federation/proofHash";
import { submitBattleReceipt } from "@/lib/federation/warperKeeperClient";
import { checkRateLimit } from "@/lib/rateLimit";

export const maxDuration = 10;

/**
 * Takes a completed Arena battle's replay inputs from the client and
 * forwards it to DreamNet as a Stage 0 `gundarium:battle:submit-readonly`
 * receipt. Deliberately does NOT take `result` from the client — the result
 * is always recomputed here via `replayBattle(seed, moves, player, enemy)`,
 * the same deterministic simulation the live Arena uses. A client can't use
 * this route to assert a fake "deterministic: true"; the server derives the
 * outcome itself from inputs it can independently verify are self-consistent.
 *
 * Best-effort by design — this is federation telemetry, not gameplay. A
 * missing Warper Keeper host/token, a DreamNet rejection, or any other
 * failure here should never surface as an error to the player; the arena
 * page fires this and ignores the response entirely.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { seed, moves, player, enemy } = body as {
      seed?: number;
      moves?: WeaponSlot[];
      player?: BattleCard;
      enemy?: BattleCard;
    };

    if (
      typeof seed !== "number" ||
      !Array.isArray(moves) ||
      moves.length === 0 ||
      !player ||
      !enemy
    ) {
      return NextResponse.json({ error: "Invalid battle receipt payload" }, { status: 400 });
    }

    // Best-effort telemetry, not a paid/scarce resource — generous ceiling
    // just to bound worst-case volume from a single source, same shape as
    // generate-kitbash's rate limiting.
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed, retryAfterMs } = await checkRateLimit(`federation:battle:${ip}`, 60, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const result = replayBattle(seed, moves, player, enemy);

    const replayInputs = { seed, moves, player, enemy };
    const proofHash = computeProofHash(replayInputs);
    const battleId = `${seed}-${player.name}-${enemy.name}`.replace(/\s+/g, "-").toLowerCase();

    const outcome = await submitBattleReceipt({ battleId, result, proofHash });

    return NextResponse.json({ battleId, result, proofHash, ...outcome });
  } catch (error) {
    console.error("submit-battle-receipt route failed:", error);
    // Still 200s — the arena page ignores this response either way, and a
    // 500 here would just be a log-noise difference, not a behavior one.
    return NextResponse.json({ submitted: false, reason: "internal_error" });
  }
}
