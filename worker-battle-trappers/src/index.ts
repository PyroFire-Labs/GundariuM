import {
  buildBattleTrapper,
  toWarperKeeperBundle,
  validateBattleTrapper,
} from "./contract";
import { battleTrapperSchema } from "./schema";
import {
  BATTLE_TRAPPER_VERSION,
  type BattleTrapper,
  type BattleTrapperDraft,
} from "./types";

const SERVICE_VERSION = "0.1.0";
const MAX_BODY_BYTES = 64 * 1024;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, X-Request-Id",
  "access-control-max-age": "86400",
};

const securityHeaders = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

const toolDefinitions = [
  {
    name: "get_battle_trapper_contract",
    description:
      "Return the public paper-only Battle Trapper schema and integration boundaries.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "build_battle_trapper",
    description:
      "Build and hash a paper-only Battle Trapper from a deterministic PvE battle result.",
    inputSchema: {
      type: "object",
      required: ["draft"],
      properties: { draft: { type: "object" } },
      additionalProperties: false,
    },
  },
  {
    name: "validate_battle_trapper",
    description:
      "Validate structure, receipt integrity, and the no-execution-authority policy.",
    inputSchema: {
      type: "object",
      required: ["trapper"],
      properties: { trapper: { type: "object" } },
      additionalProperties: false,
    },
  },
  {
    name: "to_warper_keeper_bundle",
    description:
      "Convert a valid Battle Trapper into a portable warper-keeper-trapper/1 bundle.",
    inputSchema: {
      type: "object",
      required: ["trapper"],
      properties: {
        trapper: { type: "object" },
        keeperId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
] as const;

function integrationBoundary() {
  return {
    mode: "PAPER_ONLY",
    liveTrading: false,
    walletAuthority: false,
    brokerCredentialsAccepted: false,
    marketDataRedistribution: false,
    externalUrlsFetched: false,
    humanApprovalRequired: false,
    complements: {
      gundariumArena: "https://gundarium.xyz/arena",
      gundariumApi: "https://gundarium.xyz/api",
      warperKeeper: "https://warper-keeper.dreamnet.ink",
      warperKeeperAgentCard:
        "https://warper-keeper-agent-gateway-production.up.railway.app/.well-known/agent.json",
    },
  };
}

function json(payload: unknown, status = 200, requestId?: string): Response {
  return Response.json(payload, {
    status,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error("request body exceeds 64 KiB");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error("request body exceeds 64 KiB");
  }
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function buildFromBody(body: Record<string, unknown>) {
  const draft = (body.draft ?? body) as BattleTrapperDraft;
  const trapper = await buildBattleTrapper(draft);
  const validation = await validateBattleTrapper(trapper);
  if (!validation.valid) {
    return { status: 400, payload: { ok: false, ...validation } };
  }
  return { status: 201, payload: { ok: true, trapper } };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (name === "get_battle_trapper_contract") {
    return {
      ok: true,
      contractVersion: BATTLE_TRAPPER_VERSION,
      schema: battleTrapperSchema,
      boundary: integrationBoundary(),
    };
  }
  if (name === "build_battle_trapper") {
    const result = await buildFromBody(args);
    if (result.status >= 400) throw new Error(JSON.stringify(result.payload));
    return result.payload;
  }
  if (name === "validate_battle_trapper") {
    return {
      ok: true,
      validation: await validateBattleTrapper(args.trapper),
    };
  }
  if (name === "to_warper_keeper_bundle") {
    return {
      ok: true,
      bundle: await toWarperKeeperBundle(
        args.trapper as BattleTrapper,
        typeof args.keeperId === "string" ? args.keeperId : undefined,
      ),
    };
  }
  throw new Error("unknown_tool");
}

async function handleMcp(body: Record<string, unknown>) {
  const id = body.id ?? null;
  if (body.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: {
          name: "gundarium-battle-trappers",
          version: SERVICE_VERSION,
        },
        capabilities: { tools: {} },
      },
    };
  }
  if (body.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: toolDefinitions } };
  }
  if (body.method !== "tools/call") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" },
    };
  }

  const params =
    body.params && typeof body.params === "object"
      ? (body.params as Record<string, unknown>)
      : {};
  const name = String(params.name ?? "");
  const args =
    params.arguments && typeof params.arguments === "object"
      ? (params.arguments as Record<string, unknown>)
      : {};
  try {
    const result = await executeTool(name, args);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        isError: true,
        content: [{ type: "text", text: message }],
        structuredContent: { ok: false, error: message },
      },
    };
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders });

    try {
      if (
        request.method === "GET" &&
        ["/", "/live", "/health", "/healthz"].includes(url.pathname)
      ) {
        return json(
          {
            ok: true,
            service: "gundarium-battle-trappers",
            version: SERVICE_VERSION,
            contractVersion: BATTLE_TRAPPER_VERSION,
            boundary: integrationBoundary(),
          },
          200,
          requestId,
        );
      }
      if (request.method === "GET" && url.pathname === "/ready") {
        return json(
          {
            ok: true,
            service: "gundarium-battle-trappers",
            ready: true,
            boundary: integrationBoundary(),
          },
          200,
          requestId,
        );
      }
      if (
        request.method === "GET" &&
        url.pathname === "/.well-known/agent.json"
      ) {
        return json(
          {
            name: "GundariuM Battle Trappers",
            version: SERVICE_VERSION,
            contractVersion: BATTLE_TRAPPER_VERSION,
            transports: { http: "/v1", mcp: "/mcp" },
            authentication: "none for stateless paper-only tools",
            tools: toolDefinitions,
            boundary: integrationBoundary(),
          },
          200,
          requestId,
        );
      }
      if (
        request.method === "GET" &&
        ["/schema/battle-trapper-v1.json", "/v1/schema"].includes(url.pathname)
      ) {
        return json(battleTrapperSchema, 200, requestId);
      }
      if (request.method === "POST" && url.pathname === "/v1/trappers/build") {
        const result = await buildFromBody(await readBody(request));
        return json(result.payload, result.status, requestId);
      }
      if (
        request.method === "POST" &&
        url.pathname === "/v1/trappers/validate"
      ) {
        const body = await readBody(request);
        const validation = await validateBattleTrapper(body.trapper ?? body);
        return json(
          { ok: validation.valid, validation },
          validation.valid ? 200 : 400,
          requestId,
        );
      }
      if (
        request.method === "POST" &&
        url.pathname === "/v1/trappers/to-warper"
      ) {
        const body = await readBody(request);
        const bundle = await toWarperKeeperBundle(
          (body.trapper ?? body) as BattleTrapper,
          typeof body.keeperId === "string" ? body.keeperId : undefined,
        );
        return json({ ok: true, bundle }, 200, requestId);
      }
      if (request.method === "POST" && url.pathname === "/mcp") {
        return json(await handleMcp(await readBody(request)), 200, requestId);
      }
      return json({ ok: false, error: "not_found" }, 404, requestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const clientError =
        /invalid|must|required|exceeds|unknown_tool|JSON|paper-only/i.test(
          message,
        );
      return json(
        {
          ok: false,
          error: clientError ? message : "internal_error",
        },
        clientError ? 400 : 500,
        requestId,
      );
    }
  },
};