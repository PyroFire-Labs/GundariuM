import type { BattleCard, WeaponSlot } from "../battle/deterministicSim";
import {
  battleWorkerConfigurationStatus,
  type BattleReceiptResult,
  type SubmitBattleReceiptOutcome,
} from "./warperKeeperClient.ts";

type Dependencies = {
  checkRateLimit: (key: string, limit: number, windowMs: number) => Promise<{ allowed: boolean; retryAfterMs: number }>;
  replayBattle: (seed: number, moves: WeaponSlot[], player: BattleCard, enemy: BattleCard) => BattleReceiptResult;
  computeProofHash: (input: unknown) => string;
  submitBattleReceipt: (payload: {
    battleId: string;
    result: BattleReceiptResult;
    proofHash: string;
    replayInputs: {
      seed: number;
      moves: string[];
      player: Record<string, unknown>;
      enemy: Record<string, unknown>;
    };
    chainId: number;
  }) => Promise<SubmitBattleReceiptOutcome>;
};

/** Injectable HTTP boundary; gameplay does not wait for federation telemetry. */
export async function handleBattleReceiptRequest(req: Request, dependencies: Dependencies): Promise<Response> {
  try {
    const body: unknown = await req.json().catch(() => undefined);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Invalid battle receipt payload" }, { status: 400 });
    }
    const { seed, moves, player, enemy } = body as {
      seed?: number;
      moves?: WeaponSlot[];
      player?: BattleCard;
      enemy?: BattleCard;
    };
    // Retain the route's existing shallow checks; combat validation is separate.
    if (typeof seed !== "number" || !Array.isArray(moves) || moves.length === 0 || !player || !enemy) {
      return Response.json({ error: "Invalid battle receipt payload" }, { status: 400 });
    }

    // Gate BEFORE invoking the network-backed limiter or the worker adapter.
    const configurationStatus = battleWorkerConfigurationStatus();
    if (configurationStatus) return Response.json({ submitted: false, deliveryStatus: configurationStatus });

    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed, retryAfterMs } = await dependencies.checkRateLimit(`federation:battle:${ip}`, 60, 60 * 60 * 1000);
    if (!allowed) {
      return Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }
    // Same simulator, replay inputs, proof hash, battle identity and chain as before.
    const result = dependencies.replayBattle(seed, moves, player, enemy);
    const replayInputs = {
      seed,
      moves: moves as string[],
      player: player as unknown as Record<string, unknown>,
      enemy: enemy as unknown as Record<string, unknown>,
    };
    const proofHash = dependencies.computeProofHash(replayInputs);
    const battleId = `${seed}-${player.name}-${enemy.name}`.replace(/\s+/g, "-").toLowerCase();
    const outcome = await dependencies.submitBattleReceipt({ battleId, result, proofHash, replayInputs, chainId: 84532 });
    return Response.json({ battleId, result, proofHash, ...outcome });
  } catch {
    // Preserve best-effort HTTP 200 behavior without logging provider/private data.
    return Response.json({ submitted: false, deliveryStatus: "build_failed", reason: "internal_error" });
  }
}
