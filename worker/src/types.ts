// Mirrors the geometry-relevant subset of KitbashTraits in the main app's
// src/types/nft.ts. Duplicated rather than imported — this package has no
// build-time dependency on the Next.js app, since it runs on wholly
// different infrastructure (wherever Blender is installed, not Vercel).
export interface ModelTraits {
  frameType: string;
  head: string;
  primaryWeapon: string;
  secondaryWeapon: string;
  tertiaryWeapon: string;
  backpack: string;
  colorway: string;
  special: string;
}

export interface ModelJob {
  tokenId: string;
  traits: ModelTraits;
  enqueuedAt: number;
}

export type ModelStatusState = "pending" | "processing" | "ready" | "failed";

export interface ModelStatus {
  status: ModelStatusState;
  uri?: string;
  error?: string;
  updatedAt: number;
}
