# Base App Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proper Base App support (SIWE sign-in, a general-purpose session
layer, a `baseAccount` wallet connector) alongside the existing Farcaster
integration, with zero changes to how Farcaster-client users experience the
app today.

**Architecture:** wagmi gains a fourth connector (`baseAccount`, Base's own
smart-wallet SDK). Outside Farcaster context (detected via
`connector?.id === "farcaster"`), a connected wallet can sign a SIWE (EIP-4361)
message; the backend verifies it with viem, and issues a session stored in
Upstash Redis (same pattern as the existing Dossier-lineup and leaderboard
storage), referenced by an opaque ID in an httpOnly cookie. Inside Farcaster
context, nothing changes — `FarcasterInit`'s existing auto-connect is untouched
and no sign-in step is ever shown.

**Tech Stack:** wagmi 3.5, viem 2.48 (`viem/siwe`, `viem/accounts`),
`@base-org/account` (new), `@upstash/redis` (already a dependency), Next.js 16
App Router route handlers.

## Global Constraints

- **Additive only.** No existing Farcaster-specific code path changes
  (`FarcasterInit`, `farcasterConnector`, `openInMiniAppOrBrowser`, the
  Farcaster branch of `ShareButtons`, `handleGnrmCheck`'s swap fallback) —
  these were verified during design as already correctly falling back to
  browser-appropriate behavior outside Farcaster context, and are out of
  scope here.
- **No new Doppler secrets.** Sessions and nonces live in the existing
  Upstash Redis instance (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`,
  already provisioned) via `Redis.fromEnv()` — same as `lineupStore.ts`.
- **Session TTL: 7 days.** Nonce TTL: 5 minutes, one-time use.
- **Follow existing conventions exactly:** phase-state-machine hooks match
  `useSaveLineup.ts`'s shape (`idle`/action phases/`"error"`, `"Signature
  cancelled"` wording for user-rejected signatures); server-only Redis modules
  stay out of client bundles (no `"use client"` file imports `@upstash/redis`
  directly); new client hooks live in `src/lib/hooks/` matching
  `useRunnerProfile.ts`'s existing location and style.
- **No test framework exists for the frontend** (confirmed in CLAUDE.md) —
  "tests" in this plan are real scripts/curl calls against a genuinely running
  dev server, not a mocked test suite, matching how this whole project has
  been verified throughout its history.
- Register on Base.dev is a **human action for Joshua**, not a code task —
  not included as a plan task; hand off the exact steps once implementation
  is otherwise complete.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `@base-org/account` dependency |
| `src/lib/wagmi.ts` | Modify | Register the `baseAccount` connector |
| `src/lib/auth.ts` | Create | Server-only: nonce issue/consume + session create/read/destroy, all Redis-backed |
| `src/app/api/auth/nonce/route.ts` | Create | `GET` — issues a fresh SIWE nonce |
| `src/app/api/auth/siwe/route.ts` | Create | `POST` — verifies a signed SIWE message, creates a session, sets the cookie |
| `src/app/api/auth/session/route.ts` | Create | `GET` — returns the current session's address, or `null` |
| `src/app/api/auth/logout/route.ts` | Create | `POST` — destroys the session, clears the cookie |
| `src/lib/hooks/useSiweSignIn.ts` | Create | Client hook: nonce → build message → sign → verify |
| `src/lib/hooks/useSiweSession.ts` | Create | Client hook: reads current session, compares against connected address |
| `src/components/wallet/ConnectButton.tsx` | Modify | Default-connect via `baseAccount` outside Farcaster, show SIGN IN when needed, logout clears the session too |
| `scripts/test-siwe-flow.ts` | Create (temporary verification script) | End-to-end real-HTTP test of the whole nonce → sign → verify → session → logout → replay-rejection flow |

---

### Task 1: `baseAccount` wallet connector

**Files:**
- Modify: `package.json`
- Modify: `src/lib/wagmi.ts`

**Interfaces:**
- Produces: `wagmiConfig` (existing export) now includes a `baseAccount`
  connector with `id === "baseAccount"`, usable by later tasks via
  `useConnect()` / `connect({ connector: baseAccount({...}) })`.

- [ ] **Step 1: Add the dependency**

```bash
npm install @base-org/account@^2.5.7
```

Expected: `package.json`'s `"dependencies"` gains
`"@base-org/account": "^2.5.7"`, and `package-lock.json` updates
`node_modules/@base-org/account` to `2.5.7` (currently resolved at `2.4.0`
transitively, which does not satisfy the `baseAccount` connector's own peer
requirement of `^2.5.1` — this fixes that mismatch).

- [ ] **Step 2: Register the connector**

Edit `src/lib/wagmi.ts` to:

```ts
import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { baseAccount, injected, walletConnect } from "wagmi/connectors";
import { farcasterConnector } from "@/lib/farcasterConnector";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    farcasterConnector,
    baseAccount({ appName: "GundariuM" }),
    injected(),
    walletConnect({ projectId, showQrModal: true }),
  ],
  transports: {
    [base.id]:        http("https://mainnet.base.org"),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org"),
  },
});
```

- [ ] **Step 3: Verify it typechecks and builds**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

```bash
doppler run --project gundarium --config dev -- npm run build 2>&1 | tail -30
```

Expected: build succeeds — this is sufficient proof the connector constructs
without throwing at build time. (A live "does it actually connect a wallet"
check happens later, once Task 6 wires the connector into `ConnectButton`
and there's a real UI surface to click.)

A pre-existing lint warning in `src/app/arena/page.tsx:121` about
ref-mutation-during-render will show up in build output — it predates this
change and is unrelated; do not fix it as part of this task.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/wagmi.ts
git commit -m "feat(wallet): add baseAccount wagmi connector"
```

---

### Task 2: Server-side auth storage (`src/lib/auth.ts`)

**Files:**
- Create: `src/lib/auth.ts`

**Interfaces:**
- Consumes: `Redis.fromEnv()` from `@upstash/redis` (existing pattern, see
  `src/lib/lineupStore.ts`).
- Produces (all used by Tasks 3–5):
  - `SESSION_COOKIE_NAME: string`
  - `SESSION_TTL_SECONDS: number`
  - `issueNonce(): Promise<string>`
  - `consumeNonce(nonce: string): Promise<boolean>`
  - `createSession(address: string): Promise<string>` (returns session ID)
  - `getSessionAddress(sessionId: string | undefined): Promise<string | null>`
  - `destroySession(sessionId: string | undefined): Promise<void>`

- [ ] **Step 1: Write the module**

```ts
// src/lib/auth.ts
/**
 * Server-only SIWE + session storage. Nonces and sessions both live in the
 * same Upstash Redis instance already used by lineupStore.ts and the
 * leaderboard cache — no new infra, no new Doppler secret.
 */

import { Redis } from "@upstash/redis";
import { generateSiweNonce } from "viem/siwe";

const redis = Redis.fromEnv();

export const SESSION_COOKIE_NAME = "gundarium_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const NONCE_TTL_SECONDS = 60 * 5; // 5 minutes

interface SessionData {
  address: string;
}

function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

function nonceKey(nonce: string): string {
  return `siwe:nonce:${nonce}`;
}

/** Issues a fresh SIWE nonce, stored server-side for one-time use. */
export async function issueNonce(): Promise<string> {
  const nonce = generateSiweNonce();
  await redis.set(nonceKey(nonce), "1", { ex: NONCE_TTL_SECONDS });
  return nonce;
}

/**
 * Consumes a nonce — true if it was valid and unused, false otherwise.
 * Deletes it either way so it can never be checked twice (one-time use,
 * and this is what makes a replayed sign-in request fail the second time).
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  const key = nonceKey(nonce);
  const exists = await redis.get(key);
  await redis.del(key);
  return exists !== null;
}

export async function createSession(address: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  await redis.set<SessionData>(
    sessionKey(sessionId),
    { address },
    { ex: SESSION_TTL_SECONDS }
  );
  return sessionId;
}

export async function getSessionAddress(
  sessionId: string | undefined
): Promise<string | null> {
  if (!sessionId) return null;
  try {
    const data = await redis.get<SessionData>(sessionKey(sessionId));
    return data?.address ?? null;
  } catch (err) {
    console.error(`getSessionAddress failed for session ${sessionId}:`, err);
    return null;
  }
}

export async function destroySession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  await redis.del(sessionKey(sessionId));
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Write a standalone verification script**

```ts
// scripts/test-auth-storage.ts
import {
  issueNonce,
  consumeNonce,
  createSession,
  getSessionAddress,
  destroySession,
} from "../src/lib/auth";

async function main() {
  // Nonce: issue, consume once (true), consume again (false — already used)
  const nonce = await issueNonce();
  console.log("Issued nonce:", nonce);
  const firstConsume = await consumeNonce(nonce);
  const secondConsume = await consumeNonce(nonce);
  console.log("First consume (expect true):", firstConsume);
  console.log("Second consume (expect false):", secondConsume);
  if (!firstConsume || secondConsume) {
    throw new Error("Nonce one-time-use behavior is broken");
  }

  // Session: create, read, destroy, read again
  const testAddress = "0x000000000000000000000000000000000000f1";
  const sessionId = await createSession(testAddress);
  console.log("Created session:", sessionId);
  const readBack = await getSessionAddress(sessionId);
  console.log("Read back (expect testAddress):", readBack);
  if (readBack !== testAddress) throw new Error("Session read-back mismatch");

  await destroySession(sessionId);
  const afterDestroy = await getSessionAddress(sessionId);
  console.log("After destroy (expect null):", afterDestroy);
  if (afterDestroy !== null) throw new Error("Session was not destroyed");

  console.log("\n✅ auth.ts storage checks passed");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Run it against real Redis**

```bash
doppler run --project gundarium --config dev -- npx tsx scripts/test-auth-storage.ts
```

Expected output ends with `✅ auth.ts storage checks passed`. If it fails on
the Redis calls, confirm `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
are present in the `dev` Doppler config (same ones `lineupStore.ts` already
relies on).

- [ ] **Step 5: Delete the temporary script and commit**

```bash
rm scripts/test-auth-storage.ts
git add src/lib/auth.ts
git commit -m "feat(auth): add Redis-backed SIWE nonce and session storage"
```

---

### Task 3: Nonce issuance route

**Files:**
- Create: `src/app/api/auth/nonce/route.ts`

**Interfaces:**
- Consumes: `issueNonce()` from `src/lib/auth.ts` (Task 2).
- Produces: `GET /api/auth/nonce` → `{ nonce: string }`.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/auth/nonce/route.ts
import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/auth";

export async function GET() {
  const nonce = await issueNonce();
  return NextResponse.json({ nonce });
}
```

- [ ] **Step 2: Start the dev server and verify**

```bash
doppler run --project gundarium --config dev -- npm run dev > /tmp/gundarium-dev.log 2>&1 &
sleep 3
curl -s http://localhost:3000/api/auth/nonce
```

Expected: a JSON object like `{"nonce":"<32-char-alphanumeric-string>"}`,
HTTP 200.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/nonce/route.ts
git commit -m "feat(auth): add SIWE nonce issuance route"
```

---

### Task 4: SIWE verify route

**Files:**
- Create: `src/app/api/auth/siwe/route.ts`

**Interfaces:**
- Consumes: `consumeNonce`, `createSession`, `SESSION_COOKIE_NAME`,
  `SESSION_TTL_SECONDS` from `src/lib/auth.ts` (Task 2); the nonce route from
  Task 3 (used by the verification script, not imported directly).
- Produces: `POST /api/auth/siwe` with body `{ message: string, signature: string }`
  → on success, `200` with `{ address: string }` and sets the
  `gundarium_session` httpOnly cookie; on failure, `400`/`401` with
  `{ error: string }`.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/auth/siwe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { parseSiweMessage } from "viem/siwe";
import {
  consumeNonce,
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const message = body?.message;
  const signature = body?.signature;
  if (typeof message !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
  }

  const parsed = parseSiweMessage(message);
  if (!parsed.address || !parsed.nonce) {
    return NextResponse.json({ error: "Malformed SIWE message" }, { status: 400 });
  }

  const nonceValid = await consumeNonce(parsed.nonce);
  if (!nonceValid) {
    return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
  }

  const domain = request.headers.get("host") ?? undefined;
  const verified = await publicClient
    .verifySiweMessage({
      message,
      signature: signature as `0x${string}`,
      domain,
      nonce: parsed.nonce,
    })
    .catch(() => false);
  if (!verified) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  const sessionId = await createSession(parsed.address);
  const response = NextResponse.json({ address: parsed.address });
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}
```

- [ ] **Step 2: Write a real end-to-end verification script**

```ts
// scripts/test-siwe-flow.ts
import { createSiweMessage } from "viem/siwe";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

const BASE_URL = "http://localhost:3000";

async function main() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: base, transport: http() });
  console.log("Test account:", account.address);

  // First prove the 401 path actually works: a real message with a
  // deliberately wrong signature must be rejected, not silently accepted.
  const { nonce: badNonce } = await fetch(`${BASE_URL}/api/auth/nonce`).then((r) => r.json());
  const badMessage = createSiweMessage({
    address: account.address,
    chainId: base.id,
    domain: "localhost:3000",
    nonce: badNonce,
    uri: BASE_URL,
    version: "1",
    statement: "Sign in to GundariuM",
  });
  const wrongAccount = privateKeyToAccount(generatePrivateKey());
  const wrongWalletClient = createWalletClient({ account: wrongAccount, chain: base, transport: http() });
  const wrongSignature = await wrongWalletClient.signMessage({ message: badMessage });
  const badSigRes = await fetch(`${BASE_URL}/api/auth/siwe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: badMessage, signature: wrongSignature }),
  });
  console.log("Wrong-signer attempt status (expect 401):", badSigRes.status);
  if (badSigRes.status !== 401) throw new Error("Invalid signature was not rejected!");

  // Now the real, correctly-signed flow — needs its own fresh nonce, since
  // the bad-signature attempt above already consumed badNonce.
  const { nonce } = await fetch(`${BASE_URL}/api/auth/nonce`).then((r) => r.json());
  console.log("Got nonce:", nonce);

  const message = createSiweMessage({
    address: account.address,
    chainId: base.id,
    domain: "localhost:3000",
    nonce,
    uri: BASE_URL,
    version: "1",
    statement: "Sign in to GundariuM",
  });
  const signature = await walletClient.signMessage({ message });
  console.log("Signed message");

  const verifyRes = await fetch(`${BASE_URL}/api/auth/siwe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  const verifyData = await verifyRes.json();
  const setCookie = verifyRes.headers.get("set-cookie");
  console.log("Verify response:", verifyRes.status, verifyData);
  console.log("Set-Cookie:", setCookie);

  if (verifyRes.status !== 200) throw new Error("Verify failed");
  if (verifyData.address?.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("Returned address doesn't match signer");
  }
  if (!setCookie?.includes("gundarium_session=")) {
    throw new Error("No session cookie set");
  }

  console.log("\n✅ SIWE verify + cookie checks passed (session/logout covered in Task 5's script)");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Run it against the running dev server**

(dev server should still be running from Task 3's Step 2 — if not, restart it
the same way)

```bash
npx tsx scripts/test-siwe-flow.ts
```

Expected output ends with `✅ SIWE verify + cookie checks passed...`. This
script is extended in Task 5, not deleted yet.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/siwe/route.ts scripts/test-siwe-flow.ts
git commit -m "feat(auth): add SIWE signature verification route"
```

---

### Task 5: Session-check and logout routes

**Files:**
- Create: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Modify: `scripts/test-siwe-flow.ts` (extend the existing script from Task 4)

**Interfaces:**
- Consumes: `getSessionAddress`, `destroySession`, `SESSION_COOKIE_NAME` from
  `src/lib/auth.ts` (Task 2).
- Produces:
  - `GET /api/auth/session` → `{ address: string | null }`
  - `POST /api/auth/logout` → `{ ok: true }`, clears the session cookie

- [ ] **Step 1: Write the session-check route**

```ts
// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionAddress, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const address = await getSessionAddress(sessionId);
  return NextResponse.json({ address });
}
```

- [ ] **Step 2: Write the logout route**

```ts
// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySession(sessionId);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
```

- [ ] **Step 3: Extend the verification script to cover session + logout + replay rejection**

Replace the final `console.log("\n✅ SIWE verify...")` line in
`scripts/test-siwe-flow.ts` with:

```ts
  const cookieValue = setCookie.split(";")[0];

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { cookie: cookieValue },
  });
  const sessionData = await sessionRes.json();
  console.log("Session check:", sessionData);
  if (sessionData.address?.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("Session address mismatch");
  }

  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: cookieValue },
  });
  console.log("Logout status:", logoutRes.status);

  const sessionAfterLogout = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { cookie: cookieValue },
  }).then((r) => r.json());
  console.log("Session after logout (expect null):", sessionAfterLogout);
  if (sessionAfterLogout.address !== null) {
    throw new Error("Session still exists after logout!");
  }

  const replayRes = await fetch(`${BASE_URL}/api/auth/siwe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  console.log("Replay attempt status (expect 400):", replayRes.status);
  if (replayRes.status !== 400) throw new Error("Nonce replay was not rejected!");

  console.log("\n✅ All SIWE flow checks passed (verify, session, logout, replay rejection)");
```

- [ ] **Step 4: Run the full script**

```bash
npx tsx scripts/test-siwe-flow.ts
```

Expected output ends with
`✅ All SIWE flow checks passed (verify, session, logout, replay rejection)`.

- [ ] **Step 5: Delete the temporary script and commit**

```bash
rm scripts/test-siwe-flow.ts
git add src/app/api/auth/session/route.ts src/app/api/auth/logout/route.ts
git commit -m "feat(auth): add session-check and logout routes"
```

---

### Task 6: Client hooks + ConnectButton integration

**Files:**
- Create: `src/lib/hooks/useSiweSignIn.ts`
- Create: `src/lib/hooks/useSiweSession.ts`
- Modify: `src/components/wallet/ConnectButton.tsx`

**Interfaces:**
- Consumes: `wagmiConfig`'s `baseAccount` connector (Task 1); the four auth
  API routes (Tasks 3–5).
- Produces:
  - `useSiweSignIn(): { signIn(): Promise<boolean>, phase: SiweSignInPhase, error: string | null, reset(): void }`
  - `useSiweSession(): { isSignedIn: boolean, sessionAddress: string | null, loading: boolean, refresh(): void }`

- [ ] **Step 1: Write the sign-in hook**

```ts
// src/lib/hooks/useSiweSignIn.ts
"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";

export type SiweSignInPhase =
  | "idle"
  | "requesting-nonce"
  | "signing"
  | "verifying"
  | "done"
  | "error";

export function useSiweSignIn() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [phase, setPhase] = useState<SiweSignInPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!address || !chainId) {
      setError("Connect your wallet first");
      setPhase("error");
      return false;
    }
    setError(null);
    try {
      setPhase("requesting-nonce");
      const { nonce } = await fetch("/api/auth/nonce").then((r) => r.json());

      setPhase("signing");
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: "1",
        statement: "Sign in to GundariuM",
        expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      const signature = await signMessageAsync({ message });

      setPhase("verifying");
      const res = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed");

      setPhase("done");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setError(msg.includes("User rejected") ? "Signature cancelled" : msg);
      setPhase("error");
      return false;
    }
  }, [address, chainId, signMessageAsync]);

  return {
    signIn,
    phase,
    error,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
  };
}
```

- [ ] **Step 2: Write the session-check hook**

```ts
// src/lib/hooks/useSiweSession.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

export function useSiweSession() {
  const { address: connectedAddress } = useAccount();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setSessionAddress(data.address ?? null))
      .catch(() => setSessionAddress(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isSignedIn =
    !!sessionAddress &&
    !!connectedAddress &&
    sessionAddress.toLowerCase() === connectedAddress.toLowerCase();

  return { isSignedIn, sessionAddress, loading, refresh };
}
```

- [ ] **Step 3: Integrate into ConnectButton**

```tsx
// src/components/wallet/ConnectButton.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { baseAccount, walletConnect } from "wagmi/connectors";
import { useSiweSignIn } from "@/lib/hooks/useSiweSignIn";
import { useSiweSession } from "@/lib/hooks/useSiweSession";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const { signIn, phase: siwePhase } = useSiweSignIn();
  const { isSignedIn, refresh: refreshSession } = useSiweSession();

  useEffect(() => setMounted(true), []);

  const isFarcaster = connector?.id === "farcaster";
  const needsSignIn = isConnected && !isFarcaster && !isSignedIn;
  const signingIn =
    siwePhase === "requesting-nonce" || siwePhase === "signing" || siwePhase === "verifying";

  const handleDisconnect = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    disconnect();
    refreshSession();
  };

  const handleSignIn = async () => {
    const ok = await signIn();
    if (ok) refreshSession();
  };

  if (!mounted) {
    return (
      <button className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider">
        CONNECT
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {needsSignIn && (
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider disabled:opacity-50"
          >
            {signingIn ? "SIGNING IN..." : "SIGN IN"}
          </button>
        )}
        <button
          onClick={handleDisconnect}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm font-bold text-[var(--foreground)] hover:border-[var(--accent)] transition-colors font-[family-name:var(--font-orbitron)] tracking-wider"
        >
          {address.slice(0, 6)}…{address.slice(-4)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => connect({ connector: baseAccount({ appName: "GundariuM" }) })}
        className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider"
      >
        CONNECT
      </button>
      <button
        onClick={() => connect({ connector: walletConnect({ projectId, showQrModal: true }) })}
        className="text-xs text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 transition-colors underline"
      >
        Other wallet
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint src/lib/hooks/useSiweSignIn.ts src/lib/hooks/useSiweSession.ts src/components/wallet/ConnectButton.tsx
```

Expected: no errors from either command.

- [ ] **Step 5: Manual browser verification**

With the dev server running:
1. Open `http://localhost:3000` in a normal browser tab (not inside Farcaster).
2. Click **CONNECT** → confirm the Base Account connector's popup/flow
   appears (or, if testing without a real Base Account, click **Other
   wallet** and connect via WalletConnect/an injected wallet instead — either
   path should work).
3. Once connected, confirm a **SIGN IN** button appears next to the address.
4. Click **SIGN IN**, approve the signature request in the wallet.
5. Open DevTools → Application → Cookies → confirm a `gundarium_session`
   cookie exists, marked `HttpOnly`.
6. Confirm the **SIGN IN** button disappears (session now matches connected
   address).
7. Click the address button to disconnect. Reconnect the same wallet —
   confirm **SIGN IN** is required again (cookie was cleared on disconnect).

- [ ] **Step 6: Commit**

```bash
git add src/lib/hooks/useSiweSignIn.ts src/lib/hooks/useSiweSession.ts src/components/wallet/ConnectButton.tsx
git commit -m "feat(wallet): wire SIWE sign-in into ConnectButton for non-Farcaster contexts"
```

---

## After implementation: hand-off items (not code tasks)

- **Register on Base.dev** (Joshua, human action): create a project at
  [base.dev](https://www.base.dev), fill in name/icon/tagline/description/
  screenshots/category/primary URL (`https://gundarium.xyz`), set up a
  Builder Code.
- Deploy to Vercel production and re-run the browser verification steps
  (Task 6, Step 5) against `https://gundarium.xyz` before considering this
  live.
