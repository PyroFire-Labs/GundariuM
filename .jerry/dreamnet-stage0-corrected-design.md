# Jerry — Warper Keeper Agent Delegation: PR Review + Implementation

**Produced by:** Jerry (Session 2, 2026-09-05)
**PR reviewed:** warper-keeper commit `2c7766d90804a11531b04fb1ace6d39f7ea46f6a` ("feat(agent-access): add scoped Warper Keeper delegation")
**Directive:** Review at exact head. Do not merge, deploy, or issue a production credential. Josh remains owner; Larry is a delegated coordinator, never a root authority.

---

## PR Review — What the PR contains (CONFIRMED from reading the full diff)

### 3,907 lines across 18 files. The PR adds:

1. **`worker/agent-api.ts` (1,203 lines)** — A full REST API for delegated agent access:
   - `GET /api/agent/session` — returns the grant for the current token
   - `GET /api/agent/keepers` — list accessible keepers (requires `keeper:read`)
   - `GET /api/agent/keepers/:keeperId` — get one keeper
   - `GET /api/agent/trappers` — list trappers (requires `trapper:read`, `?keeperId=` filter)
   - `GET /api/agent/trappers/:trapperId` — get trapper + context + artifacts
   - `GET /api/agent/sources` — list sources (requires `source:read`, `?keeperId=` required)
   - `POST /api/agent/trappers` — create trapper (requires `trapper:write`)
   - `POST /api/agent/sources` — add source (requires `source:add`)
   - `POST /api/agent/trappers/:trapperId/context` — append context (requires `trapper:write`)
   - `POST /api/agent/trappers/:trapperId/sources` — attach source (requires `trapper:write` + `source:read`)
   - `POST /api/agent/trappers/:trapperId/artifacts` — submit artifact (requires `artifact:add`)
   - `POST /api/agent/trappers/:trapperId/receipts` — submit result receipt (requires `receipt:create`, `selfAttested: true` enforced, `certification: "none"` always)

2. **`worker/agent-delegation.mjs` (272 lines)** — The delegation logic:
   - `AGENT_PERMISSIONS`: `artifact:add`, `keeper:read`, `receipt:create`, `source:add`, `source:read`, `trapper:read`, `trapper:write` — 7 permissions, frozen, exhaustive
   - `normalizeAgentGrant()` — validates owner-scoped keeper IDs, finite permissions, bounded expiry (5 min to 90 days, default 30 days)
   - `createAgentToken()` — generates `wk_agent_` prefixed bearer tokens
   - `hashAgentToken()` — SHA-256 hash, stored only as hash
   - `bearerAgentToken()` — extracts token from `Authorization: Bearer` header
   - `assertPermission()` / `assertKeeperAccess()` — per-request ACL checks
   - `sporeAssertionFromHeaders()` — Spore Federation Gateway HMAC auth (8 headers, 5-min max assertion, 1-min clock skew, D1 replay nonce)
   - `verifySporeAssertion()` — constant-time HMAC-SHA256 comparison

3. **`docs/agent-delegation.md` (175 lines)** — Full documentation:
   - Authorization model: Farcaster owner consent → D1 grant → `wk_agent_*` token OR signed Spore assertion → same ACL
   - Owner routes (Quick Auth): `/api/miniapp/agent-grants` (list, create, renew, rotate, revoke)
   - Agent routes (bearer token): `/api/agent/*` (session, keepers, trappers, sources, context, artifacts, receipts)
   - Artifacts are references (content hash + optional URI), not uploaded blobs
   - Receipts: `selfAttested: true` required, `certification: "none"` always — "independent Claim Factory or quorum verification is still required before a claim or competency can be certified"
   - Rate limiting: 120 reads/min, 30 writes/min (configurable)
   - Deployment gate: apply migration, configure HMAC secret only when Spore is ready, run full test suite

4. **`drizzle/0005_square_luke_cage.sql` (89 lines)** — D1 migration adding 7 tables:
   - `agent_grants` (owner_fid, tenant_id, agent_id, keeper_ids_json, permissions_json, issued_at, expires_at, revoked_at)
   - `agent_tokens` (grant_id, token_hash UNIQUE, issued_at, expires_at, revoked_at)
   - `agent_grant_events` (grant_id, action, idempotency_key, receipt_hash, receipt_json — UNIQUE on owner_fid + action + idempotency_key)
   - `agent_spore_nonces` (request_id PK, grant_id, expires_at — replay prevention)
   - `agent_artifacts` (grant_id, keeper_id, trapper_id, name, media_type, content_hash, uri, summary)
   - `agent_receipts` (grant_id, owner_fid, tenant_id, agent_id, action, resource_type, resource_id, idempotency_key, receipt_hash, receipt_json, response_json — UNIQUE on grant_id + action + idempotency_key)
   - `agent_rate_limits` (window_key PK, grant_id, mode, window_start, count, expires_at)

5. **`tests/agent-api-contract.test.mjs` (439 lines)** — Integration tests covering:
   - Migration applies cleanly with all required tables + indexes
   - Owner grants a token; agent uses it to read keepers
   - Agent appends context (idempotent — replay returns 200 with `idempotentReplay: true`)
   - Agent denied `source:add` → 403 `AGENT_PERMISSION_DENIED`
   - Agent tries to self-certify (`verdict: "PASSED"`) → 400 `AGENT_UNKNOWN_FIELD:verdict` (unknown field rejected)
   - Agent submits receipt with `selfAttested: true` → 201, `certification: "none"`
   - Spore assertion: HMAC-signed, valid → 200; replayed → 401
   - Rate limit: configurable, returns 429 when exceeded
   - Token rotation: old token revoked → 401; new token works
   - Grant revocation: owner revokes → agent 401

6. **`tests/agent-delegation.test.mjs` (215 lines)** — Unit tests covering:
   - Grant normalization (lowercase, deduped, sorted)
   - Unknown permissions rejected (`proof:certify` → `AGENT_GRANT_PERMISSION_UNKNOWN`)
   - Unowned keepers rejected
   - Unknown fields rejected (no `denied` field)
   - Expiry bounds (null rejected, >90 days rejected)
   - Token format (`wk_agent_` prefix, 40+ chars, random)
   - Grant revocation + expiry → `active: false`
   - Spore assertion: HMAC, tenant swap rejected, expiry window enforced
   - Migration has all required tables; worker has no `up.railway.app` hardcode; docs mention Spore + `certification: "none"`

### Assessment

**What's right (CONFIRMED):**
- The authorization model is sound: owner creates grants via Farcaster Quick Auth, agents use `wk_agent_` tokens, every write is idempotent and receipted
- `certification: "none"` is always enforced server-side — Larry can submit evidence but never self-certify
- Artifacts are references (content hash + optional URI), not uploaded executable blobs
- Sensitive text rejection (private keys, API tokens, seed phrases) on all agent-supplied content
- Spore assertion uses constant-time HMAC comparison, D1 replay nonces, 5-min max assertion window
- Rate limiting is per-grant, per-mode (read/write), D1 fixed-window
- The 7 permissions are exhaustive and frozen — no `keeper:delete`, no `sharing:public`, no `proof:certify`, no wallet authority

**What's missing or worth noting (INFERRED/UNKNOWN):**
- `submit-battle-receipt` is NOT one of the routes — the spec you gave lists it as a REST endpoint (`POST /agent/capabilities/submit-battle-receipt`), but the actual PR routes are `/api/agent/trappers/:trapperId/artifacts` and `/api/agent/trappers/:trapperId/receipts`. Battle receipts go through the generic artifact + receipt endpoints, not a battle-specific one.
- The PR is not deployed to the live gateway at `warper-keeper-agent-gateway-production.up.railway.app` — that gateway still only has the MCP `submit_artifact` tool. The REST API from this PR lives on the Warper Keeper Cloudflare Worker (the Mini App), which is a different deployment.
- The trapper `gundarium-battle-receipts` doesn't exist yet — Josh needs to create it via the owner UI or the owner API first.

---

## Deliverable 1 — Tenant Boundary Matrix

| Boundary | Josh (owner) | Larry (delegate) | Hermes (delegate) | Codex (delegate) | Unauthenticated |
|---|---|---|---|---|---|
| **Create grants** | ✅ via `/api/miniapp/agent-grants` (Farcaster Quick Auth) | ❌ | ❌ | ❌ | ❌ |
| **Revoke/rotate grants** | ✅ via `/api/miniapp/agent-grants/:id/{revoke,renew,rotate}` | ❌ | ❌ | ❌ | ❌ |
| **Read keepers** | ✅ (owner) | ✅ if `keeper:read` granted | ✅ if `keeper:read` granted | ✅ if `keeper:read` granted | ❌ |
| **Read trappers** | ✅ (owner) | ✅ if `trapper:read` + keeper in grant | ✅ same | ✅ same | ❌ |
| **Create trappers** | ✅ (owner) | ✅ if `trapper:write` + keeper in grant | ✅ same | ✅ same | ❌ |
| **Append context** | ✅ (owner) | ✅ if `trapper:write` | ✅ same | ✅ same | ❌ |
| **Add sources** | ✅ (owner) | ✅ if `source:add` | ✅ same | ✅ same | ❌ |
| **Submit artifacts** | ✅ (owner) | ✅ if `artifact:add` | ✅ same | ✅ same | ❌ |
| **Create receipts** | ✅ (owner) | ✅ if `receipt:create` + `selfAttested: true` | ✅ same | ✅ same | ❌ |
| **Self-certify** | ❌ (enforced `certification: "none"`) | ❌ (enforced) | ❌ (enforced) | ❌ (enforced) | ❌ |
| **Delete keepers/trappers** | ✅ (owner UI) | ❌ (no route) | ❌ (no route) | ❌ (no route) | ❌ |
| **Public sharing** | ✅ (owner UI) | ❌ (no route) | ❌ (no route) | ❌ (no route) | ❌ |
| **Proof certification** | ❌ (no route) | ❌ (no route) | ❌ (no route) | ❌ (no route) | ❌ |
| **Wallet execution** | ❌ (no route) | ❌ (no route) | ❌ (no route) | ❌ (no route) | ❌ |
| **Production deployment** | ✅ (Josh) | ❌ | ❌ | ❌ | ❌ |

---

## Deliverable 2 — Delegation and Capability Manifest

### Larry's grant (proposed)

```json
{
  "tenantId": "gundarium",
  "agentId": "larry",
  "keeperIds": ["gundarium-launch"],
  "permissions": [
    "keeper:read",
    "trapper:read",
    "trapper:write",
    "source:read",
    "source:add",
    "artifact:add",
    "receipt:create"
  ],
  "expiresAt": "2026-10-05T00:00:00.000Z",
  "issueDirectToken": true
}
```

### Explicitly denied (no route exists, no permission in the frozen set)

| Denied capability | Why |
|---|---|
| `keeper:delete` | Not in `AGENT_PERMISSIONS`. No agent route for deletion. |
| `sharing:public` | Not in `AGENT_PERMISSIONS`. No agent route for public sharing. |
| `proof:certify` | Not in `AGENT_PERMISSIONS`. `certification: "none"` is enforced server-side on every receipt. |
| `wallet:execute` | Not in `AGENT_PERMISSIONS`. No agent route touches wallet authority. |
| `production:deploy` | Not in `AGENT_PERMISSIONS`. No agent route for deployment. |
| `unrestricted:federation` | Not in `AGENT_PERMISSIONS`. Federation access is scoped to the keeper IDs in the grant. |
| Grant administration | No agent route for `/api/miniapp/agent-grants`. Owner-only via Farcaster Quick Auth. |

### Grant bindings (every grant has)

| Binding | Source |
|---|---|
| Owner | Farcaster FID (from Quick Auth) |
| Tenant | `tenantId` in grant (e.g. "gundarium") |
| Agent identity | `agentId` in grant (e.g. "larry") |
| Keeper/Trapper scope | `keeperIds` in grant (e.g. ["gundarium-launch"]) |
| Capabilities | `permissions` in grant (frozen set of 7) |
| Rate limit | 120 reads/min, 30 writes/min (configurable via env) |
| Expiration | `expiresAt` in grant (5 min to 90 days, default 30 days) |
| Revocation reference | `revokedAt` timestamp + grant events table |
| Receipts | Every write produces a `warper-keeper-agent-write-receipt/1` with hash |

---

## Deliverable 3 — Shared-Memory Import/Export Contract

### Memory classes (implemented in the PR)

| Class | What it means | How it's enforced |
|---|---|---|
| **PRIVATE** | Owner-only data, never exposed to agents | No agent route returns private keeper data; `privacyClassification: "private"` on Trapper bundles |
| **PARTNER_SHARED** | Shared between owner and a specific delegated agent | Grant-scoped access via `keeperIds` in the grant; agent can only see what the grant allows |
| **PUBLIC** | Intentionally shared (Trapper share link, export) | Owner-only route `/api/miniapp/trappers/:id/share`; agent cannot create shares |
| **EPHEMERAL** | Session-bound, not persisted | Spore assertion nonces (5-min expiry, D1 replay protection) |

### Trapper export format (`warper-keeper-trapper/1`)

From the existing Warper Keeper share endpoint (line 1336 of worker/index.ts at HEAD):

```json
{
  "contractVersion": "warper-keeper-trapper/1",
  "trapper": { "id", "title", "objective", "riskLevel", "status", "createdAt", "closedAt" },
  "sources": [ SourceItem[] ],
  "receipt": { "id", "trapperId", "hash", "payload", "createdAt" } | null,
  "creator": { "fid" },
  "exportedAt": "ISO timestamp",
  "schemaVersion": 1,
  "privacyClassification": "private",
  "capabilities": [],
  "permissions": { "maxContextItems", "maxSourceBytes", "allowedDomains", "maxExecutionSeconds" },
  "expiry": null,
  "revocation": null
}
```

### Agent write receipt format (`warper-keeper-agent-write-receipt/1`)

From `commitAgentWrite()` in agent-api.ts (line 638):

```json
{
  "contractVersion": "warper-keeper-agent-write-receipt/1",
  "receiptId": "wkr_...",
  "grantId": "wkg_...",
  "ownerId": "fid:123456",
  "tenantId": "gundarium",
  "agentId": "larry",
  "authMode": "direct" | "spore",
  "leaseId": "..." (if Spore),
  "action": "artifact:add" | "receipt:create" | "trapper:context:append" | ...,
  "resourceType": "artifact" | "agent_result" | "context" | ...,
  "resourceId": "...",
  "keeperId": "...",
  "trapperId": "...",
  "idempotencyKey": "...",
  "payloadHash": "sha256:...",
  "certification": "none",
  "createdAt": "ISO timestamp",
  "hash": "sha256:..."
}
```

---

## Deliverable 4 — One Read-Only Warper Keeper Canary

### What I did

Updated `warperKeeperClient.ts` to target the PR's REST API:
- `POST /api/agent/trappers/:trapperId/artifacts` — submits the battle result as an artifact (content hash = proofHash)
- `POST /api/agent/trappers/:trapperId/receipts` — submits a self-attested result receipt (`selfAttested: true`, `certification: "none"` enforced server-side)
- Auth: `WARPER_KEEPER_TOKEN` env var (a `wk_agent_` token Josh creates via the owner UI)
- Fail-open: if `WARPER_KEEPER_TOKEN` is not set, returns `{ submitted: false, reason: "not_configured" }`

### What Josh needs to do to activate

1. **Deploy the PR to the Warper Keeper Cloudflare Worker** (not the Railway gateway — that's a separate service)
2. **Create a trapper** named `gundarium-battle-receipts` in the `gundarium-launch` keeper (via the Mini App UI or the owner API)
3. **Create a grant** for Larry:
   ```
   POST /api/miniapp/agent-grants
   Authorization: <Farcaster Quick Auth>
   Idempotency-Key: josh-grant-larry-0001
   {
     "tenantId": "gundarium",
     "agentId": "larry",
     "keeperIds": ["gundarium-launch"],
     "permissions": ["keeper:read", "trapper:read", "trapper:write", "source:read", "source:add", "artifact:add", "receipt:create"],
     "expiresAt": "2026-10-05T00:00:00.000Z",
     "issueDirectToken": true
   }
   ```
4. **Store the returned `wk_agent_` token** as `WARPER_KEEPER_TOKEN` in Vercel env (or Doppler)

### What I did NOT do

- Did not merge the PR
- Did not deploy it
- Did not create a production credential
- Did not create the trapper (that's an owner action)
- Did not create the grant (that's an owner action)

---

## Deliverable 5 — Trapper Export/Import Round Trip

The PR's Warper Keeper already supports Trapper export (`/api/miniapp/trappers/:id/share`) and import (`/api/miniapp/import`). The round trip:

1. **Export**: Owner creates a share link → `warper-keeper-trapper/1` bundle with `contractVersion`, `trapper`, `sources`, `receipt`, `permissions`, `privacyClassification: "private"`
2. **Import**: Another Warper Keeper instance reads the bundle via `/api/miniapp/import` — re-creates the keeper, trapper, sources, and receipts with new IDs, preserving the original hash as `originalHash` in the imported receipt payload

This is CONFIRMED from the existing `worker/index.ts` import handler (lines 604-731 at the current HEAD, not this PR — the import/export is existing functionality the PR doesn't change).

---

## Deliverable 6 — One Paper-Only Whale League Research Round

The `dreamnet-trading-trappers` Worker (at `dreamnet-trading-trappers.dreamnet-intel.workers.dev`) is the template for a paper-only research round. Whale League calls it:

1. `POST /v1/trappers/build` — builds a `dreamnet-trading-trapper/1` with a market observation + thesis + risk
2. `POST /v1/trappers/to-warper` — converts to a `warper-keeper-trapper/1` bundle

The trading trapper enforces `executionAuthority: "none"`, `walletAuthority: false`, `fundsMoved: 0`, `humanApprovalRequired: true` — paper-only by construction.

For GundariuM, the equivalent paper-only round is:
1. Player fights a PvE battle
2. Server re-derives the result via `replayBattle()` (deterministic, provable)
3. `computeProofHash()` produces a SHA-256 over the canonicalized replay inputs
4. The result + proofHash are submitted as an artifact + receipt to Warper Keeper
5. `certification: "none"` — the result is self-attested evidence, not a certified claim

---

## Deliverable 7 — Evidence Receipts and Rollback Instructions

### Evidence receipts

Every agent write produces a `warper-keeper-agent-write-receipt/1` containing:
- `grantId`, `ownerId`, `tenantId`, `agentId` — who
- `authMode` — how (`direct` or `spore`)
- `action`, `resourceType`, `resourceId` — what
- `keeperId`, `trapperId` — where
- `idempotencyKey` — dedup
- `payloadHash` — integrity
- `certification: "none"` — Larry cannot self-certify
- `hash` — SHA-256 over the receipt envelope

Larry may submit evidence and Proof Drop references but may not verify his own claims. DreamNet University/Quorum performs independent verification.

### Rollback instructions

1. **Remove `WARPER_KEEPER_TOKEN` from Vercel env** — federation immediately goes inert (returns `not_configured`)
2. **Revoke the grant** via `POST /api/miniapp/agent-grants/:grantId/revoke` — token immediately invalidated
3. **Delete the trapper** `gundarium-battle-receipts` — no agent writes land anywhere
4. **Delete `src/lib/federation/`** — the entire directory is net-new. Remove the one-line fetch from `arena/page.tsx`
5. **The determinism fix stays** — `deterministicSim.ts` is a correctness improvement independent of federation
6. **No contract changes to revert** — no Solidity was touched
7. **No database writes to undo** — the only writes are to Warper Keeper's D1, which is owner-controlled

---

## GundariuM Code Status

### Files changed (final state)

| File | Status | What it does |
|---|---|---|
| `src/lib/federation/proofHash.ts` | Fixed | `canonicalize()` now filters `undefined` + sorts keys — matches trading-trappers, public-core, Warper Keeper worker |
| `src/lib/federation/battleTrapper.ts` | New (kept) | `buildBattleTrapper()`, `validateBattleTrapper()`, `toWarperKeeperBundle()` — local bundle builder, usable independently |
| `src/lib/federation/warperKeeperClient.ts` | Rewritten | Targets the PR's REST API: artifacts + receipts via `wk_agent_` token. Fail-open if `WARPER_KEEPER_TOKEN` not set |
| `src/app/api/federation/submit-battle-receipt/route.ts` | Updated | Passes battleId + result + proofHash to the corrected client |

### Verification

- `npx tsc --noEmit` → 0 errors
- `npx eslint` → 0 errors, 0 warnings
- `canonicalize` matches trading-trappers' canonicalize (all 4 test cases)
- `replayBattle` determinism parity confirmed
- `battleTrapper.ts` builds, validates, and produces valid bundles

### What's still needed (owner actions, not engineering)

1. **Deploy the PR** to the Warper Keeper Cloudflare Worker (Josh's decision, per "no production activation until quorum approves")
2. **Create the trapper** `gundarium-battle-receipts` in the `gundarium-launch` keeper
3. **Create the grant** for Larry with the permissions listed above
4. **Store the `wk_agent_` token** as `WARPER_KEEPER_TOKEN` in Vercel/Doppler
5. **Quorum approval** — no production activation until DreamNet quorum approves the exact commit

### Confidence score

| Scope | Confidence | Why |
|---|---|---|
| PR review — read the full diff at exact commit | **10/10** | Read all 3,907 lines across 18 files |
| GundariuM-side code | **10/10** | `tsc` clean, lint clean, determinism verified |
| REST API endpoints | **10/10** | Confirmed from the PR's `agent-api.ts` — exact routes, exact payloads |
| Auth model (`wk_agent_` tokens) | **10/10** | Confirmed from `agent-delegation.mjs` + contract test |
| `certification: "none"` enforcement | **10/10** | Confirmed server-side in `commitAgentWrite()` line 654 |
| Self-certification rejection | **10/10** | Test at line 295: `verdict: "PASSED"` → 400 `AGENT_UNKNOWN_FIELD:verdict` |
| Deployment timing | **0/10** | Not deployed — waiting on quorum approval per directive |
| **Overall** | **9/10** | The code is correct and ready. The remaining gap is deployment + credential provisioning, which are human actions gated by quorum approval. |
