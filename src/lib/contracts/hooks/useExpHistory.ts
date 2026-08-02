"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";

export interface ExpHistory {
  loading: boolean;
  gnrmBuyDays: number;
  stakeClaims: number;
  dossierShares: number;
  arenaShares: number;
  perfectWeeks: number;
  /** gnrmBuyDays*12 + stakeClaims*50 + dossierShares*8 + arenaShares*8 + perfectWeeks*200 */
  bonusExp: number;
  /** Re-fetches from /api/exp-history — see the doc comment on useExpHistory for why this exists. */
  refetch: () => void;
}

const NOOP = () => {};

const EMPTY: ExpHistory = {
  loading: true,
  gnrmBuyDays: 0,
  stakeClaims: 0,
  dossierShares: 0,
  arenaShares: 0,
  perfectWeeks: 0,
  bonusExp: 0,
  refetch: NOOP,
};

type ExpHistoryData = Omit<ExpHistory, "refetch">;

const EMPTY_DATA: ExpHistoryData = {
  loading: true,
  gnrmBuyDays: 0,
  stakeClaims: 0,
  dossierShares: 0,
  arenaShares: 0,
  perfectWeeks: 0,
  bonusExp: 0,
};

/**
 * Permanent EXP bonuses reconstructed from on-chain event history, rather
 * than "is this true right now" flags (which reset at UTC midnight and
 * made the tasks page's displayed total look like it was decaying every
 * day). The actual scan happens server-side, in /api/exp-history, with
 * an incrementally-cached "last scanned block" per wallet — this hook is
 * just a thin fetch wrapper. It used to scan the wallet's entire history
 * client-side on every mount, which is what tripped the public RPC's
 * rate limit in production; that logic now lives server-side where it
 * only ever re-scans the delta since the last request.
 *
 * The fetch only re-runs on wallet change by itself — completing a task
 * mid-session doesn't change `address`, so the returned `refetch()`
 * exists for the page to call right after any task-completing action
 * succeeds, otherwise the total would look frozen until the next reload.
 */
export function useExpHistory(address: Address | undefined): ExpHistory {
  const [data, setData] = useState<ExpHistoryData>(EMPTY_DATA);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    (async () => {
      setData((prev) => ({ ...prev, loading: true }));
      try {
        const res = await fetch(`/api/exp-history?address=${address}`);
        if (!res.ok) throw new Error(`exp-history request failed: ${res.status}`);
        const json = (await res.json()) as Omit<ExpHistoryData, "loading">;
        if (cancelled) return;
        setData({ loading: false, ...json });
      } catch (err) {
        console.error("useExpHistory fetch failed:", err);
        if (cancelled) return;
        setData((prev) => ({ ...prev, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  if (!address) return EMPTY;
  return { ...data, refetch };
}
