"use client";

import { useState, useEffect } from "react";
import { useAccount, useAccountEffect, useConnect, useDisconnect } from "wagmi";
import { baseAccount, walletConnect } from "wagmi/connectors";
import { useSiweSignIn } from "@/lib/hooks/useSiweSignIn";
import { useSiweSession } from "@/lib/hooks/useSiweSession";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const { signIn, phase: siwePhase, cancel: cancelSignIn } = useSiweSignIn();
  const { isSignedIn, loading: sessionLoading, refresh: refreshSession } = useSiweSession();

  useAccountEffect({
    onDisconnect() {
      fetch("/api/auth/logout", { method: "POST" }).finally(() => refreshSession());
    },
  });

  useEffect(() => setMounted(true), []);

  const isFarcaster = connector?.id === "farcaster";
  const needsSignIn = isConnected && !isFarcaster && !isSignedIn && !sessionLoading;
  const signingIn =
    siwePhase === "requesting-nonce" || siwePhase === "signing" || siwePhase === "verifying";

  const handleDisconnect = () => {
    cancelSignIn();
    disconnect();
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
