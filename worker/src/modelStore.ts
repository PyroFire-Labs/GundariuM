import { Redis } from "@upstash/redis";
import type { ModelStatus, ModelStatusState } from "./types.js";

const redis = Redis.fromEnv();

// Shared key scheme with src/lib/modelStore.ts in the main app.
const statusKey = (tokenId: string) => `model:status:${tokenId}`;

export async function setModelStatus(
  tokenId: string,
  status: ModelStatusState,
  extra: Partial<Pick<ModelStatus, "uri" | "error">> = {}
): Promise<void> {
  const value: ModelStatus = { status, updatedAt: Date.now(), ...extra };
  await redis.set(statusKey(tokenId), value);
}

export async function getModelStatus(tokenId: string): Promise<ModelStatus | null> {
  return (await redis.get<ModelStatus>(statusKey(tokenId))) ?? null;
}
