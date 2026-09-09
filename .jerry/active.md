# GundariuM — Active Work

Last updated: 2026-09-09 (Session 3)

## Current task

- Task: Deploy `gundarium-battle-trappers` Worker to Cloudflare, then scope 3D rendering engine.
- Status: Worker code complete, tested locally; needs Cloudflare deploy.
- Scope: `worker-battle-trappers/` for Worker; `worker/` and `src/` for 3D pipeline.

## Approved goals

### Priority 1 — DreamNet Stage 0 Federation (COMPLETE — REARCHITECTED)

- Goal: Fix the federation code to match the real DreamNet integration pattern.
- Status: **COMPLETE** — all fixes shipped, `tsc` clean, lint clean, determinism parity verified, end-to-end test passing.
- Source: user directive ("Larry got it wrong — READ EVERYTHING").

#### What was actually wrong (CONFIRMED)

The original spike called Warper Keeper gateway's `submit_artifact` MCP tool directly with a bearer token. **This is wrong** — the gateway requires an **assignment-bound key** (issued by ghostmintops), not a generic `wk_agent_*` token. The `wk_agent_*` token is for the Mini App UI (Quick Auth), not the agent gateway.

#### The real pattern (mirrors dreamnet-trading-trappers) — CONFIRMED

1. **gundarium-battle-trappers Worker** (Cloudflare Worker) exposes public, credential-free MCP:
   - `build_battle_trapper` — builds `gundarium-battle-trapper/1` with proofHash
   - `validate_battle_trapper` — validates structure + receipt integrity
   - `to_warper_keeper_bundle` — converts to `warper-keeper-trapper/1` bundle
2. **Frontend route** (`/api/federation/submit-battle-receipt`) calls Worker's public MCP via `BATTLE_TRAPPERS_URL` env
3. **Worker can optionally forward to Warper Keeper gateway** internally with proper assignment key — not the frontend's responsibility

#### What's done (CONFIRMED)

| File | Status |
|------|--------|
| `worker-battle-trappers/src/contract.ts` | Complete — canonicalization, build, validate, toWarperBundle |
| `worker-battle-trappers/src/schema.ts` | Complete — JSON Schema for battle trapper |
| `worker-battle-trappers/src/types.ts` | Complete — TypeScript types |
| `worker-battle-trappers/src/index.ts` | Complete — Hono Worker with MCP + REST endpoints |
| `worker-battle-trappers/wrangler.jsonc` | Complete — Cloudflare Worker config |
| `src/lib/federation/warperKeeperClient.ts` | Rewritten — calls Worker's public MCP |
| `src/app/api/federation/submit-battle-receipt/route.ts` | Updated — passes replayInputs to client |
| Local test (port 8787) | All MCP tools working |
| End-to-end test (Next.js + Worker) | `submitted: true`, trapperId + bundleId returned |

#### Remaining to deploy

- `CLOUDFLARE_API_TOKEN` needed for `wrangler deploy`
- Set `BATTLE_TRAPPERS_URL` in Vercel env to production Worker URL

### Priority 2 — 3D rendering engine (NEXT)

- Goal: render a 3D mech for every minted NFT that matches the NFT, with visual animation during battles.
- Status: approved by Josh, fully scoped, deferred until DreamNet Stage 0 is fixed. **Now unblocked.**

#### What exists right now (CONFIRMED from reading all files)

The pipeline is **complete and working** with placeholder geometry:

1. **Worker** (`worker/src/worker.ts`, 116 lines) — polls Redis queue, spawns headless Blender, uploads GLB to IPFS via Pinata, writes status to Redis
2. **Blender assembly** (`worker/blender/assemble.py`, 123 lines) — orchestrates: reset scene → build frame → build head → build weapon → build backpack → apply special → apply materials → parent under root empty → bake animations → export GLB
3. **Placeholder geometry** (`worker/blender/lib/components.py`, 307 lines) — builds blocky mecha from primitives (boxes, cylinders, cones), deterministic per `sha256(category:traitName)`. 8 frame archetypes, color keyword mapping (~34 colors), weapon classification (blade/beam/heavy/rapid/remote), backpack classification (wings/drive/pack), special effects (Trans-Am, psychoframe, gold trim)
4. **Battle animations** (`worker/blender/lib/animation.py`, 269 lines) — procedural keyframe animations per weapon archetype: blade (swing+lunge), beam (recoil), heavy (recoil+lean), rapid (jitter), remote (deploy), special (scale pulse). 24fps, 1-24 frame range, exported as NLA strips
5. **Frontend viewer** (`src/components/card/Model3DViewer.tsx`, 67 lines) — 2D image by default, "VIEW IN 3D" toggle when ready, uses `@google/model-viewer` with camera-controls + auto-rotate
6. **Status polling** (`src/lib/hooks/useModelStatus.ts`, 72 lines) — polls `/api/model-status/[tokenId]` every 5s for ~5 min, states: unknown → pending → processing → ready/failed
7. **Queue trigger** (`src/lib/queueModelGeneration.ts`, 40 lines) — fire-and-forget POST from MintConfirm after tokenId known
8. **Battle viewer** (`src/components/battle/BattleModel3DViewer.tsx`) — separate viewer for arena/battle page

#### What the placeholder geometry IS

- Procedural primitives: boxes for torso/shoulders, cylinders for limbs, cones for horns
- Same trait name → same shape + color (deterministic via SHA-256 seed)
- Different traits produce visibly different silhouettes
- Materials: Principled BSDF with colorway-parsed base/accent, metallic flag for chrome/silver/gold
- Special effects: Trans-Am (emissive red disc), psychoframe (3 emissive green rings), gold trim (accent material weighting)
- Animations: 4 archetype motions (blade swing, beam recoil, heavy recoil, rapid jitter) + remote deploy + special pulse

#### What the placeholder geometry IS NOT

- Not hand-modeled Gunpla components
- Not the ~94 distinct trait options as actual 3D art
- Not an armature/rig — all animation is transform keyframes on objects
- Not material property animation (emission strength keyframing crashes Blender 5.0's exporter)
- Not battle cinematics (rendered MP4 of both models after PVP match)

#### What needs to happen to move from placeholder to real

1. **Real 3D asset library** — hand-model or source Gunpla component .blend files for all ~94 trait options:
   - 8 frame types (Heavy Armor, Mobility, Sniper, Commander, Berserker, Stealth, Full Armor, Standard)
   - ~22 head types (Twin Horn, V-fin, Visor, Mono-eye, Crest, Blade antenna, etc.)
   - ~35 weapon types (Beam Rifle, Heat Hawk, Bazooka, Funnel, Dragoon, etc.)
   - ~29 backpack types (Flight Unit, Wing Binder, Drive, Reactor, etc.)

2. **Asset swap mechanism** — the existing `build_*` functions in `components.py` already have the right contract: each returns `(objects, sockets)` where sockets are `mathutils.Vector` world positions. Replace the primitive-building body with `bpy.data.libraries.load` + `bpy.ops.wm.append` from an asset .blend, keyed by the same trait-name lookup. assemble.py's orchestration doesn't change.

3. **Hosting** — the worker needs a real host with Blender + Node 20+. Currently nothing is deployed. Options: VM, container, or eventually Hermes. Not Vercel (can't run Blender).

4. **Battle animation integration** — the arena page (`src/app/arena/page.tsx`) currently uses the deterministic sim for gameplay. The GLB animations (primary_attack, secondary_attack, etc.) could be triggered on the frontend via `@google/model-viewer`'s animation API during battle turns. This is frontend work, not worker work.

5. **Battle cinematics** (stretch) — rendered MP4 of both models after a PVP match settles. Same worker, second job type. Out of scope until GundaniumGame is on mainnet.

### Priority 2 — Jerry project brain

- Goal: persistent project-brain structure for GundariuM.
- Status: COMPLETE — all files exist and are updated.
- CONFIRMED: `.jerry/README.md`, `.jerry/state.md`, `.jerry/context.md`, `.jerry/active.md`, `.jerry/done.md`, `.jerry/log.md`, `.jerry/schemas/*`, `.jerry/receipts/`

## Waiting / blocked

- Worker deploy blocked on `CLOUDFLARE_API_TOKEN` (Josh to provide or run deploy)
- Unknowns carried forward:
  - WARPER_KEEPER_ASSIGNMENT_KEY status — UNKNOWN (no longer needed for Stage 0)
  - Live contract addresses — UNKNOWN
  - Live env var set — UNKNOWN
  - DreamNet receipt round trip — UNKNOWN (Worker can forward internally once deployed)

## Task selection rule

Jerry picks the smallest approved atomic task that moves the current priority forward without touching forbidden areas. If a task needs Josh's authority, it is marked NEEDS_APPROVAL and paused.