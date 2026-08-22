# Warper Keeper Agent Delegation — Review + Delegation Design

**Reviewing:** `warper-keeper` PR at exact head `2c7766d90804a11531b04fb1ace6d39f7ea46f6a`
("feat(agent-access): add scoped Warper Keeper delegation", Brandon Ducar,
Aug 8 2026), branch `origin/codex/agent-delegation-v1`. **Not merged. Not
deployed.** This doc does not merge, deploy, or issue any production
credential — per Josh's explicit instruction.

**Relationship to prior work:** this is a different Warper Keeper surface
than [[2026-08-07-dreamnet-stage0-federation-spike]]. That doc covers the
already-live **Railway MCP gateway**
(`warper-keeper-agent-gateway-production.up.railway.app`, per-assignment
bearer key, 8 fixed tools, no self-serve grants). This PR is a *different,
unmerged* delegation layer on the **Mini App itself** (Cloudflare Worker +
D1), where the **Farcaster owner** (Josh) self-serves scoped grants to named
agents. They are not the same system and should not be conflated — see the
"Two Warper Keeper surfaces" section below.

**Grounding legend:** same as the federation spike doc — `CONFIRMED` (read
directly from code at the pinned commit), `PROPOSED` (this doc's design, not
yet built), `OPEN` (a real decision this doc surfaces rather than guesses at).

---

## Two Warper Keeper surfaces — do not conflate them

| | Railway MCP Gateway | This PR (Mini App delegation) |
|---|---|---|
| Where | `warper-keeper-agent-gateway-production.up.railway.app` | Cloudflare Worker, `github.com/BrandonDucar/warper-keeper` |
| Status | **Live in production today** | Unmerged branch, no deployment |
| Auth | Per-assignment bearer key, issued manually by ghostmintops | Owner (Farcaster Quick Auth) self-serves `wk_agent_*` grants via `/api/miniapp/agent-grants` |
| Surface | Fixed MCP tool set (8 tools) | REST at `/api/agent/*`, JSON bodies, permission strings |
| GundariuM's current integration | `warperKeeperClient.ts` targets this one, blocked on a credential | Not integrated anywhere yet |

Everything below is about the **second** row only. `CONFIRMED`.

---

## 1. Tenant boundary matrix

`CONFIRMED` from `db/schema.ts` and `worker/agent-delegation.mjs` at the
pinned commit.

| Boundary | Enforced by | Mechanism |
|---|---|---|
| Owner ↔ grant | `agentGrants.ownerFid` | Every grant is stamped with the issuing Farcaster FID at creation; owner routes require Quick Auth, so only the authenticated owner can create/renew/rotate/revoke their own grants. |
| Tenant ↔ agent identity | `agentGrants.tenantId`, `agentGrants.agentId` | Both normalized (`normalizeIdentity`: lowercase, `[a-z0-9._-]`, 1–63 chars) and required — a grant is always scoped to one `(tenantId, agentId)` pair, e.g. `(gundarium, larry)`. |
| Agent ↔ Keeper | `agentGrants.keeperIdsJson`, checked by `assertKeeperAccess` | A grant lists explicit `keeperIds` (max 32), validated at creation against the *owner's own* Keepers (`ownerKeeperIds`) — an owner cannot grant access to a Keeper they don't own, and an agent cannot touch a Keeper outside the list. |
| Agent ↔ operation | `agentGrants.permissionsJson`, checked by `assertPermission` | Grant lists explicit permissions from a **closed, 7-value enum** (`AGENT_PERMISSIONS`). Anything not in that enum is structurally impossible to grant — not just denied by convention. |
| Grant ↔ time | `expiresAt`, `revokedAt` | TTL clamped 5 minutes–90 days at creation *and* renewal (`MIN_GRANT_TTL_MS` / `MAX_GRANT_TTL_MS`). `parseGrantRow` computes `active` from both fields on every read — no separate "is this still valid" cache to drift out of sync. |
| Token ↔ grant | `agentTokens.tokenHash` (unique), never the raw token | Tokens are `wk_agent_<32 random bytes, base64url>`, shown once, stored only as SHA-256 hashes. A leaked database dump cannot be replayed as credentials. |
| Write ↔ replay | `Idempotency-Key` header + `agentGrantEvents`/`agentReceipts` unique index on `(grantId/ownerFid, action, idempotencyKey)` | Same key + same action can't double-write. |
| Spore assertion ↔ replay | `agentSporeNonces` (primary key `requestId`), 5-minute max lifetime, 60s clock skew | `CONFIRMED` timing-safe HMAC comparison in `verifySporeAssertion` (constant-time XOR loop, not `===`). |

**What's structurally absent, not just denied** — `CONFIRMED` by reading the
full `AGENT_PERMISSIONS` array (`worker/agent-delegation.mjs:12-19`):

```
artifact:add, keeper:read, receipt:create, source:add,
source:read, trapper:read, trapper:write
```

There is no `keeper:delete`, `sharing:public`, `proof:certify`,
`wallet:execute`, or `deploy:production` permission *anywhere in the enum*.
Josh's instruction to "explicitly deny" those is already satisfied more
strongly than a deny-list — they don't exist as grantable strings, so no
grant, however broad, can ever include them. This is the single most
important finding of this review: the "Larry must never receive... signing
roots... self-certify claims" invariant is enforced at the type/schema level
here, not just by policy.

---

## 2. Delegation and capability manifest

`CONFIRMED` grant lifecycle, from `worker/agent-api.ts` + `agent-delegation.mjs`:

```
Owner (Farcaster Quick Auth)
  → POST /api/miniapp/agent-grants  {tenantId, agentId, keeperIds, permissions, expiresAt}
  → grant row + (optional) one-time wk_agent_* token, shown once, stored as SHA-256
  → agent authenticates: Authorization: Bearer wk_agent_...  OR  signed Spore assertion
  → every read checks assertKeeperAccess + assertPermission before touching data
  → every write also requires Idempotency-Key, produces a receipt row
  → owner can renew (extend expiry), rotate (new token, same grant), or revoke (kills grant + tokens)
```

**Capability manifest for a `larry` / `gundarium` grant**, `PROPOSED` as the
Stage 0 shape (mirrors Josh's instruction exactly):

```jsonc
{
  "tenantId": "gundarium",
  "agentId": "larry",
  "keeperIds": ["gundarium-launch"],
  "permissions": ["keeper:read", "trapper:read", "source:read"],
  "expiresAt": "2026-09-17T00:00:00.000Z"   // 30 days, within the 5min-90day bound
}
```

Explicitly **not** requested, and not grantable even if it were:
`trapper:write`, `source:add`, `artifact:add`, `receipt:create`, or anything
touching Keeper deletion, public sharing, proof certification, wallet
execution, or production deployment — none of the last five exist as
permission strings at all.

**Authority boundary, restated in the schema's own terms:** a grant's
`agentReceipts` rows record what Warper Keeper *accepted*, not what's
*true*. `docs/agent-delegation.md` (in the PR) states this directly:
"independent Claim Factory or quorum verification is still required before a
claim or competency can be certified." That's the *documented intent*, and
it matches Josh's "Larry may submit evidence... may not verify his own
claims" instruction exactly — **but a full code review (below) found the
implementation doesn't actually hold that line.** The intent is right; the
code has a real bug that undermines it. Don't take the doc's word for this
one — see finding #1.

---

## Code review findings (`/code-review high`, full pass against master)

Five findings, most severe first. None of these block the read-only-only
canary below (`keeper:read`/`trapper:read`/`source:read` never touch the
affected code paths), but #1 is a hard blocker on ever granting
`receipt:create` — which the Stage 0 grant proposal above already excludes,
now for a concrete reason rather than just caution.

1. **Critical — agents can overwrite the owner's authoritative receipt and the UI shows it as certified.** `receipt:create` writes land in the *same* legacy `receipts` table the owner's real trapper-closure receipt uses (`worker/agent-api.ts:1190`), and the ownership check here (`ownedTrapper`) skips the `openOnly=true` guard used elsewhere — so an agent can inject a receipt *after* the owner has closed the trapper. Both `/api/miniapp/state` and the public share route pull `receipts` by `ORDER BY created_at DESC LIMIT 1`, so the agent's self-attested row silently becomes the one shown. Worse: the agent payload has no `title`/`result` field, so the UI (`warper-keeper-app.tsx` ~line 1972) falls back to rendering the literal string **"Task completed" next to a ShieldCheck badge** — an agent's unverified, possibly-failed self-report renders as an owner-certified success, to the owner and to anyone with the public share link. This is exactly the "self-certify claims" failure mode Josh's instruction named directly, happening at the UI layer despite `certification: "none"` being technically set in the JSON.
2. **Idempotency replay doesn't check payload identity.** The replay lookup keys only on `(grantId, action, idempotency-key)`, never comparing the stored payload hash against a reused key's new body. A key reused with different content silently returns the stale cached response — the new write is dropped with no error, even though a `payloadHash` is already computed per receipt and could catch the mismatch.
3. **Trapper existence leaks across keeper boundaries.** `ownedTrapper()` fetches the row *before* checking keeper access, while the equivalent `ownedKeeper()` checks access first. The order difference means a real trapper ID outside an agent's granted keepers returns 403, while a fake ID returns 404 — letting an agent enumerate valid trapper IDs in keepers it was never granted.
4. **Idempotency check has a race window.** The duplicate-key check is a plain SELECT before a later INSERT, no locking — two concurrent identical requests can both pass the check and race into the unique-index constraint. The loser's D1 constraint error isn't pattern-matched by `errorResponse()`, so it falls through to a generic `500` instead of the intended clean `409`/idempotent-replay response.
5. **Duplicated hashing logic.** `canonicalJson`/`sha256Value` in `worker/agent-api.ts` are a second, independent copy of the same helpers already in `worker/index.ts` — a future fix to one won't propagate to the other, risking two different hashing behaviors across the "tamper-evident" receipt families the docs promise are consistent.

---

## 3. Shared-memory import/export contract (PRIVATE / PARTNER_SHARED / PUBLIC / EPHEMERAL)

`PROPOSED` — **this does not exist in the pinned commit.** The schema has no
`memory_class` or equivalent column anywhere in `db/schema.ts`. This section
is a design proposal, not a description of shipped code, and per Josh's "do
not merge/deploy" instruction it is *not* implemented as a commit on
Ducar's branch in this pass — implementing it there would mean pushing code
onto someone else's authored, in-flight PR without his sign-off, which is a
separate decision from reviewing it. Flagging that as a deliberate scoping
choice rather than an oversight.

**Proposed mapping onto existing tables:**

| Memory class | Definition | Default owner in current schema | Export allowed to |
|---|---|---|---|
| `PRIVATE` | Owner-only; never leaves this Keeper | `keepers`, `trappers` not explicitly shared | Nobody. Not exportable via agent routes. |
| `PARTNER_SHARED` | Explicitly granted to one or more named tenant/agent pairs | Rows referenced by an active `agentGrants.keeperIds` entry | Only the grant's own `(tenantId, agentId)` — never re-exportable to a third party by the receiving agent. |
| `PUBLIC` | Intentionally published (matches this repo's existing `dist/client` publish flow for the Mini App itself) | Anything the owner explicitly marks public (no current column — would need one) | Anyone; no grant required. |
| `EPHEMERAL` | Session-scoped, expires with the grant or a short fixed TTL, never persisted past that | New — no current analog. Closest existing pattern is `agentSporeNonces`' 5-minute TTL row. | The requesting agent only, and only for the TTL window. |

**Round-trip contract, `PROPOSED`:**
- **Export** = a receipt-producing read (`GET /api/agent/trappers/:id`, already
  a real route) plus a manifest line recording `{trapperId, memoryClass,
  exportedTo, exportedAt, contentHash}` — this manifest line is the new
  piece, not the read itself.
- **Import** = `POST /api/agent/trappers/:id/context` (already real), with the
  imported content's `contentHash` checked against the exporting manifest
  line before accepting, so a round trip is verifiably lossless rather than
  just "it went somewhere and came back."
- `EPHEMERAL` imports additionally carry a `expiresAt` no later than the
  grant's own `expiresAt`, enforced the same way `agentGrants` TTL is today.

**Open question, not guessed at:** whether `memory_class` becomes a real
column (requiring a migration, i.e. a second PR) or stays a
convention enforced entirely by which `keeperIds` a grant lists — the
existing schema can express `PRIVATE` vs `PARTNER_SHARED` today purely
through grant scoping, without any schema change. `PUBLIC` and `EPHEMERAL`
are the two classes that don't map onto anything that exists yet. `OPEN` —
worth a direct answer from Ducar before either gets built, same reasoning
the federation spike doc used for the `submit-battle-receipt` vs `emitSpike`
fork: build against the confirmed spec, not the newest unverified one.

---

## 4–5. Canary and Trapper round-trip — run, local-only, results below

Josh confirmed: local dev only, no production credential. Rather than stand
up `wrangler dev` + a fresh local D1 and hand-roll a new scenario, I ran the
PR's **own** test suite locally (`node --test` / `tsx --test`, in an isolated
git worktree at the exact pinned commit, zero network calls, zero production
credentials) — it already covers this exactly, end-to-end, against a real
in-memory D1-equivalent (`node:sqlite`):

```
tests/agent-delegation.test.mjs      7/7 pass
tests/agent-api-contract.test.mjs    2/2 pass
```

What the contract test actually proves, read off its own assertions (not
just "tests passed"):

- Owner grant issuance is idempotent — a duplicate `Idempotency-Key` returns `409`, no second row (`agent_grants` count stays 1).
- **Read**: an agent lists Keepers under its grant — `200`.
- **Write + round-trip**: agent appends context to a Trapper (`201`,
  `certification: "none"`), then replays the exact same write with the same
  idempotency key — `200`, `idempotentReplay: true`, and the underlying
  `context_items`/`trapper.context_count` rows are confirmed to have only
  incremented once, not twice. This is a genuine, verified round trip, not
  just "the call didn't error."
- **Boundary enforcement**: a write outside the grant's permissions —
  `403 AGENT_PERMISSION_DENIED`.
- **Self-certification is rejected at the API layer**: a payload carrying a
  `verdict` field is rejected outright — `400 AGENT_UNKNOWN_FIELD:verdict`.
  Worth holding next to finding #1 above: the API-level guard against an
  agent asserting its own verdict *does* work; the bug is downstream, in how
  the owner-facing UI renders a bare, verdict-free agent receipt. Both are
  true at once — one layer is solid, the other isn't yet.
- Spore-assertion replay is rejected (`401`) on reuse.
- Rate limiting fires (`429 AGENT_RATE_LIMITED`) once the window's exceeded.
- Token rotation invalidates the old token (`401` on the pre-rotation
  session) while the grant itself stays live.
- Revocation flips `grant.active` to `false` and the same fail-closed check
  applies everywhere else that reads a grant.

This satisfies item 4 (read-only canary) and the round-trip half of item 5
(context append/replay) with real, already-written, already-reviewed test
coverage — reusing it rather than writing a parallel scenario that would
just duplicate what's already proven. It does **not** cover a full
artifact/Trapper *export to a second system and reimport* — that's a
different, larger scenario (matches the "shared-memory import/export
contract" in §3, which is still `PROPOSED`, not built).

## 6. Whale League paper-only research round — not attempted this pass

`OPEN` — this is a third, separate app (`dreamnet-whale-league`) with its own
build/run setup I haven't investigated. Confirmed only that it exists, is a
paper-trading arena, and documents the same Railway Warper Keeper gateway
(not this PR's surface) in its own `agent.json`. Scoping this properly means
understanding a third codebase's local-run story before touching it — didn't
want to rush that in the same pass as the PR review. Separate follow-up if
still wanted.

---

## 7. Rollback instructions

**This document:** the only durable artifact. `rm` it or `git revert` the
commit that adds it.

**Local test run:** performed in an isolated `git worktree` at
`.../scratchpad/warper-keeper-review`, checked out to the exact pinned
commit, detached HEAD — never touched `warper-keeper`'s actual working tree
or `master` branch. Removed via `git worktree remove` after this pass;
nothing persists. Tests ran against `node:sqlite` in-memory, no D1, no
Cloudflare account, no network call, no credential of any kind — there is
nothing to roll back on the infrastructure side because nothing was created
there.

**Net effect on `warper-keeper` itself:** zero. No commit, no branch change,
no deploy, no credential, no merge. The PR is exactly as Ducar left it at
`2c7766d`.
