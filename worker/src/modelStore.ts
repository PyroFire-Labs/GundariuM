import { Redis } from "@upstash/redis";
import type { ModelStatus, ModelStatusState } from "./types.js";

const redis = Redis.fromEnv();

// Shared key scheme with src/lib/modelStore.ts in the main app — chainId is
// part of the key (see that file's comment): GunplaCard's tokenId sequence
// restarts at 1 per chain, so the key must disambiguate which chain's
// token this status is for.
const statusKey = (chainId: number, tokenId: string) => `model:status:${chainId}:${tokenId}`;

export async function setModelStatus(
  chainId: number,
  tokenId: string,
  status: ModelStatusState,
  extra: Partial<Pick<ModelStatus, "uri" | "error">> = {}
): Promise<void> {
  const value: ModelStatus = { status, updatedAt: Date.now(), ...extra };
  await redis.set(statusKey(chainId, tokenId), value);
}

export async function getModelStatus(chainId: number, tokenId: string): Promise<ModelStatus | null> {
  return (await redis.get<ModelStatus>(statusKey(chainId, tokenId))) ?? null;
}
