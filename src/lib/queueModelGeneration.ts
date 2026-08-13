import type { KitbashTraits } from "@/types/nft";

/**
 * Fire-and-forget POST to /api/generate-model right after a real mint's
 * tokenId is known. Deliberately doesn't block or surface errors to the
 * mint flow — the 3D model is a background enhancement, not part of the
 * mint's success criteria (the card is already minted and usable without
 * it). Failures are visible via the worker's own Telegram alert instead.
 */
export function queueModelGeneration(
  tokenId: bigint,
  kitbashTraits: KitbashTraits | null
): void {
  if (!kitbashTraits) return;
  fetch("/api/generate-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenId: tokenId.toString(), kitbashTraits }),
  }).catch(() => {
    // Best-effort only — see doc comment above.
  });
}
