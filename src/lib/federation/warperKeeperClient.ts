/**
 * Warper Keeper client — submits GundariuM PvE battle results to DreamNet
 * via the real, live Warper Keeper Agent Gateway.
 *
 * Confirmed by calling the gateway directly (2026-08-07), not assumed:
 *   - transport is MCP JSON-RPC at POST /mcp, not a bespoke REST path
 *   - there is no "submit-battle-receipt" tool — the real tool list is
 *     get_assignment, open_trapper, append_context, submit_artifact,
 *     request_approval, close_trapper, release_assignment, verify_proof
 *   - auth is a per-assignment key (a live unauthenticated call returns
 *     {"error":"assignment_key_required","status":401}), not a generic
 *     bearer token — must come from ghostmintops as the gateway operator,
 *     scoped to a GundariuM assignment
 *   - default host: https://warper-keeper-agent-gateway-production.up.railway.app
 *     (public, live — overridable via WARPER_KEEPER_URL for a different
 *     environment, e.g. the NUC deployment)
 *
 * Server-side only — WARPER_KEEPER_ASSIGNMENT_KEY from env, not provisioned
 * yet as of 2026-08-07. Missing config is expected right now, not an error;
 * this module fails open (logs, returns unsubmitted) rather than throwing,
 * since federation is best-effort telemetry and must never block a player
 * finishing a battle.
 *
 * See docs/superpowers/plans/2026-08-07-dreamnet-stage0-federation-spike.md
 * and docs/superpowers/plans/2026-08-07-brandonducar-ecosystem-breakdown.md
 * for the full trail.
 */

export interface BattleReceiptResult {
  winner: "player" | "enemy";
  turns: number;
  damageDealt: number;
}

export interface SubmitBattleReceiptOutcome {
  submitted: boolean;
  receiptId?: string;
  reason?: string;
}

const DEFAULT_GATEWAY_URL = "https://warper-keeper-agent-gateway-production.up.railway.app";
const MCP_PATH = "/mcp";
const TOOL_NAME = "submit_artifact";

interface McpToolCallResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    isError?: boolean;
    structuredContent?: { ok?: boolean; error?: string; receiptId?: string; [key: string]: unknown };
  };
  error?: { message?: string };
}

export async function submitBattleReceipt(payload: {
  battleId: string;
  result: BattleReceiptResult;
  proofHash: string;
}): Promise<SubmitBattleReceiptOutcome> {
  const assignmentKey = process.env.WARPER_KEEPER_ASSIGNMENT_KEY;

  if (!assignmentKey) {
    console.error(
      "WARPER_KEEPER_ASSIGNMENT_KEY not configured — battle receipt not submitted to DreamNet " +
        "(expected until GundariuM has a real assignment from the Warper Keeper operator, see the federation spike doc)"
    );
    return { submitted: false, reason: "not_configured" };
  }

  const baseUrl = process.env.WARPER_KEEPER_URL || DEFAULT_GATEWAY_URL;

  try {
    const res = await fetch(`${baseUrl}${MCP_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${assignmentKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: TOOL_NAME,
          arguments: {
            payload: {
              type: "gundarium.battle.result",
              battleId: payload.battleId,
              result: payload.result,
              deterministic: true,
              proofHash: payload.proofHash,
            },
            idempotencyKey: `gundarium-battle-${payload.battleId}`,
            correlationId: payload.battleId,
          },
        },
      }),
    });

    if (!res.ok) {
      console.error(`submit_artifact HTTP failure: ${res.status} ${res.statusText}`);
      return { submitted: false, reason: `http_${res.status}` };
    }

    const data = (await res.json()) as McpToolCallResponse;
    if (data.error || data.result?.isError) {
      const reason = data.error?.message ?? data.result?.structuredContent?.error ?? "tool_error";
      console.error(`submit_artifact rejected: ${reason}`);
      return { submitted: false, reason };
    }

    return { submitted: true, receiptId: data.result?.structuredContent?.receiptId };
  } catch (err) {
    console.error("submit_artifact request failed:", err);
    return { submitted: false, reason: "network_error" };
  }
}
