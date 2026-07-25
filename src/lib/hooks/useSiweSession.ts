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
