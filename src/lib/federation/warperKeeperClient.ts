/**
 * Best-effort, credential-free battle artifact construction over the public worker
 * MCP. A validated portable bundle is not a durable submission or readback.
 * No configured worker means no request. Each of the two calls is bounded to 2s.
 */
import {
  BATTLE_TRAPPER_VERSION,
  WARPER_KEEPER_VERSION,
  sha256,
  validateBattleTrapper,
  type BattleTrapper,
  type WarperKeeperBundle,
} from "../../../worker-battle-trappers/src/contract.ts";

export interface BattleReceiptResult {
  winner: "player" | "enemy";
  turns: number;
  damageDealt: number;
}

type FailureReason =
  | "worker_http_error"
  | "worker_network_error"
  | "worker_rejected"
  | "worker_timeout"
  | "invalid_worker_response"
  | "invalid_trapper"
  | "invalid_bundle";

export type SubmitBattleReceiptOutcome = { submitted: false } & (
  | { deliveryStatus: "not_configured" | "invalid_configuration" }
  | { deliveryStatus: "build_failed"; reason: FailureReason }
  | { deliveryStatus: "trapper_built"; trapperId: string; reason: FailureReason }
  | { deliveryStatus: "bundle_exported"; trapperId: string; bundleId: string }
);

type Payload = {
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
};
type Configuration = { ok: true; baseUrl: string } | { ok: false; deliveryStatus: "not_configured" | "invalid_configuration" };
type CallResult = { ok: true; result: Record<string, unknown> } | { ok: false; reason: FailureReason };
const REQUEST_TIMEOUT_MS = 2000;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function timestamp(value: unknown): boolean {
  return text(value) && Number.isFinite(Date.parse(value));
}
function hash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function positiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) > 0;
}
function configuredWorker(): Configuration {
  const value = process.env.BATTLE_TRAPPERS_URL?.trim();
  if (!value) return { ok: false, deliveryStatus: "not_configured" };
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      return { ok: false, deliveryStatus: "invalid_configuration" };
    }
    return { ok: true, baseUrl: url.toString().replace(/\/+$/, "") };
  } catch {
    return { ok: false, deliveryStatus: "invalid_configuration" };
  }
}
/** Lets the route gate before invoking its network-backed rate limiter. */
export function battleWorkerConfigurationStatus(): "not_configured" | "invalid_configuration" | null {
  const configuration = configuredWorker();
  return configuration.ok ? null : configuration.deliveryStatus;
}

async function mcpCall(baseUrl: string, tool: string, args: Record<string, unknown>): Promise<CallResult> {
  const controller = new AbortController();
  const id = `gundarium-battle-${crypto.randomUUID()}`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<CallResult>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, reason: "worker_timeout" });
    }, REQUEST_TIMEOUT_MS);
  });
  const request = async (): Promise<CallResult> => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
      // The stateless worker does not promise durable duplicate suppression.
      headers: { "Content-Type": "application/json", "Idempotency-Key": id },
      body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name: tool, arguments: args } }),
    });
    if (!response.ok) return { ok: false, reason: "worker_http_error" };
    let data: unknown;
    try { data = await response.json(); }
    catch { return { ok: false, reason: "invalid_worker_response" }; }
    if (!record(data) || data.jsonrpc !== "2.0" || data.id !== id) return { ok: false, reason: "invalid_worker_response" };
    if (Object.hasOwn(data, "error")) return { ok: false, reason: "worker_rejected" };
    if (!record(data.result)) return { ok: false, reason: "invalid_worker_response" };
    if (data.result.isError === true) return { ok: false, reason: "worker_rejected" };
    if (data.result.isError !== false || !record(data.result.structuredContent)) return { ok: false, reason: "invalid_worker_response" };
    if (data.result.structuredContent.ok !== true) return { ok: false, reason: "worker_rejected" };
    return { ok: true, result: data.result.structuredContent };
  };
  try {
    // Also bounds a response body or fetch implementation that ignores abort.
    return await Promise.race([request(), deadline]);
  } catch {
    return { ok: false, reason: controller.signal.aborted ? "worker_timeout" : "worker_network_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function validatedTrapper(value: unknown, payload: Payload): Promise<BattleTrapper | null> {
  try {
    if (!(await validateBattleTrapper(value)).valid) return null;
    const t = value as BattleTrapper;
    if (
      t.id !== `gundarium-battle:${payload.chainId ?? 84532}:${payload.battleId}` ||
      !timestamp(t.createdAt) || !timestamp(t.updatedAt) ||
      t.battle.battleId !== payload.battleId || t.battle.chainId !== (payload.chainId ?? 84532) ||
      t.battle.proofHash !== payload.proofHash || !/^sha256:[a-f0-9]{64}$/.test(t.battle.proofHash) ||
      t.battle.result.winner !== payload.result.winner || t.battle.result.turns !== payload.result.turns ||
      t.battle.result.damageDealt !== payload.result.damageDealt ||
      !Number.isFinite(t.battle.result.turns) || !Number.isFinite(t.battle.result.damageDealt) ||
      t.policy.humanApprovalRequired !== false
    ) return null;
    return t;
  } catch { return null; }
}

async function validatedBundle(value: unknown, trapper: BattleTrapper): Promise<WarperKeeperBundle | null> {
  if (!record(value) || !record(value.trapper) || !record(value.receipt) || !record(value.receipt.payload) || !record(value.permissions)) return null;
  const { receipt, permissions } = value;
  const payload = receipt.payload as Record<string, unknown>;
  // The receipt hash covers its payload, not sources. Bind the converter's
  // sole battle source separately to the already validated trapper; accepting
  // additional fields or sources could introduce conflicting battle evidence.
  const source = Array.isArray(value.sources) && value.sources.length === 1 ? value.sources[0] : null;
  const result = trapper.battle.result;
  const expectedSummary = `${result.winner} won in ${result.turns} turns (${result.damageDealt} damage dealt). Deterministic proof: ${trapper.battle.proofHash}`;
  if (
    !record(source) || Object.keys(source).length !== 6 ||
    source.id !== `source:battle-result:${trapper.id}` || source.keeperId !== "gundarium" ||
    source.kind !== "note" || source.title !== "Battle Result" ||
    source.summary !== expectedSummary || source.createdAt !== trapper.createdAt
  ) return null;
  if (
    value.contractVersion !== WARPER_KEEPER_VERSION || value.schemaVersion !== 1 || value.privacyClassification !== "public" ||
    !timestamp(value.exportedAt) || value.trapper.id !== trapper.id || value.trapper.title !== trapper.title ||
    !text(value.trapper.objective) || value.trapper.riskLevel !== "low" || value.trapper.status !== "closed" ||
    value.trapper.createdAt !== trapper.createdAt || value.trapper.closedAt !== trapper.updatedAt ||
    !text(receipt.id) || !hash(receipt.hash) || receipt.id !== `receipt:${receipt.hash.slice(0, 24)}` ||
    receipt.trapperId !== trapper.id || !timestamp(receipt.createdAt) ||
    payload.contractVersion !== BATTLE_TRAPPER_VERSION || payload.battleTrapperId !== trapper.id ||
    payload.battleTrapperHash !== trapper.receipt.hash || payload.mode !== "paper" || payload.executionAuthority !== "none" ||
    !timestamp(payload.transformedAt) ||
    !Array.isArray(value.capabilities) || value.capabilities.length !== 2 ||
    !value.capabilities.includes("data:analyze") || !value.capabilities.includes("proof:generate") ||
    !positiveInteger(permissions.maxContextItems) || !positiveInteger(permissions.maxSourceBytes) ||
    !positiveInteger(permissions.maxExecutionSeconds) || !Array.isArray(permissions.allowedDomains) || permissions.allowedDomains.length !== 0
  ) return null;
  try {
    if (await sha256(payload) !== receipt.hash) return null;
    return value as unknown as WarperKeeperBundle;
  } catch { return null; }
}

export async function submitBattleReceipt(payload: Payload): Promise<SubmitBattleReceiptOutcome> {
  const configuration = configuredWorker();
  if (!configuration.ok) return { submitted: false, deliveryStatus: configuration.deliveryStatus };
  const build = await mcpCall(configuration.baseUrl, "build_battle_trapper", { draft: { ...payload, chainId: payload.chainId ?? 84532 } });
  if (!build.ok) return { submitted: false, deliveryStatus: "build_failed", reason: build.reason };
  const trapper = await validatedTrapper(build.result.trapper, payload);
  if (!trapper) return { submitted: false, deliveryStatus: "build_failed", reason: "invalid_trapper" };
  const conversion = await mcpCall(configuration.baseUrl, "to_warper_keeper_bundle", { trapper, keeperId: "gundarium" });
  if (!conversion.ok) return { submitted: false, deliveryStatus: "trapper_built", trapperId: trapper.id, reason: conversion.reason };
  const bundle = await validatedBundle(conversion.result.bundle, trapper);
  if (!bundle) return { submitted: false, deliveryStatus: "trapper_built", trapperId: trapper.id, reason: "invalid_bundle" };
  return { submitted: false, deliveryStatus: "bundle_exported", trapperId: trapper.id, bundleId: bundle.receipt.id };
}
