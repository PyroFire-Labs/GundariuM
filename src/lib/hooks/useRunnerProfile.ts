"use client";

/**
 * React hook for fetching a wallet's Runner Profile. Calls the public
 * /api/runner-profile/[address] endpoint, which sources from Farcaster
 * (Phase 1) and will fall back to a custom KV profile in Phase 2.
 *
 * Returns an idle state for null/undefined addresses, so it's safe to
 * use in components that haven't connected a wallet yet.
 */

import { useEffect, useState } from "react";
import type { RunnerProfile } from "@/types/runner";

interface UseRunnerProfileResult {
  profile: RunnerProfile | null;
  loading: boolean;
  error: string | null;
}

export function useRunnerProfile(
  address: string | null | undefined
): UseRunnerProfileResult {
  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/runner-profile/${address.toLowerCase()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: RunnerProfile) => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "profile fetch failed");
          setProfile(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { profile, loading, error };
}

/**
 * Convenience helper for the card-display use case. Returns the best
 * available display name in priority order:
 *   1. Profile runnerName (custom or Farcaster display name)
 *   2. Farcaster username (if profile sourced from Farcaster)
 *   3. The card's pilotName (the on-chain trait value)
 *   4. A truncated address (e.g. "0xa1b2…ef34")
 */
export function resolveRunnerDisplayName(
  profile: RunnerProfile | null,
  fallbackPilotName: string,
  address: string | null | undefined
): string {
  if (profile?.runnerName) return profile.runnerName;
  if (profile?.farcasterUsername) return `@${profile.farcasterUsername}`;
  if (fallbackPilotName && fallbackPilotName !== "Autonomous AI") {
    return fallbackPilotName;
  }
  if (address) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  return fallbackPilotName || "Unbound";
}
