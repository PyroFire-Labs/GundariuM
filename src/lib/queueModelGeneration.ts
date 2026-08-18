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
  // The chain the mint actually happened on — required, not inferred.
  // GunplaCard's tokenId sequence restarts at 1 per chain (mainnet + Base
  // Sepolia), so a tokenId alone can't disambiguate which chain's 3D model
  // this job is for. See src/lib/modelStore.ts's statusKey comment.
  chainId: number,
  kitbashTraits: KitbashTraits | null,
  // Not part of KitbashTraits — derived at generate-kitbash time and carried
  // on TraitSet instead. Pass traits.secondaryWeapon / traits.tertiaryWeapon
  // from the caller's already-in-scope TraitSet. Needed so the 3D worker can
  // bake real per-move battle animations for all three attack slots, not
  // just primary — see worker/blender/lib/animation.py.
  secondaryWeapon: string,
  tertiaryWeapon: string
): void {
  if (!kitbashTraits) return;
  fetch("/api/generate-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenId: tokenId.toString(),
      chainId,
      kitbashTraits,
      secondaryWeapon,
      tertiaryWeapon,
    }),
  }).catch(() => {
    // Best-effort only — see doc comment above.
  });
}
