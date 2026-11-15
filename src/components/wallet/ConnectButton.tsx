"use client";

import { useState, useEffect } from "react";
import { useAccount, useAccountEffect, useConnect, useConnectors, useDisconnect } from "wagmi";
import { useSiweSignIn } from "@/lib/hooks/useSiweSignIn";
import { useSiweSession } from "@/lib/hooks/useSiweSession";
import { connectRegisteredWallet, selectRegisteredWallets } from "@/lib/walletAuthCore";
import { WalletAuthStatus } from "@/components/wallet/WalletAuthStatus";

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connectAsync, isPending: connecting } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { isSignedIn, loading: sessionLoading, refresh: refreshSession, error: sessionError } = useSiweSession();
  const { signIn, phase: siwePhase, error: siweError, cancel: cancelSignIn } = useSiweSignIn(refreshSession);
  const choices = selectRegisteredWallets(connectors);

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
      setShowChooser(false);
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

  if (mounted && isConnected && address) {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          {(needsSignIn || signingIn) && (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn || connecting}
              className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider disabled:opacity-50"
            >
              {signingIn ? "SIGNING IN..." : "SIGN IN"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDisconnect}
            aria-label="Disconnect wallet"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm font-bold text-[var(--foreground)] hover:border-[var(--accent)] transition-colors font-[family-name:var(--font-orbitron)] tracking-wider"
          >
            {address.slice(0, 6)}…{address.slice(-4)}
          </button>
        </div>
        {status}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowChooser((show) => !show)}
          aria-expanded={showChooser}
          disabled={!mounted || connecting || signingIn}
          className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider disabled:opacity-50"
        >
          CONNECT
        </button>
      </div>
      {showChooser ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Wallet connections">
          {[
            {
              label: "Browser Wallet",
              connector: choices.other.find((registered) => registered.id === "injected") ??
                choices.other.find((registered) => registered.type === "injected"),
            },
            { label: "WalletConnect QR", connector: choices.other.find((registered) => registered.id === "walletConnect") },
            { label: "Coinbase / Base Account", connector: choices.coinbase },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={connecting || signingIn}
              onClick={() => handleConnect(option.connector)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {mounted ? status : null}
    </div>
  );
}
