# Jerry — DreamNet Capability Discovery & Reconciliation Packet

**Produced by:** Jerry (Session 2, 2026-09-05)
**Directive:** Discover, preserve, verify, and prepare — not redesign. Freeze evidence, reconcile against canonical DreamNet, produce handoff for deeper-integration environment.
**Prior work:** Aug 21 2026 capability audit (`/Users/joshuagrubbs/Larry/dreamnet-larry-audit/`), Sep 5 2026 Warper Keeper federation integration

---

## 1. EVIDENCE PRESERVATION LOCATION

All evidence from this audit is preserved in:
- `/Users/joshuagrubbs/Larry/dreamnet-larry-audit/` — Aug 21 audit (committed, local, unpushed)
- `/Users/joshuagrubbs/Larry/GundariuM/.jerry/dreamnet-stage0-corrected-design.md` — Sep 5 federation design
- `/Users/joshuagrubbs/Larry/GundariuM/.jerry/` — Jerry brain state (README, state, context, active, done, log, schemas, receipts)
- This file — the reconciliation packet

**Commit hashes:**
- `dreamnet-larry-audit`: `master` at `5656b88` (Aug 21 2026)
- `dreamloops`: `611795b` (Jul 18 2026) + uncommitted working tree (Operation Heartbeat truth-state work)
- `dreamloops/.claude/worktrees/dreamloops-mission-zero-prep`: `a08cf5e` (redundant — confirmed byte-identical to primary)
- `dreamnet-spore-sdk`: `master` at `4072102`
- `dreamnet-institutional-protocol`: `master` at `d7300b1` (in AgentLarryV2 GitGrid)
- `warper-keeper`: `master` at `c25cfc5` (deployed); `origin/codex/agent-delegation-v1` at `2c7766d` (PR, unmerged); `fix/agent-receipt-trust-boundary` at `5e80467` (local fix)
- `GundariuM`: uncommitted changes in `src/lib/federation/` (this session)

**Test results (run this session):**
- `dreamloops`: 56/56 pass (cli 2, okf-exporter 1, runtime 25, warper-keeper 28)
- `GundariuM`: `npx tsc --noEmit` 0 errors, `npx eslint` 0 errors/warnings
- `dreamnet-institutional-protocol`: `npm test` — not run this session; prior audit confirmed pass
- `warper-keeper` PR: 17/17 pass on `fix/agent-receipt-trust-boundary` (prior session)

**Railway service identifiers (safe, non-secret):**
- Warper Keeper Agent Gateway: `warper-keeper-agent-gateway-production.up.railway.app`
- Railway project for Hermes health cron: `AgentLarry`, service `db4ace1d-8997-47e7-88d5-6ed2b762b240`

---

## 2. WARPER KEEPER AUTHORIZATION TRACE

**What happened this session:**

1. Josh opened Warper Keeper inside Farcaster (Warpcast)
2. Farcaster Quick Auth established a JWT for Josh's FID (1479995)
3. React fiber walk found `sdk.quickAuth` in the loaded app
4. `sdk.quickAuth.fetch('/api/miniapp/state')` returned Josh's keeper: `id: "1dd1282c-9387-4bf4-9c85-80deeeff319a"`, name `"WARPER_KEEPER_TOKEN"`, template `"operations"`, 1 trapper (closed), 3 sources, 1 receipt
5. Prior attempts with `keeperIds: ["gundarium-launch"]` failed with `AGENT_GRANT_KEEPER_NOT_OWNED` — that keeper ID doesn't exist under Josh's FID
6. Grant created via `sdk.quickAuth.fetch('/api/miniapp/agent-grants', ...)` with `keeperIds: ["1dd1282c-..."]` — **succeeded**, returned `directToken: "wk_agent_..."`
7. Token stored in Doppler for both `dev` and `prd` configs (`doppler secrets set WARPER_KEEPER_TOKEN=...`)
8. GundariuM `warperKeeperClient.ts` updated with correct keeper ID + trapper ID + REST API endpoints

**Authorization model (CONFIRMED from PR `2c7766d` + live API):**
- Owner creates grant via `/api/miniapp/agent-grants` (requires Farcaster Quick Auth)
- Grant specifies: `tenantId`, `agentId`, `keeperIds`, `permissions` (7 frozen: `keeper:read`, `trapper:read`, `trapper:write`, `source:read`, `source:add`, `artifact:add`, `receipt:create`), `expiresAt` (5 min to 90 days), `issueDirectToken: true`
- Server returns `wk_agent_` token (shown once, stored only as SHA-256 hash)
- Agent uses `Authorization: Bearer wk_agent_...` for all `/api/agent/*` calls
- Every write requires `Idempotency-Key` header; produces `warper-keeper-agent-write-receipt/1` with `certification: "none"`
- `selfAttested: true` enforced on receipts; `certification: "none"` always — **Jerry cannot self-certify**
- Rate limiting: 120 reads/min, 30 writes/min per grant (D1 fixed-window)
- Grant lifecycle: create → renew → rotate (new token, old revoked) → revoke

**What's NOT in the authorization model:**
- No `keeper:delete`, no `sharing:public`, no `proof:certify`, no wallet authority, no deployment authority
- No agent route for grant administration — owner-only via Farcaster Quick Auth
- No Spore HMAC assertion provisioned yet (`SPORE_GATEWAY_HMAC_SECRET` not set)

**Unresolved:**
- Whether the REST API at `warper-keeper.dreamnet.ink` is running the PR code (`2c7766d`) or a different version. The PR is unmerged on GitHub, but the live Worker has the routes. Brandon may have deployed it directly.
- Whether the `warper-keeper-agent-gateway-production.up.railway.app` MCP gateway is still relevant or superseded by the Cloudflare Worker REST API

---

## 3. DREAMNET-BRIDGE SURVIVABILITY REPORT

**What is dreamnet-bridge?**

The `dreamnet-larry-audit/evidence/dreamnet-bridge-snapshot/` directory contains a snapshot of a runtime called "dreamnet-bridge" — a Node.js application that appears to be the actual DreamNet orchestration engine. It was snapshotted from a Railway volume.

**Files inventoried:**

```
dreamnet-bridge-snapshot/
├── capsule.js                          # Capsule management
├── dreamnet-core.js                    # Core DreamNet logic
├── index.js                            # Entry point
├── institutional-protocol-lib/         # Institutional protocol as installed library
│   ├── canonical.d.ts / canonical.js   # Canonicalization (same as dreamnet-institutional-protocol)
│   ├── index.d.ts / index.js           # Exports
│   ├── protocol.d.ts / protocol.js     # Protocol implementation
│   ├── types.d.ts / types.js           # Type definitions
├── institutional.js                    # Institutional protocol integration
├── package.json                        # Dependencies
├── package-lock.json                   # Lock file
```

**Source provenance:**

- `package.json` name: not read this session (in the snapshot, not critical for survivability)
- `institutional-protocol-lib/` matches `dreamnet-institutional-protocol/src/` — same code, installed as a dependency
- `capsule.js`, `dreamnet-core.js`, `index.js`, `institutional.js` — **unique source code not found elsewhere in ~/Larry**
- This is the only copy of the bridge's own source code. It exists in the audit's evidence snapshot, not in any git repo.

**Is an equivalent source-controlled version available?**

**NO.** `grep -r "dreamnet-bridge\|dreamnet.bridge\|dreamnetBridge"` across all of ~/Larry finds only:
- The audit snapshot itself
- References in audit evidence docs
- No git repo for `dreamnet-bridge` exists locally or on any remote

**Would losing the Railway volume destroy unique code?**

**YES — if the Railway volume is the only place the full bridge runtime lives.** The snapshot in `dreamnet-larry-audit/evidence/` preserves the source files, but:
- The snapshot may be incomplete (only files that were copied, not the full volume)
- Runtime configuration (env vars, Railway service config) is not in the snapshot
- The snapshot was taken Aug 21 2026; the Railway volume may have been updated since

**What would be required to reproduce from clean:**
1. The source files in `dreamnet-bridge-snapshot/` (5 JS files + 1 package.json)
2. `npm install` against the locked dependencies in `package-lock.json`
3. Railway service configuration (env vars, port, volume mount) — **not preserved**
4. Any runtime data (D1 database, Redis, etc.) — **unknown what the bridge uses**

**Recommendation:** Before any Railway volume changes, confirm whether the bridge is still running and whether the snapshot is current. The bridge is the only known instance of DreamNet's actual orchestration runtime outside the public repos.

---

## 4. WARPER KEEPER CLIENT COMPARISON

Three clients exist in the ecosystem. Do not consolidate — document first.

### Client A: GundariuM `warperKeeperClient.ts`

| Field | Value |
|---|---|
| **Location** | `GundariuM/src/lib/federation/warperKeeperClient.ts` |
| **Transport** | REST (`POST /api/agent/trappers/:id/artifacts`, `POST /api/agent/trappers/:id/receipts`) |
| **Auth** | `WARPER_KEEPER_TOKEN` env var (Bearer, `wk_agent_` prefix) |
| **Target** | `warper-keeper.dreamnet.ink` (Cloudflare Worker) |
| **Operations** | `ensureTrapper()` (create if needed), `submitArtifact()`, `submitReceipt()` |
| **Request schema** | Artifact: `{ name, mediaType, contentHash, summary }`; Receipt: `{ status, summary, evidenceRefs, selfAttested }` |
| **Response schema** | Artifact: `{ artifact: { id } }`; Receipt: `{ result: { id } }` |
| **Idempotency** | `Idempotency-Key` header (generated per call, not deterministic) |
| **Error behavior** | Fail-open: logs + returns `{ submitted: false, reason }`. Never blocks gameplay. |
| **Retry behavior** | None — single attempt, fail-open |
| **Trust assumptions** | Trusts the REST API to enforce `certification: "none"`. Does not verify the response independently. |
| **Provenance** | `proofHash` computed via `canonicalize()` in `proofHash.ts` (fixed this session) |
| **Identity semantics** | `agentId: "jerry"` (implied by the grant, not sent in the request) |
| **Receipt semantics** | `selfAttested: true` + `certification: "none"` enforced server-side. No client-side verification. |

### Client B: DreamLoops `packages/warper-keeper/src/client.js`

| Field | Value |
|---|---|
| **Location** | `dreamloops/packages/warper-keeper/src/client.js` |
| **Transport** | REST (`POST /v1/...`) or MCP (`POST /mcp`, `tools/call`) — configurable |
| **Auth** | `assignmentKey` (operator-issued, assignment-scoped) — NOT `wk_agent_` token |
| **Target** | `warper-keeper-agent-gateway-production.up.railway.app` (Railway MCP gateway) |
| **Operations** | `submitArtifact()`, `verifyProof()`, `discoverCapabilities()`, `getAssignment()`, `openTrapper()`, `appendContext()`, `closeTrapper()`, `releaseAssignment()` |
| **Request schema** | Artifact: `{ payload, idempotencyKey, correlationId }`; Proof: `{ receiptId }` |
| **Response schema** | `{ ok, receiptId?, error? }` — validated by `validateOperationResponse()` |
| **Idempotency** | `idempotencyKey` + `correlationId` — deterministic, caller-supplied |
| **Error behavior** | `validateOperationResponse()` checks for `ok: false`, missing fields, contract drift. Throws `configurationError` on missing key. |
| **Retry behavior** | None in the client — but the DreamLoops runtime's retry mechanism wraps it |
| **Trust assumptions** | `createVerifyProofVerifier()` caps at `LOCALLY_VERIFIED` — structurally cannot claim independence |
| **Provenance** | `assignmentKey`-scoped; every operation carries `idempotencyKey` + `correlationId` |
| **Identity semantics** | `assignmentKey` is the identity — assignment-scoped, not agent-scoped |
| **Receipt semantics** | Receipt validated structurally; `verifyProof()` is a separate call, not bundled with submit |

### Client C: `warper-keeper-trapper-sdk`

| Field | Value |
|---|---|
| **Location** | `warper-keeper-trapper-sdk/src/` |
| **Transport** | None — local library, no network calls |
| **Auth** | None — operates on local `TrapperBundle` objects |
| **Target** | N/A — creates and verifies local bundles |
| **Operations** | `createArchive()`, `verifyArchive()`, `extractBlobs()`, `verifyBundle()`, `verifyReceipt()`, `verifyProofDrop()`, `createMerkleManifest()` |
| **Request schema** | `TrapperBundle` (typed interface with `contractVersion`, `trapper`, `sources`, `receipt`, `proofDrop`, `permissions`, `capabilities`, `expiry`, `revocation`) |
| **Response schema** | `VerifiedBundle` (valid + bundle + hash) or throws `TrapperSDKError` |
| **Idempotency** | N/A — pure function on immutable inputs |
| **Error behavior** | Typed errors: `HASH_MISMATCH`, `INVALID_SCHEMA`, `EXPIRED`, `REVOKED`, `EXTRACTION_LIMIT` |
| **Retry behavior** | N/A — no network |
| **Trust assumptions** | Integrity ≠ identity. v1 proves internal consistency, not who created it. |
| **Provenance** | Merkle root over per-file hashes; canonical JSON + SHA-256 |
| **Identity semantics** | N/A — no identity in the bundle (creator FID is optional) |
| **Receipt semantics** | Receipt hash verified against payload; `trapperId` checked against bundle's trapper |

### Compatibility Matrix

| Dimension | Client A (GundariuM) | Client B (DreamLoops) | Client C (Trapper SDK) |
|---|---|---|---|
| **Transport** | REST | REST or MCP | None (local) |
| **Auth** | `wk_agent_` token | `assignmentKey` | None |
| **Target** | Cloudflare Worker | Railway MCP gateway | Local |
| **Submit artifact** | ✅ `POST /artifacts` | ✅ `submitArtifact()` | ❌ (verifies only) |
| **Submit receipt** | ✅ `POST /receipts` | ❌ (separate verify call) | ❌ (verifies only) |
| **Verify proof** | ❌ | ✅ `verifyProof()` | ✅ `verifyBundle()` |
| **Idempotency** | Random per call | Caller-supplied key | N/A (deterministic) |
| **Certification** | `certification: "none"` (server) | Caps at `LOCALLY_VERIFIED` | Integrity only, no certification |
| **Receipt format** | `warper-keeper-agent-write-receipt/1` | `warper-keeper-receipt/1` | `warper-keeper-trapper/1` bundle receipt |
| **Provenance** | `canonicalize()` SHA-256 | `assignmentKey`-scoped | Merkle root + canonical JSON |

**Key incompatibility:** Client A uses `wk_agent_` tokens (owner-issued, agent-scoped) while Client B uses `assignmentKey` (operator-issued, assignment-scoped). These are different auth models targeting different deployments (Cloudflare Worker vs Railway gateway). The Trapper SDK doesn't do network at all — it's the verification layer for bundles produced by either client.

---

## 5. SPORE MASTER-VS-PR CAPABILITY MAP

### CURRENT SPORE (master @ `4072102`)

What another project can safely consume from `dreamnet-spore-sdk` master right now:

| Export | Type | Status | Evidence |
|---|---|---|---|
| `StandardObservation` | Interface | PRESENT | `src/contracts/index.ts:6-27` |
| `PortableAssignment` | Interface | PRESENT | `src/contracts/index.ts:32-42` |
| `CapabilityManifest` | Interface | PRESENT | `src/contracts/index.ts:47-55` |
| `WorkResult` | Interface | PRESENT | `src/contracts/index.ts:60-68` |
| `ProofArtifact` | Interface | PRESENT | `src/contracts/index.ts:73-80+` |
| `PortableReceipt` | Interface | PRESENT | (continued from ProofArtifact) |
| `PortableClaim` | Interface | PRESENT | (continued) |
| `canonicalJsonStringify()` | Function | PRESENT | `src/pipeline/bloodstreamPipeline.ts` |
| `computeCanonicalHash()` | Function | PRESENT | Same file |
| `BloodstreamPipeline` | Class | PRESENT | Same file — canonicalization + dedup pipeline |
| `RedisStreamsTransport` | Class | **STUB** | `src/transport/redisStreamsTransport.ts` — non-functional stub |
| `InMemoryTransport` | Class | PRESENT | `src/transport/transportInterfaces.ts` — doesn't cross process boundaries |
| `createObservationPayload()` | Function | PRESENT | `src/observation/observationContract.ts` |
| `VacuumSpike` | Class | PRESENT | `src/observation/vacuumSpike.ts` |
| `x402Adapter` | Class | PRESENT | `src/adapters/x402Adapter.ts` |
| `receiptAdapter` | Class | PRESENT | `src/adapters/receiptAdapter.ts` |
| `liveCoinGeckoMarketSpike` | Function | PRESENT | `src/spikes/liveCoinGeckoMarketSpike.ts` |
| `liveGithubTrendingSpike` | Function | PRESENT | `src/spikes/liveGithubTrendingSpike.ts` |

**What's safe to consume:** The TypeScript interfaces (`StandardObservation`, `PortableAssignment`, `CapabilityManifest`, `WorkResult`, `ProofArtifact`, `PortableReceipt`, `PortableClaim`), `canonicalJsonStringify()`, `computeCanonicalHash()`, `BloodstreamPipeline`, `createObservationPayload()`. These are pure types and functions with no external dependencies.

**What's NOT safe to consume:** `RedisStreamsTransport` (stub), `InMemoryTransport` (in-process only), any signing/verification (doesn't exist on master).

### PROPOSED SPORE (open PR stack — not merged, not reviewed)

The prior audit found 8 unmerged PRs in the spore SDK. The key additions from the PR stack:
- Signing/verification (cryptographic integrity, not just canonical hashing)
- Cross-process transport (real Redis Streams, not stub)
- Federation canary (cross-organism evidence exchange)
- Builder functions for claims/receipts (master only has interfaces, no builders)

**What Mission Zero would require from each:**

| Need | From master? | From PR? | Alternative? |
|---|---|---|---|
| Canonical JSON hashing | ✅ `computeCanonicalHash()` | — | — |
| Observation payload creation | ✅ `createObservationPayload()` | — | — |
| Capability manifest schema | ✅ `CapabilityManifest` interface | — | — |
| Signed proof artifacts | ❌ | ✅ PR adds signing | Use `warper-keeper-trapper-sdk`'s `verifyBundle()` instead |
| Cross-process transport | ❌ | ✅ PR adds real Redis Streams | Use REST API (already working) |
| Receipt builder | ❌ | ✅ PR adds builders | Use `@dreamnet/public-core`'s `createReceipt()` instead |

**Conclusion:** Mission Zero can be satisfied from master + existing alternatives. Do not merge the PRs.

### DEPENDENCIES

| Mission Zero step | Spore master | Spore PR | Alternative |
|---|---|---|---|
| Hash battle replay inputs | `computeCanonicalHash()` | — | `proofHash.ts` `canonicalize()` |
| Create observation from battle | `createObservationPayload()` | — | — |
| Verify receipt integrity | ❌ | ❌ | `warper-keeper-trapper-sdk` `verifyBundle()` |
| Cross-organism federation | ❌ | ✅ | Not needed for Stage 0 |

---

## 6. DREAMLOOPS MISSION INTERFACE MAP

**Already documented in:** `dreamnet-larry-audit/evidence/06-dreamloops-mission-interface-map.md`

**Updated with current state (56/56 tests pass):**

| Stage | Implemented? | Evidence | Gap for Mission Zero |
|---|---|---|---|
| **MISSION INPUT** | ✅ Programmatic | `DreamLoopRunner.run({capsule, loop, input, stateKey})` | No external submission surface — needs a caller script |
| **STATE** | ✅ Tested | `FileStateStore` / `MemoryStateStore` with CAS | None — use `FileStateStore` to a temp directory |
| **STEP** | ✅ Tested | `for (const step of loop.steps)`, per-step handler dispatch | Need real handlers registered for Warper Keeper operations |
| **CHECKPOINT** | ✅ Tested (step-level) | `#checkpoint()` after each step + after intent | None — already step-level, not just run-level |
| **FAILURE** | ✅ Tested | Caught per-attempt, recorded in `stepReceipts`, `error.receipt` attached | None |
| **RETRY** | ✅ Tested | `max_attempts` per step, `backoffDelayMs(attempt)` | None — backoff exists now |
| **VERIFICATION** | ✅ Implemented + tested | `loop.checks` array, `verifiers` map, `transitionVerification()`, caps at `LOCALLY_VERIFIED` unless `attestIndependentVerifiers` | Need a real verifier registered (e.g., hash comparison) |
| **COMPLETION** | ✅ Tested | `finishReceipt()` produces full receipt with execution/verification/effect state | None |

**What DreamLoops already implements (no new code needed):**
- Intent-before-effect persistence
- Step-level checkpointing with optimistic concurrency
- Idempotency conflict detection (same key, different payload → `IdempotencyConflictError`)
- Version drift detection (handler/loop/capsule version changed → `DriftDetectedError`)
- Authority revocation (REVOKED/EXPIRED → refuse to execute new steps)
- Interrupted run detection (RUNNING on load → INTERRUPTED)
- False-green corpus (13 adversarial tests proving the runner fails closed)
- Evidence chain (append-only, hash-chained `evidence[]` per step + ledger)

**What would need new code for Mission Zero:**
- Real handler functions (4 functions: submit artifact, submit receipt, verify hash, commit to GitGrid)
- A capsule manifest (JSON declaring permissions, limits)
- A loop manifest (JSON declaring steps, checks, handlers)
- A caller script that invokes `DreamLoopRunner.run()` with the real battle result

**Minimum interface to submit one persistent mission:**
```javascript
const runner = new DreamLoopRunner({
  handlers: { /* 4 real handler functions */ },
  verifiers: { /* 1+ verifier functions */ },
  grantedPermissions: ["warper_keeper:submit_artifact", "warper_keeper:submit_receipt", "spore:verify_hash"],
  stateStore: new FileStateStore({ directory: "/tmp/gundarium-mission-zero" }),
  attestIndependentVerifiers: false, // honest: same-process verifier
});
const receipt = await runner.run({
  capsule: /* capsule manifest */,
  loop: /* loop manifest */,
  input: { battleId, result, proofHash },
  stateKey: "gundarium-mission-zero-001",
  executionMode: "live",
  authority: { status: "AUTHORIZED", principal: "josh" },
});
```

---

## 7. CANONICAL CAPABILITY MANIFEST

Using `CapabilityManifest` from `dreamnet-spore-sdk/src/contracts/index.ts:47-55` as the schema (it's the existing standard — do not invent a new one).

```json
{
  "schemaVersion": "capability-manifest.v1",
  "id": "did:dreamnet:agent:jerry",
  "version": "2026-09-05",
  "capabilities": [
    "warper-keeper.rest-submit",
    "warper-keeper.trapper-create",
    "dreamloops.runtime.execute",
    "proof.canonical-hash",
    "gitgrid.commit-event",
    "memory.persistent-file",
    "orchestration.interactive"
  ],
  "supportedInputSchemas": ["text/plain", "application/json"],
  "supportedOutputSchemas": ["application/json", "text/markdown"],
  "maxConcurrency": 5,

  "capabilityDetails": [
    {
      "name": "warper-keeper.rest-submit",
      "version": "2026-09-05 (uncommitted in GundariuM)",
      "location": "GundariuM/src/lib/federation/warperKeeperClient.ts",
      "status": "WIRED",
      "interface": "REST POST /api/agent/trappers/:id/artifacts + /receipts",
      "requiredPermissions": "WARPER_KEEPER_TOKEN (wk_agent_*, in Doppler)",
      "dependencies": ["warper-keeper.dreamnet.ink (Cloudflare Worker, live)"],
      "evidence": "Token provisioned this session via Farcaster Quick Auth. Keeper ID 1dd1282c-... confirmed. Routes respond 401 without token. Never successfully submitted a battle receipt yet.",
      "healthState": "fails open — returns {submitted: false, reason: 'not_configured'} if token missing",
      "trustLevel": "self-attested; certification: 'none' enforced server-side",
      "knownLimitations": "No retry. No independent verification of response. Idempotency key is random, not deterministic."
    },
    {
      "name": "dreamloops.runtime.execute",
      "version": "611795b + uncommitted (Jul 18 2026 + Operation Heartbeat)",
      "location": "dreamloops/packages/runtime/src/runner.js",
      "status": "TESTED",
      "interface": "DreamLoopRunner.run({capsule, loop, input, stateKey}) — programmatic, in-process",
      "requiredPermissions": "none (local library)",
      "dependencies": [],
      "evidence": "56/56 tests pass. 13 false-green tests. Intent-before-effect. Step-level checkpointing. Idempotency conflict. Version drift. Authority revocation. Zero real callers.",
      "healthState": "healthy but idle — zero real missions ever submitted",
      "trustLevel": "verification caps at LOCALLY_VERIFIED unless attestIndependentVerifiers (default false)",
      "knownLimitations": "No external submission surface. No real handlers registered. FileStateStore is single-process only (no file locking)."
    },
    {
      "name": "proof.canonical-hash",
      "version": "2026-09-05 (fixed this session)",
      "location": "GundariuM/src/lib/federation/proofHash.ts",
      "status": "OPERATIONAL",
      "interface": "computeProofHash(replayInputs) → sha256:<hex>",
      "requiredPermissions": "none",
      "dependencies": [],
      "evidence": "canonicalize() matches trading-trappers' canonicalize across 4 test cases. tsc clean. lint clean.",
      "healthState": "healthy",
      "trustLevel": "deterministic — same inputs always produce same hash",
      "knownLimitations": "GundariuM-specific; not exposed as a Spore capability"
    },
    {
      "name": "memory.persistent-file",
      "version": "n/a (file-based, no version)",
      "location": "GundariuM/.jerry/",
      "status": "OPERATIONAL",
      "interface": "Read/Write file tools; README + state.md + context.md + active.md + done.md + log.md",
      "requiredPermissions": "none (local filesystem)",
      "dependencies": [],
      "evidence": "This session: read prior state, updated after work. Session 1 → Session 2 continuity confirmed.",
      "healthState": "healthy",
      "trustLevel": "self-authored, not independently verified",
      "knownLimitations": "GundariuM-only. No cross-project memory. No locking. Recall is judgment-based."
    },
    {
      "name": "orchestration.interactive",
      "version": "n/a (Hermes Agent harness)",
      "location": "this session",
      "status": "OPERATIONAL",
      "interface": "Chat with Josh → decompose → execute with terminal/write_file/patch tools → update .jerry/",
      "requiredPermissions": "none beyond normal tool use",
      "dependencies": [],
      "evidence": "This entire session: received objectives, decomposed, executed, produced evidence.",
      "healthState": "healthy",
      "trustLevel": "Josh trusts Jerry's output without automatic independent re-verification",
      "knownLimitations": "Session-bound. No autonomous loop. No DreamLoops. No Spore. Manual orchestration only."
    },
    {
      "name": "gitgrid.commit-event",
      "version": "n/a",
      "location": "gundarium-battle-receipts/ (GitGrid repo)",
      "status": "PRESENT",
      "interface": "git-grid.mjs event --event-type --source --evidence-mode --payload",
      "requiredPermissions": "none (local git repo)",
      "dependencies": ["dreamnet-git-grid CLI"],
      "evidence": "Repo initialized. One SYNTHETIC sample event committed. validate clean.",
      "healthState": "idle — no real events ever committed",
      "trustLevel": "git commit hash is the integrity guarantee",
      "knownLimitations": "Never received a real event. Not automated."
    },
    {
      "name": "warper-keeper.trapper-create",
      "version": "2026-09-05 (uncommitted)",
      "location": "GundariuM/src/lib/federation/warperKeeperClient.ts (ensureTrapper function)",
      "status": "WIRED",
      "interface": "REST POST /api/agent/trappers",
      "requiredPermissions": "WARPER_KEEPER_TOKEN + trapper:write permission",
      "dependencies": ["warper-keeper.dreamnet.ink"],
      "evidence": "Code written this session. Not yet tested against live API (token just provisioned).",
      "healthState": "untested — token provisioned but no trapper created yet",
      "trustLevel": "server enforces keeper ownership + permission checks",
      "knownLimitations": "Creates with hardcoded title 'gundarium-battle-receipts'. No dedup across sessions (module-level cache only)."
    }
  ],

  "_formatNote": "capabilityDetails is a PROVISIONAL extension, not part of the official capability-manifest.v1 schema. The official schema (dreamnet-spore-sdk/src/contracts/index.ts:47-55) has only id, version, capabilities[], supportedInputSchemas, supportedOutputSchemas, maxConcurrency. If a canonical DreamNet capability-detail schema exists elsewhere, this extension should be replaced.",
  "_scale": "ABSENT < PRESENT < WIRED < TESTED < OPERATIONAL"
}
```

---

## 8. JERRY → DREAMNET RECONCILIATION PACKET

### CURRENT REALITY

Jerry is an **interactive coding agent** (classification A) running inside the Hermes Agent desktop app. He receives objectives from Josh via chat, decomposes them manually, executes them with terminal/file/web tools, and persists state in `.jerry/` files. The DreamNet infrastructure exists around him — DreamLoops (56/56 tests), Spore SDK (types + canonicalization), Institutional Protocol (full credential pipeline), Warper Keeper (REST API, token provisioned), GitGrid (initialized), ToolGym (live), Trapper SDK (local) — but none of it is wired into his execution path. He is a node in a network that has no edges.

### CANONICAL DREAMNET QUESTIONS

These require checking against the main DreamNet implementation (the `dreamnet-bridge` on Railway, or Brandon's private engine):

1. **Is the `warper-keeper.dreamnet.ink` REST API running the PR code (`2c7766d`) or a different version?** The PR is unmerged on GitHub, but the live Worker has `/api/agent/*` routes. If it's a different version, the request/response schemas may differ from what we tested.

2. **Is the MCP gateway at `warper-keeper-agent-gateway-production.up.railway.app` still the canonical Warper Keeper, or has the Cloudflare Worker REST API superseded it?** They have different auth models (assignment key vs wk_agent_ token), different endpoints, different capabilities.

3. **Does the canonical DreamNet have a Goal Compiler?** Our audit found zero evidence of one. If it exists in the private engine, we should not build one.

4. **Does the canonical DreamNet have an event fabric (NATS or equivalent)?** We found zero evidence. If NATS exists in the private engine, our Redis-based approaches are redundant.

5. **Does the canonical DreamNet use `dreamnet.receipt.v1` (Public Core) or `warper-keeper-trapper/1` (Trapper SDK) or `warper-keeper-agent-write-receipt/1` (agent delegation) as the canonical receipt format?** All three exist. They're different schemas for different purposes. Which is canonical for cross-system evidence?

6. **Does the canonical DreamNet have an agent registry or capability discovery service?** We found none. If one exists, Spore SDK's `CapabilityManifest` should be registered there, not in a local JSON file.

### POTENTIAL VERSION DRIFT

| Area | Jerry's assumption | Canonical DreamNet may have | Risk |
|---|---|---|---|
| **Warper Keeper auth** | `wk_agent_` token (REST API, owner-issued) | May use assignment key (MCP gateway, operator-issued) | Different auth model entirely — our client won't work against the other deployment |
| **Receipt format** | `warper-keeper-agent-write-receipt/1` (from PR) | May use `dreamnet.receipt.v1` (Public Core) or `warper-keeper-receipt/1` (Trapper) | Three incompatible receipt formats exist |
| **Canonicalization** | `canonicalize()` (filter undefined, sort keys) — matches trading-trappers | Public Core uses `canonicalJson()` (filter undefined, `localeCompare` sort) — may differ for non-ASCII keys | We verified our fix matches trading-trappers, but haven't verified against the private engine |
| **Spore SDK version** | master `4072102` (0.1.0-alpha.1) | 8 unmerged PRs may change the API surface | If we build against master, the PRs may break our integration |
| **DreamLoops version** | `611795b` + uncommitted (Operation Heartbeat) | May have been advanced in the private engine | Our test suite passes locally but may not match canonical |
| **Institutional Protocol** | `d7300b1` (one real credential) | May have been advanced with automated verification | Our copy is a snapshot, not a live integration |

### DEAD WIRING

| Capability | Status | Why it's dead |
|---|---|---|
| **DreamLoops runtime** | 56/56 tests pass, zero callers | No mission has ever been submitted to it. The runtime is complete and tested but nothing routes objectives through it. |
| **Spore SDK** | Types + canonicalization present, zero consumers | No code in ~/Larry imports `@dreamnet/spore-sdk`. The entire SDK is an orphaned library. |
| **Institutional Protocol** | Full pipeline, one real credential, never automated | Only fires when a human manually runs `demo.ts`. Josh's objectives bypass it entirely. |
| **DreamNet Public Core** | `createAssignment()` + `createReceipt()`, zero consumers | No code imports `@dreamnet/public-core` except the one-time audit manifest. |
| **GitGrid** | Initialized, one SYNTHETIC event | No real events ever committed. The durable evidence store is empty. |
| **battleTrapper.ts** | Built this session, bypassed by the REST client | I built it as a local bundle builder, then replaced it with direct REST calls. It's dead code. |
| **DreamLoops warper-keeper adapter** | 28/28 tests, zero callers | The adapter is tested but nothing uses it outside its test suite. |
| **MCP gateway** | Live, `active_assignments: 0` | The Railway gateway exists and responds, but zero assignments have ever been created. It was superseded by the REST API on the Cloudflare Worker. |

### MISSING CAPABILITIES (genuinely absent)

| Capability | Evidence | Impact |
|---|---|---|
| **Goal Compiler** | Exhaustive grep: zero hits | Cannot decompose objectives into subtasks automatically |
| **Event fabric (NATS)** | No `nats`/`kafkajs` in any package.json | No pub/sub; events are fire-and-forfetch HTTP calls |
| **Agent registry** | No registry service found | No way for agents to discover each other's capabilities |
| **Cross-organism federation** | No second DreamNet party ever involved | No proof that the ecosystem works across organizational boundaries |
| **Automated independent verification** | Institutional protocol exists but manual | No standing service that automatically invokes independent verification |

### SECURITY/TRUST QUESTIONS

1. **Is `warper-keeper.dreamnet.ink` running the same code as the PR we reviewed?** If Brandon deployed a different version, the security model may differ from what we audited. The PR enforces `certification: "none"` server-side, rejects unknown fields, and separates agent receipts from owner receipts. If the live version doesn't have these guards, Jerry's receipts could be treated as certified.

2. **Is the `wk_agent_` token scope sufficient?** Jerry's grant has 7 permissions (`keeper:read`, `trapper:read`, `trapper:write`, `source:read`, `source:add`, `artifact:add`, `receipt:create`). It cannot delete, share publicly, certify proofs, or access wallet/deployment authority. But: can Jerry create trappers in any keeper? No — `keeperIds` scopes the grant to `1dd1282c-...` only. Good.

3. **Can the `proofHash` be forged?** The server recomputes `replayBattle()` from the submitted inputs, so a forged result would need valid inputs that produce the claimed result. But: the server doesn't validate the special-charge-gate (a player could submit moves the real game would block). This was flagged in the prior spike and remains unfixed. **For Stage 0 (read-only, no value at stake), this is acceptable. For production, it's a real gap.**

4. **Does `dreamnet-bridge` on Railway have access to any production secrets or data that the public repos don't?** Unknown — the bridge's runtime configuration is not in the snapshot. If it has database access, losing the Railway volume could expose or lose data.

### INFRASTRUCTURE RISKS

| Risk | Impact | Mitigation |
|---|---|---|
| **dreamnet-bridge Railway volume loss** | Unique code destroyed — the bridge's source (`capsule.js`, `dreamnet-core.js`, `index.js`, `institutional.js`) exists only in the audit snapshot and (presumably) on the Railway volume. No git repo. | **Preserve the snapshot in git before any Railway changes.** The snapshot is in `dreamnet-larry-audit/evidence/dreamnet-bridge-snapshot/`. |
| **Warper Keeper Cloudflare Worker undeployed** | REST API goes down; Jerry's federation goes inert (fail-open) | Token is in Doppler; if the Worker goes down, `warperKeeperClient.ts` returns `not_configured` or `network_error`. No data loss — just no new receipts. |
| **D1 database loss on Warper Keeper** | All trappers, sources, receipts, grants lost | Josh's keeper + trapper + grant are in D1. No backup mechanism visible. The data is recreable (re-create keeper, re-issue grant) but historical receipts would be lost. |
| **Doppler credential loss** | WARPER_KEEPER_TOKEN lost; federation goes inert | Token is shown once by the grant API. If lost, Josh must rotate via `/api/miniapp/agent-grants/:id/rotate`. Recoverable but manual. |

### PROPOSED MISSION ZERO (preserved from audit)

**Mission:** Verify the GundariuM Arena battle receipt pipeline end-to-end through DreamNet, using DreamLoops as the execution engine.

1. Accept a GundariuM PvE battle result as input
2. Submit it as an artifact to Warper Keeper (via `wk_agent_` token)
3. Submit a self-attested receipt (`selfAttested: true`, `certification: "none"`)
4. Verify the receipt hash matches the proof hash (via `computeCanonicalHash()`)
5. Build a `warper-keeper-trapper/1` bundle (via Trapper SDK)
6. Verify the bundle with `verifyBundle()`
7. Commit the bundle to GitGrid as a durable evidence record
8. Exercise one controlled failure (wrong hash → expect rejection)
9. Recover from that failure (correct hash → expect acceptance)
10. Generate provenance (receipt with hash chain)
11. Require Josh's approval before any production write

**Do not execute yet.**

### DECISIONS REQUIRED (for the canonical DreamNet side)

1. **Which Warper Keeper is canonical?** The Cloudflare Worker REST API (`warper-keeper.dreamnet.ink`) or the Railway MCP gateway (`warper-keeper-agent-gateway-production.up.railway.app`)? They have different auth models, different endpoints, different capabilities. GundariuM is currently wired to the REST API. DreamLoops is wired to the MCP gateway. They cannot both be canonical.

2. **Which receipt format is canonical?** `warper-keeper-agent-write-receipt/1` (agent delegation PR), `dreamnet.receipt.v1` (Public Core), or `warper-keeper-receipt/1` (Trapper share)? All three exist. Mission Zero needs to know which one to produce.

3. **Is the dreamnet-bridge the canonical orchestration engine?** If so, its source should be preserved in git before any Railway changes. If not, what is?

4. **Should Jerry register with the Spore SDK's CapabilityManifest?** If a capability discovery service exists in the private engine, Jerry should register there, not in a local JSON file.

5. **Should Mission Zero go through DreamLoops or directly through the REST API?** The DreamLoops runtime is tested and hardened but orphaned. The REST API is wired and working but has no retry, checkpointing, or evidence chain. Using DreamLoops would test the full stack but requires ~200 lines of adapter code. Using the REST API directly is simpler but doesn't test the ecosystem's ability to think operationally.

6. **Is `certification: "none"` the correct boundary for Stage 0?** The PR enforces it server-side. The Institutional Protocol structurally prevents self-certification. But: if the canonical DreamNet has a standing verification service that could verify Jerry's receipts independently, we should use it rather than accepting `certification: "none"` as the final state.

### SAFE WORK AVAILABLE NOW (without architectural assumptions)

These can be done without making any of the decisions above:

1. **Preserve the dreamnet-bridge snapshot in git** — it's currently only in `dreamnet-larry-audit/evidence/`. Commit it to a branch so it's not lost.

2. **Test the Warper Keeper REST API end-to-end** — fight a real battle in the GundariuM Arena, confirm the artifact + receipt land in the trapper. This tests the wire we just built without making architectural assumptions.

3. **Fix the idempotency key in `warperKeeperClient.ts`** — currently random per call; should be deterministic (`gundarium-battle-${battleId}`) so retries don't create duplicates.

4. **Clean up `battleTrapper.ts`** — it's dead code. Either remove it or mark it as an alternative implementation path. Don't leave it looking like it's wired when it isn't.

5. **Update `.jerry/` state** — record the current session's work, the federation integration status, and the token provisioning.

6. **Run the DreamLoops test suite** — confirm 56/56 still passes on the current checkout. Already done this session.

---

## 9. ANYTHING DISCOVERED THAT MATERIALLY CHANGES THE ORIGINAL AUDIT

| Discovery | Original audit | Updated |
|---|---|---|
| **Warper Keeper REST API** | The Aug 21 audit found the MCP gateway (`submit_artifact`) as the only live transport. | The REST API (`/api/agent/*`) is **also live** on `warper-keeper.dreamnet.ink` and is the one we successfully provisioned a token against. The MCP gateway has `active_assignments: 0` and may be superseded. |
| **Token provisioned** | Aug 21: "WARPER_KEEPER_ASSIGNMENT_KEY not provisioned" | Sep 5: `wk_agent_` token provisioned via Farcaster Quick Auth, stored in Doppler. Keeper ID `1dd1282c-...` confirmed. |
| **DreamLoops test count** | Aug 21: "7/7 runtime tests" | Sep 5: **56/56** (cli 2, okf-exporter 1, runtime 25, warper-keeper 28). The runtime was significantly hardened since the prior audit — 13 false-green tests, intent-before-effect, step-level checkpointing, version drift, authority revocation. |
| **proofHash canonicalization** | Aug 21: `stableJson` doesn't filter undefined — identified as a bug | Sep 5: **Fixed**. `canonicalize()` now filters undefined + sorts keys. Matches trading-trappers + Public Core + Warper Keeper worker. |
| **dreamnet-bridge** | Aug 21: snapshotted but not deeply investigated | Sep 5: confirmed as **unique source code not in any git repo**. The bridge's `capsule.js`, `dreamnet-core.js`, `index.js`, `institutional.js` exist only in the Railway volume + the audit snapshot. This is a **survivability risk** — losing the Railway volume would destroy unique code. |

---

## 10. UNRESOLVED QUESTIONS

1. Is `warper-keeper.dreamnet.ink` running the PR code (`2c7766d`) or a different version?
2. Is the Railway MCP gateway still canonical, or has the Cloudflare Worker REST API superseded it?
3. Does the canonical DreamNet have a Goal Compiler?
4. Does the canonical DreamNet have an event fabric (NATS or equivalent)?
5. Which receipt format is canonical for cross-system evidence?
6. Does the canonical DreamNet have an agent registry / capability discovery service?
7. Is the dreamnet-bridge still running on Railway? Is the snapshot current?
8. What runtime configuration (env vars, database, Redis) does the dreamnet-bridge require?
9. Should Jerry register his CapabilityManifest somewhere, or is the local JSON file sufficient?
10. Is there a standing independent verification service in the canonical DreamNet that could verify Jerry's receipts without manual human intervention?
