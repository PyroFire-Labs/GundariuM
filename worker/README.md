# GundariuM 3D Model Worker

Turns every mint's rolled traits into a 3D model (GLB), automatically,
alongside the existing Gemini 2D card art. This is a **standalone package**,
deliberately decoupled from the Next.js app — it runs wherever headless
Blender is installed, which is not Vercel (no long-running native processes,
no Blender binary available there).

**No host is provisioned for this yet.** The original plan called for
running it on "Hermes" (the team's planned agent/worker platform), but as of
this pass Hermes doesn't exist. This package runs standalone on any machine
with Node 20+ and `blender` on `PATH` — a VM, a spare box, eventually Hermes
once it's stood up. Nothing here is Hermes-specific.

## Architecture

```
Mint succeeds (MintConfirm.tsx, tokenId known)
        │  fire-and-forget POST
        ▼
POST /api/generate-model  (Next.js, src/app/api/generate-model/route.ts)
        │  LPUSH
        ▼
Redis list "model:jobs"  (Upstash — same instance as the main app)
        │  RPOP (polled, not blocking — Upstash REST has no BRPOP)
        ▼
worker.ts main loop
        │  spawn
        ▼
blender --background --python blender/assemble.py -- traits.json out.glb
        │
        ▼
GLB uploaded to IPFS (Pinata)
        │  redis.set
        ▼
Redis key "model:status:<tokenId>"  ({ status, uri })
        │  polled by
        ▼
GET /api/model-status/[tokenId]  →  card page / mint success screen
```

The GLB URI is **not** embedded in the NFT's on-chain `tokenURI` metadata —
that JSON is pinned and referenced before the tokenId even exists (mint
happens after IPFS upload), and pre-rendering a model for every reveal
(including discarded rerolls) would multiply worker cost for nothing. The
model is looked up out-of-band by tokenId instead, same pattern as
`leaderboardStore.ts`'s off-chain cache.

## Placeholder geometry — read this before judging how it looks

`blender/lib/components.py` does **not** contain hand-modeled Gunpla art.
Modeling real components for all ~94 distinct trait options (8 frame types,
22 heads, 35 weapons, 29 backpacks) is a 3D-art task, not a scripting one,
and no such assets exist yet. Instead it procedurally builds a blocky
placeholder mecha from primitives (boxes, cylinders, cones), seeded
deterministically by `sha256(category:traitName)` — the same trait name
always produces the same shape and color, and different traits produce
visibly different silhouettes, but none of it is meant to look final.

**This is a real, working, swappable pipeline today.** Every mint gets an
actual unique GLB. When real art exists:

- Replace the body of `build_frame` / `build_head` / `build_weapon` /
  `build_backpack` in `components.py` with "append the matching object(s)
  from an asset library `.blend`" (`bpy.data.libraries.load` +
  `bpy.ops.wm.append`), keyed by the same trait-name lookup.
- `assemble.py`'s orchestration, the socket contract (`sockets["head"]`,
  `["hand"]`, `["back"]` as world-space `Vector`s), and everything
  downstream (queue, worker, upload, API, viewer) do not need to change.

## Running it

```bash
cd worker
npm install
BLENDER_BIN=blender \
UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
PINATA_JWT=... PINATA_GATEWAY=... \
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
npm run worker
```

Same Doppler project as the main app has all of these except `BLENDER_BIN`
(not a secret, just wherever Blender lives on the host):

```bash
doppler run --project gundarium --config prd -- npm run worker
```

Requires `blender` on `PATH` (or `BLENDER_BIN` pointing at the binary).
Tested against Blender 5.0.

## Testing the Blender script directly (no queue, no Node)

```bash
cd worker/blender
cat > /tmp/traits.json <<'EOF'
{
  "tokenId": "1",
  "frameType": "Heavy Armor",
  "head": "Twin Horn",
  "primaryWeapon": "Beam Rifle",
  "backpack": "Flight Unit",
  "colorway": "Federation White & Blue",
  "special": "Trans-Am burst (red energy aura)"
}
EOF
blender --background --python assemble.py -- /tmp/traits.json /tmp/out.glb
```

Requires `numpy` importable by Blender's Python (Blender 5's Ubuntu package
uses the system interpreter — `apt-get install python3-numpy` covers it; a
self-contained Blender download bundles its own Python and needs numpy
installed into that instead).

## Open questions / not done here

- **Hosting.** Nothing is deployed. Whoever stands up the actual host (VM,
  container, eventually Hermes) needs Blender + Node 20+ on it and the env
  vars above.
- **Real 3D assets.** See the placeholder-geometry section above.
- **Battle cinematics** (per the original roadmap: a Blender-rendered MP4 of
  both cards' models after a PVP match settles) — out of scope for this
  pass, but the same worker process is the natural place to add a second job
  type once GundaniumGame is on mainnet.
- **Retry/backoff on a stuck job.** A job that crashes blender leaves its
  tokenId `"failed"` in Redis and alerts Telegram, but nothing currently
  re-enqueues it automatically — that's a manual re-POST to
  `/api/generate-model` today.
