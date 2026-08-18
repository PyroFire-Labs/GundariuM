"use client";

import { useEffect, useState } from "react";

export type ModelStatusValue =
  | "unknown"
  | "pending"
  | "processing"
  | "ready"
  | "failed";

interface ModelStatusResponse {
  status: ModelStatusValue;
  modelUrl?: string;
  error?: string;
}

const POLL_MS = 5000;
// ~5 minutes of polling — the placeholder pipeline is render-time only (no
// external AI call), so a real job finishes in seconds; this just bounds how
// long a tab keeps polling if a job is stuck or was never queued.
const MAX_POLLS = 60;

/**
 * Polls /api/model-status/[tokenId]?chainId=... until the background 3D-model
 * worker (see worker/ at the repo root) reports ready/failed, or the poll
 * budget runs out. Returns null tokenId/chainId as a no-op so callers can
 * pass an optional/not-yet-known tokenId without guarding every call site.
 *
 * chainId is required whenever tokenId is non-null — GunplaCard's tokenId
 * sequence restarts at 1 per chain, so a tokenId alone is ambiguous. See
 * src/lib/modelStore.ts's statusKey comment for why this matters.
 */
export function useModelStatus(tokenId: bigint | string | null, chainId: number | null) {
  const [state, setState] = useState<ModelStatusResponse>({ status: "unknown" });

  useEffect(() => {
    if (tokenId === null || chainId === null) return;
    const id = tokenId.toString();
    let cancelled = false;
    let polls = 0;

    const poll = async () => {
      try {
        const res = await fetch(`/api/model-status/${id}?chainId=${chainId}`);
        const data = (await res.json()) as ModelStatusResponse;
        if (!cancelled) setState(data);
        return data.status;
      } catch {
        return "unknown";
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      const status = await poll();
      polls += 1;
      const done = status === "ready" || status === "failed";
      if (!cancelled && !done && polls < MAX_POLLS) {
        timer = setTimeout(loop, POLL_MS);
      }
    };
    loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tokenId, chainId]);

  return state;
}
