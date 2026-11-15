import { createSiweMessage } from "viem/siwe";

export type SiweSignInPhase =
  | "idle" | "requesting-nonce" | "signing" | "verifying"
  | "refreshing-session" | "done" | "error";

type RegisteredWallet = { id: string; type?: string };
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function selectRegisteredWallets<T extends RegisteredWallet>(connectors: readonly T[]) {
  return {
    coinbase: connectors.find((connector) => connector.id === "baseAccount"),
    other: connectors.filter((connector) =>
      connector.type === "injected" || connector.id === "injected" || connector.id === "walletConnect"),
  };
}

function isRejected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: number; message?: string; cause?: unknown };
  return value.code === 4001 || /user rejected|user denied/i.test(value.message ?? "") ||
    (value.cause !== error && !!value.cause && isRejected(value.cause));
}

export async function connectRegisteredWallet<T extends RegisteredWallet, R>(
  connector: T | undefined,
  registered: readonly T[],
  connect: (connector: T) => Promise<R>,
): Promise<R> {
  if (!connector) throw new Error("This wallet connection is not available. Choose another wallet.");
  if (!registered.includes(connector)) throw new Error("Choose a registered wallet connection.");
  try {
    return await connect(connector);
  } catch (error) {
    throw new Error(isRejected(error) ? "Wallet connection cancelled." : "Wallet connection failed. Please try again.");
  }
}

export function sessionMismatchError(sessionAddress: string | null, connectedAddress?: string) {
  return sessionAddress && connectedAddress && sessionAddress.toLowerCase() !== connectedAddress.toLowerCase()
    ? "Session address does not match the connected wallet. Sign in again."
    : null;
}

export async function readSiweSession(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetcher("/api/auth/session", { cache: "no-store", credentials: "same-origin", signal });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!data || (data.address !== null && (typeof data.address !== "string" || !ADDRESS.test(data.address)))) throw new Error();
    return data.address;
  } catch {
    throw new Error("Session refresh failed. Please try again.");
  }
}

interface SignInOptions {
  address: `0x${string}`;
  chainId: number;
  domain: string;
  uri: string;
  signMessage(message: string): Promise<`0x${string}`>;
  refreshSession(signal?: AbortSignal): Promise<string | null>;
  isCurrent(): boolean;
  onPhase(phase: SiweSignInPhase): void;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

// Wallet prompts cannot always be dismissed programmatically. Stop awaiting them
// on cancellation and never submit a signature that arrives from an obsolete run.
function whileActive<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Sign-in cancelled."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    work.then(
      (value) => { signal.removeEventListener("abort", abort); resolve(value); },
      (error) => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}

export async function runSiweSignIn({
  address, chainId, domain, uri, signMessage, refreshSession,
  isCurrent, onPhase, signal, fetcher = fetch,
}: SignInOptions): Promise<string> {
  const assertCurrent = () => {
    signal?.throwIfAborted();
    if (!isCurrent()) throw new Error("Wallet changed during sign-in. Try again.");
  };
  async function step<T>(work: () => Promise<T>, fallback: string): Promise<T> {
    assertCurrent();
    let result: T;
    try { result = await whileActive(work(), signal); }
    catch { assertCurrent(); throw new Error(fallback); }
    assertCurrent();
    return result;
  }

  assertCurrent();
  onPhase("requesting-nonce");
  const nonce = await step(async () => {
    const response = await fetcher("/api/auth/nonce", { cache: "no-store", credentials: "same-origin", signal });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (typeof data?.nonce !== "string" || !/^[a-zA-Z0-9]{8,}$/.test(data.nonce)) throw new Error();
    return data.nonce as string;
  }, "Unable to request a sign-in nonce. Please try again.");

  onPhase("signing");
  const message = createSiweMessage({
    address, chainId, domain, nonce, uri, version: "1",
    statement: "Sign in to GundariuM",
    expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  assertCurrent();
  let signature: `0x${string}`;
  try { signature = await whileActive(signMessage(message), signal); }
  catch (error) {
    assertCurrent();
    throw new Error(isRejected(error) ? "Signature cancelled in wallet." : "Unable to sign the sign-in message. Please try again.");
  }
  assertCurrent();

  onPhase("verifying");
  await step(async () => {
    const response = await fetcher("/api/auth/siwe", {
      method: "POST", credentials: "same-origin", signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature }),
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (typeof data?.address !== "string" || data.address.toLowerCase() !== address.toLowerCase()) throw new Error();
  }, "Sign-in verification failed. Please try again.");

  onPhase("refreshing-session");
  const sessionAddress = await step(() => refreshSession(signal), "Session refresh failed. Please try again.");
  if (!sessionAddress || sessionAddress.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Session address does not match the connected wallet. Sign in again.");
  }
  return sessionAddress;
}
