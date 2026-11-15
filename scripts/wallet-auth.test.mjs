import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let sessionHarness;
const hookTestUrl = new URL("../src/lib/hooks/useSiweSession.ts?hook-test", import.meta.url).href;
const hookMocks = `data:text/javascript,${encodeURIComponent(`
  export const useState = (...args) => globalThis.__walletSessionHarness.useState(...args);
  export const useRef = (...args) => globalThis.__walletSessionHarness.useRef(...args);
  export const useCallback = (callback) => callback;
  export const useEffect = () => {};
  export const useAccount = () => ({address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === hookTestUrl && ["react", "wagmi"].includes(specifier)) {
      return { url: hookMocks, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const path = new URL(`../src/${specifier.slice(2)}`, import.meta.url);
      const extension = existsSync(new URL(`${path}.ts`)) ? ".ts" : ".tsx";
      return { url: `${path}${extension}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.includes("/src/") && /\.tsx?$/.test(new URL(url).pathname)) {
      return {
        format: "module", shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  selectRegisteredWallets, connectRegisteredWallet, readSiweSession,
  runSiweSignIn, sessionMismatchError,
} = await import("../src/lib/walletAuthCore.ts");
const { WalletAuthStatus } = await import("../src/components/wallet/WalletAuthStatus.tsx");
const { ConnectButton } = await import("../src/components/wallet/ConnectButton.tsx");
const ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "0x2222222222222222222222222222222222222222";
const json = (value, status = 200) => Response.json(value, { status });

function fixture(overrides = {}) {
  const calls = [];
  const phases = [];
  const fetcher = async (url, options) => {
    calls.push([url, options]);
    if (url === "/api/auth/nonce") return json({ nonce: "syntheticnonce123" });
    if (url === "/api/auth/siwe") return json({ address: ADDRESS });
    if (url === "/api/auth/session") return json({ address: ADDRESS });
    throw new Error("Unexpected request");
  };
  const options = {
    address: ADDRESS, chainId: 8453,
    domain: "gundarium.invalid", uri: "https://gundarium.invalid",
    fetcher,
    signMessage: async () => "0x1234",
    refreshSession: async () => readSiweSession(options.fetcher),
    isCurrent: () => true,
    onPhase: (phase) => phases.push(phase),
    ...overrides,
  };
  return { options, calls, phases };
}

test("wallet choices select registered Coinbase, injected and WalletConnect instances", async () => {
  const base = { id: "baseAccount", type: "baseAccount", name: "Base Account" };
  const injected = { id: "injected", type: "injected", name: "Browser wallet" };
  const wc = { id: "walletConnect", type: "walletConnect", name: "WalletConnect" };
  const registered = [{ id: "farcaster", type: "farcaster" }, base, injected, wc];
  const choices = selectRegisteredWallets(registered);
  assert.equal(choices.coinbase, base);
  assert.deepEqual(choices.other, [injected, wc]);
  for (const connector of [choices.coinbase, ...choices.other]) {
    let used;
    await connectRegisteredWallet(connector, registered, async (value) => { used = value; });
    assert.equal(used, connector);
    const { options, calls, phases } = fixture();
    assert.equal(await runSiweSignIn(options), ADDRESS);
    assert.deepEqual(calls.map(([url]) => url), ["/api/auth/nonce", "/api/auth/siwe", "/api/auth/session"]);
    assert.deepEqual(phases, ["requesting-nonce", "signing", "verifying", "refreshing-session"]);
  }
  await assert.rejects(connectRegisteredWallet({ ...base }, registered, async () => {}), /registered/);
});

test("connection rejection and missing connector produce visible actionable errors", async () => {
  const connector = { id: "baseAccount" };
  await assert.rejects(connectRegisteredWallet(undefined, [connector], async () => {}), /available/);
  await assert.rejects(connectRegisteredWallet(connector, [connector], async () => { throw { code: 4001 }; }), /cancelled/);
  await assert.rejects(connectRegisteredWallet(connector, [connector], async () => { throw new Error("internal provider failure"); }), /Wallet connection failed/);
});

test("nonce is requested without cache and its HTTP status and shape are checked", async () => {
  const { options, calls } = fixture();
  await runSiweSignIn(options);
  assert.equal(calls[0][1].cache, "no-store");
  assert.equal(calls[0][1].credentials, "same-origin");
  const posted = JSON.parse(calls[1][1].body);
  assert.match(posted.message, /syntheticnonce123/);
  assert.equal(posted.signature, "0x1234");
  for (const response of [json({ error: "Rate limited" }, 429), json({}), json({ nonce: "bad nonce" }), new Response("invalid JSON")]) {
    const f = fixture({ fetcher: async () => response, signMessage: async () => assert.fail("must not sign") });
    await assert.rejects(runSiweSignIn(f.options), /nonce/i);
  }
});

test("rejected signature never reaches verification", async () => {
  const { options, calls } = fixture({ signMessage: async () => { throw { code: 4001 }; } });
  await assert.rejects(runSiweSignIn(options), /Signature cancelled/);
  assert.equal(calls.length, 1);
  const failed = fixture({ signMessage: async () => { throw new Error("provider failed"); } });
  await assert.rejects(runSiweSignIn(failed.options), /Unable to sign/);
});

test("verification errors and mismatched verification addresses reject authentication", async () => {
  for (const response of [json({ error: "Invalid signature" }, 401), json({ address: OTHER }), new Response("bad JSON")]) {
    const { options } = fixture({
      fetcher: async (url) => url === "/api/auth/nonce" ? json({ nonce: "syntheticnonce123" }) : response,
      refreshSession: async () => assert.fail("must not refresh"),
    });
    await assert.rejects(runSiweSignIn(options), /verification/i);
  }
});

test("sign-in waits for the refreshed matching session", async () => {
  let release;
  let finished = false;
  const { options } = fixture({ refreshSession: () => new Promise((resolve) => { release = resolve; }) });
  const result = runSiweSignIn(options).then(() => { finished = true; });
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finished, false);
  release(ADDRESS.toUpperCase().replace("0X", "0x"));
  await result;
  assert.equal(finished, true);
});

test("missing or mismatched sessions and session-refresh failures never authenticate", async () => {
  for (const address of [OTHER, null]) {
    const { options } = fixture({ refreshSession: async () => address });
    await assert.rejects(runSiweSignIn(options), /session.*wallet/i);
  }
  for (const response of [json({}, 503), json({ address: "bad" }), new Response("bad JSON")]) {
    await assert.rejects(readSiweSession(async () => response), /session/i);
  }
  const { options } = fixture({ refreshSession: async () => { throw new Error("synthetic failure"); } });
  await assert.rejects(runSiweSignIn(options), /session/i);
  assert.equal(sessionMismatchError(OTHER, ADDRESS), "Session address does not match the connected wallet. Sign in again.");
});

test("account changes at every async stage reject sign-in", async () => {
  for (const stage of ["nonce", "signature", "verification", "session"]) {
    let current = true;
    const f = fixture({ isCurrent: () => current });
    const fetcher = f.options.fetcher;
    f.options.fetcher = async (...args) => {
      const response = await fetcher(...args);
      if ((stage === "nonce" && args[0].endsWith("nonce")) || (stage === "verification" && args[0].endsWith("siwe"))) current = false;
      return response;
    };
    f.options.signMessage = async () => { if (stage === "signature") current = false; return "0x1234"; };
    if (stage === "session") f.options.refreshSession = async () => { current = false; return ADDRESS; };
    await assert.rejects(runSiweSignIn(f.options), /Wallet changed/);
  }
});

test("cancellation rejects a pending signature without waiting for the wallet", async () => {
  const controller = new AbortController();
  const { options, calls } = fixture({ signal: controller.signal, signMessage: () => new Promise(() => {}) });
  options.onPhase = (phase) => { if (phase === "signing") queueMicrotask(() => controller.abort(new Error("Wallet changed during sign-in. Try again."))); };
  await assert.rejects(runSiweSignIn(options), /Wallet changed/);
  assert.equal(calls.length, 1);
});

test("every authentication error is rendered visibly and escaped", () => {
  for (const error of ["Wallet connection failed", "Signature cancelled", "Unable to request nonce", "Sign-in verification failed", "Session refresh failed", sessionMismatchError(OTHER, ADDRESS), "<script>unsafe</script>"]) {
    const html = renderToStaticMarkup(createElement(WalletAuthStatus, { error }));
    assert.match(html, /role="alert"/);
    assert.ok(html.includes(error.startsWith("<") ? "&lt;script&gt;" : error));
    assert.ok(!html.includes("<script>"));
  }
  assert.equal(renderToStaticMarkup(createElement(WalletAuthStatus, { error: null })), "");
  assert.match(renderToStaticMarkup(createElement(WalletAuthStatus, { error: null, pending: "Confirming signed-in session…" })), /role="status"/);
});

test("wallet button renders distinct Coinbase and Other Wallet choices", () => {
  const config = createConfig({ chains: [base], connectors: [], transports: { [base.id]: http("https://rpc.invalid") } });
  const html = renderToStaticMarkup(createElement(WagmiProvider, { config, reconnectOnMount: false },
    createElement(QueryClientProvider, { client: new QueryClient() }, createElement(ConnectButton))));
  assert.match(html, /Coinbase Wallet \/ Base Account/);
  assert.match(html, /Other Wallet/);
});

test("session hook clears loading after the active refresh is cancelled", async () => {
  // Isolate hook state without a DOM or provider calls; exercise the real hook's
  // refresh/finally logic. The mount effect is intentionally disabled here.
  const slots = [];
  let cursor = 0;
  sessionHarness = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
  };
  globalThis.__walletSessionHarness = sessionHarness;
  const originalFetch = globalThis.fetch;
  try {
    const { useSiweSession } = await import(hookTestUrl);
    const SessionHarness = () => { cursor = 0; return useSiweSession(); };
    globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    const controller = new AbortController();
    const pending = SessionHarness().refresh(controller.signal);
    const rejected = assert.rejects(pending, /Session refresh failed/);
    controller.abort();
    await rejected;
    assert.equal(SessionHarness().loading, false);
    globalThis.fetch = async () => json({ address: ADDRESS });
    await SessionHarness().refresh();
    assert.equal(SessionHarness().isSignedIn, true);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__walletSessionHarness;
  }
});
