"use client";

import { useState, useEffect } from "react";
import { useAccount, useAccountEffect, useConnect, useDisconnect } from "wagmi";
import { baseAccount } from "wagmi/connectors";
import { useSiweSignIn } from "@/lib/hooks/useSiweSignIn";
import { useSiweSession } from "@/lib/hooks/useSiweSession";

export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [otherWalletsOpen, setOtherWalletsOpen] = useState(false);
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

  const connectWith = (id: string) => {
    const target = connectors.find((candidate) => candidate.id === id);
    if (target) connect({ connector: target });
  };

  const walletOptions = (
    <div className="relative">
      <button
        aria-expanded={otherWalletsOpen}
        aria-haspopup="menu"
        className="rounded-lg border border-[var(--accent)]/60 bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 font-[family-name:var(--font-orbitron)] tracking-wider"
        disabled={!mounted}
        onClick={() => setOtherWalletsOpen((open) => !open)}
        type="button"
      >
        OTHER WALLET
      </button>
      {mounted && otherWalletsOpen && (
        <div className="absolute right-0 top-full z-[60] mt-2 flex min-w-48 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl" role="menu">
          <button className="rounded px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-40" disabled={!connectors.some((candidate) => candidate.id === "injected")} onClick={() => connectWith("injected")} role="menuitem" type="button">
            Browser wallet
          </button>
          <button className="rounded px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-40" disabled={!connectors.some((candidate) => candidate.id === "walletConnect")} onClick={() => connectWith("walletConnect")} role="menuitem" type="button">
            WalletConnect QR
          </button>
        </div>
      )}
    </div>
  );

  if (!mounted) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black font-[family-name:var(--font-orbitron)] tracking-wider" disabled type="button">
          CONNECT
        </button>
        {walletOptions}
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-wrap items-center gap-2">
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
        {walletOptions}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => connect({ connector: baseAccount({ appName: "GundariuM" }) })}
        className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider"
      >
        CONNECT
      </button>
      {walletOptions}
    </div>
  );
}
