"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig, useSignMessage } from "wagmi";
import { getConnection } from "wagmi/actions";
import { runSiweSignIn, type SiweSignInPhase } from "@/lib/walletAuthCore";

export type { SiweSignInPhase } from "@/lib/walletAuthCore";

export function useSiweSignIn(refreshSession: (signal?: AbortSignal) => Promise<string | null>) {
  const config = useConfig();
  const { signMessageAsync } = useSignMessage();
  const [phase, setPhase] = useState<SiweSignInPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  const signIn = useCallback(async (): Promise<boolean> => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    // Read the live connection: a click may have just completed connectAsync,
    // before React has rendered the new account into this hook's closure.
    const connection = getConnection(config);
    const { address, chainId, connector } = connection;
    if (!connection.isConnected || !address || !chainId || !connector) {
      setError("Connect your wallet first");
      setPhase("error");
      active.current = null;
      return false;
    }
    const isCurrent = () => {
      const current = getConnection(config);
      return current.isConnected && current.address?.toLowerCase() === address.toLowerCase() &&
        current.chainId === chainId && current.connector?.uid === connector.uid;
    };
    const unsubscribe = config.subscribe((state) => state, () => {
      if (!isCurrent()) controller.abort(new Error("Wallet changed during sign-in. Try again."));
    });
    setError(null);
    try {
      await runSiweSignIn({
        address, chainId, domain: window.location.host, uri: window.location.origin,
        signMessage: (message) => signMessageAsync({ message, account: address, connector }),
        refreshSession, isCurrent, signal: controller.signal,
        onPhase: (next) => { if (active.current === controller) setPhase(next); },
      });
      controller.signal.throwIfAborted();
      if (!isCurrent() || active.current !== controller) return false;
      setPhase("done");
      return true;
    } catch (e) {
      if (active.current === controller) {
        setError(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
        setPhase("error");
      }
      return false;
    } finally {
      unsubscribe();
      if (active.current === controller) active.current = null;
    }
  }, [config, refreshSession, signMessageAsync]);

  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setPhase("idle");
    setError(null);
  }, []);

  return {
    signIn,
    phase,
    error,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
    cancel,
  };
}
