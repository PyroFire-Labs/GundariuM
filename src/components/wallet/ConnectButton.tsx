"use client";

import { useEffect, useState } from "react";
import { useAccount, useAccountEffect, useConnect, useConnectors, useDisconnect } from "wagmi";
import { WalletAuthStatus } from "@/components/wallet/WalletAuthStatus";
import { useSiweSession } from "@/lib/hooks/useSiweSession";
import { useSiweSignIn } from "@/lib/hooks/useSiweSignIn";
import { connectRegisteredWallet, selectRegisteredWallets } from "@/lib/walletAuthCore";

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connectAsync, isPending: connecting } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [otherWalletsOpen, setOtherWalletsOpen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { isSignedIn, loading: sessionLoading, refresh: refreshSession, error: sessionError } = useSiweSession();
  const { signIn, phase: siwePhase, error: siweError, cancel: cancelSignIn } = useSiweSignIn(refreshSession);
  const choices = selectRegisteredWallets(connectors);
  const browserConnector = choices.other.find(
    (candidate) => candidate.type === "injected" || candidate.id === "injected",
  );
  const walletConnectConnector = choices.other.find((candidate) => candidate.id === "walletConnect");

  useAccountEffect({
    onDisconnect() {
      cancelSignIn();
      void (async () => {
        try {
          const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
          if (!response.ok) throw new Error();
          await refreshSession();
        } catch {
          setConnectionError("Unable to refresh sign-out status. Please try again.");
        }
      })();
    },
  });

  useEffect(() => setMounted(true), []);

  const isFarcaster = connector?.id === "farcaster";
  const needsSignIn = isConnected && !isFarcaster && !isSignedIn && !sessionLoading;
  const signingIn =
    siwePhase === "requesting-nonce" || siwePhase === "signing" ||
    siwePhase === "verifying" || siwePhase === "refreshing-session";

  const handleDisconnect = () => {
    cancelSignIn();
    disconnect();
  };

  const handleSignIn = async () => {
    setConnectionError(null);
    await signIn();
  };

  const handleConnect = async (selected: (typeof connectors)[number] | undefined) => {
    setConnectionError(null);
    cancelSignIn();
    try {
      await connectRegisteredWallet(selected, connectors, (registered) => connectAsync({ connector: registered }));
      setOtherWalletsOpen(false);
      await signIn();
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Wallet connection failed. Please try again.");
    }
  };

  const status = (
    <WalletAuthStatus
      error={connectionError ?? siweError ?? sessionError}
      pending={connecting ? "Connecting wallet…" : signingIn ? (
        siwePhase === "refreshing-session" ? "Confirming signed-in session…" : "Signing in…"
      ) : null}
    />
  );

  const walletOptions = (
    <div className="relative">
      <button
        aria-expanded={otherWalletsOpen}
        aria-haspopup="menu"
        aria-label="Other Wallet"
        className="rounded-lg border border-[var(--accent)]/60 bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 font-[family-name:var(--font-orbitron)] tracking-wider disabled:opacity-50"
        disabled={!mounted || connecting || signingIn}
        onClick={() => setOtherWalletsOpen((open) => !open)}
        type="button"
      >
        OTHER WALLET
      </button>
      {mounted && otherWalletsOpen && (
        <div
          className="absolute right-0 top-full z-[60] mt-2 flex min-w-48 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl"
          role="menu"
        >
          <button
            className="rounded px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-40"
            disabled={!browserConnector || connecting || signingIn}
            onClick={() => void handleConnect(browserConnector)}
            role="menuitem"
            type="button"
          >
            Browser wallet
          </button>
          <button
            className="rounded px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-40"
            disabled={!walletConnectConnector || connecting || signingIn}
            onClick={() => void handleConnect(walletConnectConnector)}
            role="menuitem"
            type="button"
          >
            WalletConnect QR
          </button>
        </div>
      )}
    </div>
  );

  if (!mounted) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-label="Connect Coinbase Wallet / Base Account"
          className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black font-[family-name:var(--font-orbitron)] tracking-wider"
          disabled
          type="button"
        >
          CONNECT
        </button>
        {walletOptions}
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(needsSignIn || signingIn) && (
            <button
              className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider disabled:opacity-50"
              disabled={signingIn || connecting}
              onClick={() => void handleSignIn()}
              type="button"
            >
              {signingIn ? "SIGNING IN..." : "SIGN IN"}
            </button>
          )}
          <button
            aria-label="Disconnect wallet"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm font-bold text-[var(--foreground)] hover:border-[var(--accent)] transition-colors font-[family-name:var(--font-orbitron)] tracking-wider"
            onClick={handleDisconnect}
            type="button"
          >
            {address.slice(0, 6)}…{address.slice(-4)}
          </button>
          {walletOptions}
        </div>
        {status}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-label="Connect Coinbase Wallet / Base Account"
          className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider disabled:opacity-50"
          disabled={connecting || signingIn}
          onClick={() => void handleConnect(choices.coinbase)}
          type="button"
        >
          CONNECT
        </button>
        {walletOptions}
      </div>
      {status}
    </div>
  );
}
