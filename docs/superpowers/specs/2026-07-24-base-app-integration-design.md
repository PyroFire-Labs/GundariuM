# Base App Integration — Design

**Status:** Approved, ready for implementation planning.

## Origin

Joshua asked, before resuming last night's paused verified-share-EXP design,
whether GundariuM had established a Base App connection. Checking the code
confirmed it hadn't (no `@base-org/account`, no SIWE, no Base.dev registration
— the project relies entirely on `@farcaster/miniapp-sdk` and
`/.well-known/farcaster.json`). Checking Base's own current documentation
surfaced something more urgent than a nice-to-have: **the Base App cut over
from the Farcaster mini-app spec to a "standard web app + wallet" model on
April 9, 2026** — already three-plus months in the past, not an upcoming
change. As of that date, the Base App ignores the Farcaster manifest, no
longer invokes most of the Farcaster SDK (including `composeCast`, the exact
mechanism last night's paused verified-share design depends on as its only
completion signal), and expects wagmi + viem + SIWE for wallet auth/identity.

## Decisions locked in during clarifying questions

1. **Additive, not a replacement.** GundariuM has a real, active Farcaster
   user base (Kayonfire, papusiek1111, Donald, others) via Warpcast/Farcaster
   clients today. Nothing about the existing Farcaster path changes — this
   integration adds proper Base App support in parallel, detected at runtime,
   alongside the untouched Farcaster path.
2. **Scope is wallet + identity, not deprecated-action migration.** Checked
   directly: `openInMiniAppOrBrowser`, `ShareButtons`' Farcaster share button,
   and `handleGnrmCheck`'s swap fallback (`useGnrmPurchaseCheck` /
   `tasks/page.tsx`) already gate every Farcaster-SDK action behind a
   `sdk.context.user.fid` check and fall back to plain-browser-appropriate
   behavior (`window.open`, Streme.fun) when that context isn't present. Base
   App users already fall into that same "not Farcaster" branch today with no
   code changes needed — verified by reading each call site, not assumed.
3. **No notification migration needed.** `farcaster.json`'s `webhookUrl`
   points at `/api/webhook`, but no such route exists in the codebase — there
   is no notification system implemented at all today, so nothing to migrate.
4. **Full SIWE sign-in system, not just wallet-connection reliability.**
   Explicitly the bigger of the two options: a real, general-purpose session
   layer, not merely "make sure a wallet connects inside Base App's browser."
5. **SIWE session is general-purpose infrastructure**, not scoped to a single
   feature. It's meant to be usable by any future server-verified feature —
   explicitly including a possible future replacement of the ad hoc EIP-191
   signature `useSaveLineup`/`/api/dossier/lineup` uses today, and as a
   possible building block for last night's paused verified-share-EXP design
   (once that resumes, worth asking whether a verified SIWE session could
   serve any of the same "prove this really happened" role that `composeCast`'s
   null/non-null result was going to serve — no decision made on this yet,
   just a noted connection point for that design to revisit).
6. **SIWE applies only outside Farcaster context.** Farcaster-client users
   keep relying on `FarcasterInit`'s existing auto-connect + FID exactly as it
   works today — no added signature prompt, no new friction for them. SIWE is
   the identity mechanism specifically for Base App and plain-browser
   contexts, which have no equivalent trusted auto-identity today.
7. **Sessions live in Upstash Redis**, not a stateless signed cookie — reuses
   the exact infra/pattern `lineupStore.ts` and the leaderboard cache already
   use in this codebase, easy to invalidate early, no new signing secret to
   manage in Doppler.

## Technical design

### A. Wallet connector
Add `@base-org/account` dependency; register a `baseAccount({ appName:
"GundariuM" })` wagmi connector in `src/lib/wagmi.ts` alongside the existing
`farcasterConnector`, `injected()`, `walletConnect()`. Connector priority:
Farcaster first (unchanged), `baseAccount` next (the natural default for
non-Farcaster contexts, including Base App), then the existing two as
fallbacks.

**Open implementation-time verification, not yet confirmed:** whether
`baseAccount` ships as a named export from `wagmi/connectors` in this
project's installed `wagmi@^3.5.0`, or whether it must be constructed via
`@base-org/account`'s lower-level `createBaseAccountSDK` + a custom transport
instead. Check `node_modules` directly before writing connector code — do not
assume either way.

### B. SIWE sign-in flow
- **`GET /api/auth/nonce`** — generates a nonce via `viem/siwe`'s
  `generateSiweNonce()`, stores it in Upstash with a 5-minute TTL keyed
  `siwe:nonce:<nonce>`, returns it. One-time-use: deleted the moment it's
  successfully verified.
- **`useSiweSignIn()`** (client hook) — fetches a nonce, builds the message
  via `createSiweMessage({ address, chainId, domain: window.location.host,
  nonce, uri: window.location.origin, version: "1", statement: "Sign in to
  GundariuM", expirationTime: <now + 7 days> })`, signs it via wagmi's
  `useSignMessage`, POSTs `{ message, signature }` to the verify route.
- **`POST /api/auth/siwe`** — looks up the nonce in Redis (rejects if missing
  = expired or already used), deletes it, verifies the signature via
  `publicClient.verifySiweMessage({ message, signature })`, creates a session,
  sets an httpOnly cookie.

### C. Session storage
`src/lib/session.ts` — new helper mirroring `lineupStore.ts`'s existing Redis
pattern:
- On successful SIWE verify: `session:<crypto.randomUUID()>` → `{ address }`
  in Upstash, 7-day TTL matching the SIWE message's `expirationTime`. Cookie
  holds only the opaque session ID — `httpOnly`, `secure`, `sameSite: "lax"`,
  `maxAge` matching the TTL, `path: "/"`.
- **`getSessionAddress(req): Promise<string | null>`** — reads the cookie,
  looks up Redis, returns the verified address or `null`. This is the
  general-purpose piece any future route calls to ask "is this request really
  from address X" — not wired into any existing feature as part of this pass.
- **`POST /api/auth/logout`** — deletes the Redis session and clears the
  cookie. Wired to also fire on wagmi `disconnect()` so a stale session can't
  outlive the wallet disconnect.

### D. UI integration
`ConnectButton` (`src/components/wallet/ConnectButton.tsx`) currently
hardcodes a direct `walletConnect()` connect call with no picker. Changes:
- Outside Farcaster context, the primary CONNECT action defaults to the new
  `baseAccount` connector instead of WalletConnect. WalletConnect stays
  reachable as a secondary option (exact secondary-option UI — a small
  dropdown vs. a second button — left to implementation, not a design-level
  decision).
- Once connected (non-Farcaster only) with no valid session, show a **SIGN
  IN** action next to the address that triggers `useSiweSignIn()`.
- Inside Farcaster context: fully unchanged, no sign-in step ever shown.

### E. Error handling
- Signature rejection: surfaced as "Signature cancelled" (matches existing
  wording convention from `useSaveLineup`'s error handling).
- Expired or already-used nonce: verify route returns 400; client fetches a
  fresh nonce and lets the user retry.
- Backend session verification failure: 401, client falls back to
  "not signed in" UI state rather than a hard error.

### F. Base.dev registration — human action, not code
Joshua creates a project at base.dev and fills in app metadata (name, icon,
tagline, description, screenshots, category, primary URL `https://gundarium.xyz`)
plus a Builder Code. This cannot be done by Claude — requires Joshua's own
account/ownership, same category of action as prior Discord/QuestN
registrations. Exact click-path to be handed over when implementation reaches
this point.

### G. Testing
Manual end-to-end verification in a real browser: sign-in flow completes,
cookie is set with the right attributes, `getSessionAddress` round-trips
correctly, sign-out actually clears the Redis session (not just the cookie).
Same live-verification approach used throughout this project rather than a
mocked test suite, consistent with "No test framework currently set up for
the frontend" (CLAUDE.md).

## Explicitly out of scope for this pass

- Wiring the new session layer into any existing feature (lineup save stays
  on its current EIP-191 signature mechanism; nothing is migrated to sessions
  as part of this work).
- Any change to the paused verified-share-EXP design from
  `2026-07-23-verified-share-exp-design.md` — that design resumes separately
  and may or may not end up using this session layer; no decision made here.
- Notifications (nothing exists to migrate).
- Migrating away from Farcaster-specific code anywhere — explicitly additive.
- Deprecated Farcaster SDK action replacements (`composeCast`, `swapToken`,
  etc.) — verified already-correct via existing `context.user.fid` gating,
  no changes needed.
