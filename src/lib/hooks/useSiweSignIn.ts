"use client";

import { useCallback, useRef, useState } from "react";
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
  const cancelledRef = useRef(false);

  const signIn = useCallback(async (): Promise<boolean> => {
    cancelledRef.current = false;
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

      if (cancelledRef.current) {
        setPhase("idle");
        return false;
      }

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

  const cancel = () => {
    cancelledRef.current = true;
  };

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
