/**
 * GundariuM Battle Trappers client — submits PvE battle results via
 * the gundarium-battle-trappers Cloudflare Worker's public MCP.
 *
 * The worker mirrors the dreamnet-trading-trappers pattern:
 * - Public, credential-free MCP at /mcp
 * - Tools: build_battle_trapper, validate_battle_trapper, to_warper_keeper_bundle
 * - Paper-only, no wallet authority, no auth required for Stage 0
 *
 * Flow per battle:
 *   1. Build battle trapper via build_battle_trapper (includes proofHash)
 *   2. Convert to warper-keeper-trapper/1 bundle via to_warper_keeper_bundle
 *   3. (Optional) Worker can forward to Warper Keeper gateway internally with assignment key
 *
 * If BATTLE_TRAPPERS_URL is not set, the federation is inert —
 * it logs and returns `{ submitted: false, reason: "not_configured" }`.
 * Federation is best-effort telemetry and must never block a player
 * finishing a battle.
 */

export interface BattleReceiptResult {
  winner: "player" | "enemy";
  turns: number;
  damageDealt: number;
}

export interface SubmitBattleReceiptOutcome {
  submitted: boolean;
  trapperId?: string;
  bundleId?: string;
  reason?: string;
}

const DEFAULT_WORKER_URL = "https://jerry.gundarium.xyz";

function idempotencyKey(): string {
  return `gundarium-battle-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function mcpCall(
  baseUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey(),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
      id: idempotencyKey(),
    }),
  });

  if (!response.ok) {
    return { ok: false, error: `http_${response.status}` };
  }

  const data = (await response.json()) as {
    jsonrpc: string;
    id: string;
    result?: {
      isError?: boolean;
      structuredContent?: { ok: boolean; [key: string]: unknown };
      content?: Array<{ type: string; text: string }>;
    };
    error?: { code: number; message: string };
  };

  if (data.error) {
    return { ok: false, error: data.error.message };
  }

  if (data.result?.isError) {
    const errorText = data.result.content?.[0]?.text ?? "unknown_error";
    return { ok: false, error: errorText };
  }

  return { ok: true, result: data.result?.structuredContent };
}

export async function submitBattleReceipt(payload: {
  battleId: string;
  result: BattleReceiptResult;
  proofHash: string;
  replayInputs: {
    seed: number;
    moves: string[];
    player: Record<string, unknown>;
    enemy: Record<string, unknown>;
  };
  chainId?: number;
}): Promise<SubmitBattleReceiptOutcome> {
  const baseUrl = process.env.BATTLE_TRAPPERS_URL || DEFAULT_WORKER_URL;
  const chainId = payload.chainId ?? 84532; // Base Sepolia default

  // Stage 0: Build the battle trapper via public MCP (no auth)
  const buildResult = await mcpCall(baseUrl, "build_battle_trapper", {
    draft: {
      battleId: payload.battleId,
      chainId,
      result: payload.result,
      proofHash: payload.proofHash,
      replayInputs: payload.replayInputs,
    },
  });

  if (!buildResult.ok) {
    console.error("Battle trapper build failed:", buildResult.error);
    return { submitted: false, reason: buildResult.error ?? "build_failed" };
  }

  const trapper = (buildResult.result as { ok: boolean; trapper: unknown })?.trapper;
  if (!trapper) {
    return { submitted: false, reason: "no_trapper_returned" };
  }

  const trapperId = (trapper as { id: string }).id;

  // Stage 1: Convert to Warper Keeper bundle (also public MCP, no auth)
  const bundleResult = await mcpCall(baseUrl, "to_warper_keeper_bundle", {
    trapper,
    keeperId: "gundarium",
  });

  if (!bundleResult.ok) {
    console.error("Warper Keeper bundle conversion failed:", bundleResult.error);
    // Still count the trapper as built — bundle conversion is optional
    return {
      submitted: true,
      trapperId,
      reason: `bundle_failed: ${bundleResult.error}`,
    };
  }

  const bundle = (bundleResult.result as { ok: boolean; bundle: unknown })?.bundle;
  const bundleId = (bundle as { receipt: { id: string } })?.receipt?.id;

  return {
    submitted: true,
    trapperId,
    bundleId,
  };
}