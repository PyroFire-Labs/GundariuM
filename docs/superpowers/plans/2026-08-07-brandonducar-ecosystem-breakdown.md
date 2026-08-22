# The BrandonDucar / DreamNet Ecosystem — What's Actually There

**Scope:** all 26 public repositories under `github.com/BrandonDucar`, plus three live production endpoints that were actually called, not just read about. Everything below is either read directly from a repo's own README or observed from a real HTTP/MCP response — nothing here is guessed.

---

## The one finding that changes what GundariuM builds next

The real, live Warper Keeper Agent Gateway was found and called directly:

```
https://warper-keeper-agent-gateway-production.up.railway.app
```

Its actual tool list — read straight from its public `/.well-known/agent.json` and confirmed again via a live MCP `tools/list` call — is:

```
get_assignment · open_trapper · append_context · submit_artifact ·
request_approval · close_trapper · release_assignment · verify_proof
```

**There is no `submit-battle-receipt` tool, and no `gundarium:battle:submit-readonly` capability, anywhere in the live gateway.** A battle receipt would go in through the generic `submit_artifact` tool instead — its `payload` field is an open object, exactly shaped to carry whatever GundariuM sends. An unauthenticated test call confirms the real auth model too: `tools/call` without a key returns `{"error":"assignment_key_required","status":401}` — a per-assignment key, not a generic bearer token, which is a different credential shape than what GundariuM's Stage 0 code currently assumes.

This doesn't invalidate the Stage 0 work already done — the determinism fix, the replay logic, and the receipt-shape design are all still correct and reusable. It changes one thing: which tool gets called and how the key is obtained. Worth fixing before pursuing credentials further, and covered at the end of this doc.

---

## The ecosystem in one picture

Every repo fits somewhere in one pipeline, laid out explicitly in the profile repo's own README:

```text
Human goal
  -> assignment                          (Dreamnet public-core)
  -> capability Capsule                  (dreamloops)
  -> bounded DreamLoop                   (dreamloops)
  -> authorized tools and models
  -> execution
  -> producing Claim Factory             (dreamnet-claim-factory)
  -> independent Verification Factory    (dreamnet-claim-factory)
  -> receipt and Proof Drop              (dreamnet-git-grid, proof-drop-zabal)
  -> durable graph and memory            (memory-weaver)
```

Everything upstream of "execution" is about *deciding what an agent is allowed to do and proving it did that*. Everything downstream is about *turning what happened into evidence nobody has to take on faith*. Security (Cerberus), identity (DreamNet ENS), and cross-system exchange (Spore SDK, Warper Keeper) sit alongside that spine rather than inside it.

---

## Repository map

Grouped the way the ecosystem groups itself, not alphabetically.

### Core contracts & runtime

| Repo | What it is | Status |
|---|---|---|
| **Dreamnet** (`Dreamnet`) | The typed public contracts: Assignment Envelope, Receipt Envelope, Capsule. Already installed in GundariuM's workspace as `@dreamnet/public-core`. | Real, `0.1.0`, live |
| **dreamloops** | Governs *how* bounded agent work runs — Capsules (capability grants), DreamLoops (bounded operating loops), succession/recovery/lineage. Contains the `warper-keeper` client kit already found earlier this session. | Real, tested |
| **dreamnet-temporal** | Reference harness for Temporal workflows (retries, compensation, replay-safety) — the durable execution engine DreamNet plans to run assignments on. Currently a generic money-transfer tutorial adapted for the pattern, not GundariuM-specific. | Early reference, fork |

### Trust & verification

| Repo | What it is | Status |
|---|---|---|
| **dreamnet-claim-factory** | Turns evidence into claims without letting a system certify its own work — producer/verifier independence enforced structurally. Already checked out locally, **16/16 tests pass**. | Real, tested, run |
| **dreamnet-git-grid** | Git-as-durable-ledger for events, receipts, snapshots. Already checked out locally, used to build `gundarium-battle-receipts`, **4/4 tests pass**. | Real, tested, run, **already integrated** |
| **dreamnet-cerberus** | Static, offline supply-chain scanner — inspects an untrusted repo/package *before* install, without running it. Catches lifecycle-script abuse, prompt injection in repo instructions, credential harvesting, unpinned deps. Green/Yellow/Orange/Red verdicts, same routing model as the Claim Factory. | Real, has CI badge |
| **toolgym** | "An agent doesn't earn mastery because it claims a skill." Deterministic workout receipts → qualification → proctored field exam → signed mastery credential (ECDSA P-256). Public API, live alpha. | Real, live, public API |
| **dreamnet-quorum-lab-ethnyc** | ETHGlobal NYC 2026 hackathon build — 31 simulated agents vote on a scenario, produces a forecast receipt with disagreement/confidence/lineage. Explicitly execution-blocked (`/api/execute/*` → `403`). | Real, live demo, hackathon-scoped |
| **dreamnet-institutional-protocol** | The one that ties everything above into one story: competency → bounded work → receipt → claim → counterclaim → independent verification → cross-organism Spore → reputation. Has a live five-minute guided demo. | Real, live demo, `0.1.0` |
| **proof-drop-zabal** | Tiny local-only build-receipt maker — hashes a proof photo, generates a portable JSON receipt. Purpose-built for one hackathon's submission flow, not general infrastructure. | Real, narrow-purpose |

### Cross-system exchange (the actual interoperability layer)

| Repo | What it is | Status |
|---|---|---|
| **dreamnet-spore-sdk** | **This is the real "SporeEnvelope."** Portable contracts (`StandardObservation`, `PortableAssignment`, `CapabilityManifest`, `WorkResult`, `ProofArtifact`, `PortableReceipt`, `PortableClaim`) plus a `BloodstreamPipeline` for canonicalization, dedup, and transport (in-memory or Redis Streams today; NATS and Cloudflare Queues on the roadmap). Explicitly: *"lets another runtime participate in DreamNet without sharing DreamNet's database, deployment topology, or model provider."* | Real, early alpha (`0.1.0-alpha.1`) |
| **warper-keeper** | The actual product — a live Farcaster Mini App at `warper-keeper.dreamnet.ink`. Catch sources/notes/links/GitHub repos, bundle into a Trapper, share a read-only link or export the whole thing as JSON. This is what produced the `gundariumWarpKeeper.json`/`gundariumwarptrapper.json` files already sitting in the GundariuM repo. | Real, live, public beta |
| **warper-keeper-trapper-sdk** | Programmatic `.trapper` file creation and verification — `createArchive`, `verifyArchive`, `extractBlobs`, capability/permission enforcement, Merkle-rooted per-file hashing. A real CLI (`trapper verify/info/extract/create`) and library, matching the exact `warper-keeper-trapper/1` schema version already seen in GundariuM's exported Trapper file. | Real, ready to install from GitHub |
| **dreamnet-trading-trappers** | **The best template in the whole ecosystem for what GundariuM should build.** A small Cloudflare Worker that builds, validates, and converts a domain-specific "Trapper" (market thesis → paper trade) into a portable Warper Keeper bundle — exposed as both REST (`/v1/trappers/build`, `/v1/trappers/validate`, `/v1/trappers/to-warper`) and public, credential-free MCP tools. Deployed and live. | Real, live, deployed |

### Identity & discovery

| Repo | What it is | Status |
|---|---|---|
| **dreamnet-ens** | ENS/Basename-compatible agent identity — human-readable names resolving to a typed profile (wallet, capabilities, endpoints, evidence). Explicit: *"a readable name is a discovery pointer; trust still requires verification."* Research prototype, not a production registrar. | Public research prototype |

### Live user products (proof the pattern works end-to-end)

| Repo | What it is | Status |
|---|---|---|
| **dreamnet-whale-league** + **-site** | Paper-only trading arena — market map, charting, PvP paper rounds, verifiable receipts, and (notably) the same `warper-keeper-trapper/1` export format GundariuM's Trapper uses. Publishes its own `/.well-known/agent.json` and both a credential-free public MCP (paper trades) and the real, key-gated Warper Keeper MCP. | Real, live, in production |
| **memory-weaver** | Local-first personal knowledge tool — ingests docs/repos/conversations, extracts topics and relationships, flags duplicates/contradictions, exports as `.weave.json`/`capsule.md`/`trapper.json`. Encrypted local vault, MCP server over stdio, no hosted backend required. | Real, public alpha |
| **dreamnet-intelligence-atlas** | Live OSINT-style map (real USGS/NASA event feeds), evidence-classified claims (`OBSERVED`/`DERIVED`/`ESTIMATED`/`CONFIRMED`...), Gemini-assisted briefings with deterministic fallback, Warper Keeper-compatible export. | Real, `v0.1` |
| **dreamnet-quillcode** | Compiles quorum-approved agent proposals (31-agent vote, ≥22 needed) into a branch-ready build brief. Explicitly does not deploy, sign, spend, or post — a proposal compiler, not an actuator. | Real, narrow-purpose |
| **dreamnet-songs** | Static site pattern for song drops with machine-readable metadata + receipts. Creator-experiment territory, not agent infrastructure. | Real, narrow-purpose |

### Not DreamNet-specific (same author, different projects)

| Repo | What it is |
|---|---|
| **pi-boost** | Pi Network mining companion PWA — unrelated product, no DreamNet ties. |
| **FlockGPScameras** | Two-line README, GPS camera fleet tracking prototype — too early to assess. |
| **wavewarz-gravity-board** | Standalone analytics prototype using *simulated* battle telemetry for a different game (WaveWarZ/ZAO), not wired to a live source yet. |
| **zabal-recording-scout** | A workshop-recording discovery board for the ZABAL Gamez community event — content curation, not infrastructure. |

---

## What GundariuM/AgentLarry can actually leverage, concretely

Ranked by how directly usable each is today, not by how interesting it sounds.

**1. Fix the integration to call the real gateway.** GundariuM's `warperKeeperClient.ts` currently POSTs to a made-up `/agent/capabilities/submit-battle-receipt` REST path with a plain bearer token. The real, live gateway speaks MCP JSON-RPC at `/mcp`, exposes `submit_artifact` (not a battle-specific tool), and requires an **assignment-bound key**, confirmed by a live `401 assignment_key_required` response. This is a small, concrete code fix, not a design problem — see the end of this doc.

**2. Build a `dreamnet-trading-trappers`-style Worker for battles, not a Next.js API route.** That repo is a working, deployed, real example of exactly GundariuM's Stage 0 shape: build → validate → convert-to-Warper-bundle, exposed as both a public stateless MCP (no credentials, matches the "read-only" Stage 0 constraint perfectly) and a REST API. GundariuM's current design (a Next.js route calling out to Warper Keeper) works, but a small standalone Worker mirroring this pattern would be consistent with how the rest of the ecosystem actually federates, and the trading-trappers source is right there to copy from.

**3. Use `warper-keeper-trapper-sdk` instead of hand-building payloads.** Rather than guessing at what shape a "battle receipt" POST body should have, `createArchive`/`verifyArchive`/`extractBlobs` build and validate real `warper-keeper-trapper/1` bundles — the same format already sitting in GundariuM's own exported `gundariumwarptrapper.json`. This removes a whole category of "did I get the schema right" risk.

**4. `dreamnet-spore-sdk` is the actual answer to "how do independent systems trust each other's evidence" — worth adopting once past alpha.** Its `StandardObservation`/`PortableReceipt`/`ProofArtifact` contracts, deterministic canonicalization, and dedup are precisely the SporeEnvelope-shaped thing this whole spike has been chasing. It's `0.1.0-alpha.1` — early — but it's the one repo explicitly designed for "let another runtime participate without sharing DreamNet's database or deployment topology," which is exactly GundariuM's situation.

**5. Cerberus is worth running once, cheaply, before pulling any of these packages into production.** GundariuM is about to depend on source pulled from a third party's git repos (`github:BrandonDucar/...` dependencies already exist in the root `package.json`). Cerberus exists specifically to scan exactly that kind of dependency before it runs — offline, no install required, green/yellow/orange/red verdict. Costs one command, closes a real supply-chain gap that currently has zero coverage.

**6. ToolGym is a real, live way to make "AgentLarry" a verifiable identity, not just a name.** If GundariuM/DreamNet ever wants Larry's work itself to carry credentialed evidence (not just GundariuM's battle data), ToolGym's public API already issues signed, verifiable mastery credentials for agents that pass its workouts. Not urgent, but it's live today, not aspirational.

**7. Everything else is context, not infrastructure to build on yet.** Institutional Protocol's live demo is worth watching once to see the whole pipeline in motion end to end. Whale League, Memory Weaver, and Atlas are proof the pattern produces real products, not just contracts — useful as reference, not something GundariuM integrates with directly.

---

## The concrete fix this unlocks

`src/lib/federation/warperKeeperClient.ts` should call the real gateway:

- **Transport:** `POST https://warper-keeper-agent-gateway-production.up.railway.app/mcp`, standard MCP JSON-RPC (`tools/call`), not a bespoke REST path.
- **Tool:** `submit_artifact`, with the battle receipt (`battleId`, `result`, `proofHash`) as its `payload`.
- **Auth:** an assignment-bound key (confirmed via a live `401 assignment_key_required` test), not a generic bearer token — this needs to come from ghostmintops as the gateway operator, scoped to a GundariuM assignment.
- **Everything else already built stays correct** — the determinism fix, `replayBattle`, and the server-side proof-hash recomputation don't change; only the last hop (how the receipt actually gets sent) does.
