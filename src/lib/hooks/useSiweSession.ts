"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { readSiweSession, sessionMismatchError } from "@/lib/walletAuthCore";

export function useSiweSession() {
  const { address: connectedAddress } = useAccount();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async (signal?: AbortSignal): Promise<string | null> => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const address = await readSiweSession(fetch, signal);
      signal?.throwIfAborted();
      if (id === requestId.current) setSessionAddress(address);
      return address;
    } catch (cause) {
      if (id === requestId.current && !signal?.aborted) {
        setSessionAddress(null);
        setError("Session refresh failed. Please try again.");
      }
      throw cause;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // refresh records the error for the UI; avoid an unhandled effect promise.
    void refresh(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [refresh, connectedAddress]);

  const isSignedIn =
    !!sessionAddress &&
    !!connectedAddress &&
    sessionAddress.toLowerCase() === connectedAddress.toLowerCase();

  return {
    isSignedIn, sessionAddress, loading, refresh,
    error: error ?? sessionMismatchError(sessionAddress, connectedAddress),
  };
}
