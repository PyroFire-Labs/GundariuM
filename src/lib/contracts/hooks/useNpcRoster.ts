"use client";

import { baseSepolia } from "wagmi/chains";
import { useCollection } from "./useCollection";

// The Arena's PVE opponents are Josh's own Sepolia test mints — not the
// player's connected wallet, and not tied to whatever chain the player's
// wallet happens to be on. Requires NEXT_PUBLIC_NPC_ROSTER_ADDRESS (the
// Sepolia wallet holding the intended NPC roster) to be set; returns an
// empty roster (not an error) when it isn't, same fail-open posture as the
// rest of this pipeline.
const NPC_ROSTER_ADDRESS = process.env.NEXT_PUBLIC_NPC_ROSTER_ADDRESS as `0x${string}` | undefined;

export function useNpcRoster() {
  const result = useCollection(NPC_ROSTER_ADDRESS, baseSepolia.id);
  return {
    ...result,
    isConfigured: !!NPC_ROSTER_ADDRESS,
  };
}
