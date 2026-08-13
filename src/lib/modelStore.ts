/**
 * 3D model generation — queue + status storage, server-side only.
 *
 * A mint enqueues a job here (see /api/generate-model) once its tokenId is
 * known. A separate worker process — running wherever headless Blender is
 * installed, not on Vercel (see worker/ at the repo root) — pops jobs off
 * this queue, assembles a GLB from the trait set, uploads it to IPFS, and
 * writes the result back to the status key. The card page / collection poll
 * /api/model-status/[tokenId] to pick it up once ready.
 *
 * Non-critical by design, same posture as leaderboardStore: a missing/broken
 * Redis here means "no 3D model yet," never a blocked mint.
 */

import { Redis } from "@upstash/redis";
import type { KitbashTraits } from "@/types/nft";

const redis = Redis.fromEnv();

// Shared with worker/src/queue.ts and worker/src/modelStore.ts — same
// Upstash instance, same key names. Changing these requires changing both.
const MODEL_JOB_QUEUE_KEY = "model:jobs";
const statusKey = (tokenId: string) => `model:status:${tokenId}`;

export type ModelStatusState = "pending" | "processing" | "ready" | "failed";

export interface ModelStatus {
  status: ModelStatusState;
  uri?: string;
  error?: string;
  updatedAt: number;
}

export interface ModelJob {
  tokenId: string;
  traits: Pick<
    KitbashTraits,
    "frameType" | "head" | "primaryWeapon" | "backpack" | "colorway" | "special"
  >;
  enqueuedAt: number;
}

export async function enqueueModelJob(job: ModelJob): Promise<void> {
  await redis.lpush(MODEL_JOB_QUEUE_KEY, job);
  // Set eagerly so a poll that lands before the worker picks the job up sees
  // "pending" rather than a stale/missing key.
  await redis.set(statusKey(job.tokenId), {
    status: "pending",
    updatedAt: Date.now(),
  } satisfies ModelStatus);
}

export async function getModelStatus(tokenId: string): Promise<ModelStatus | null> {
  try {
    return (await redis.get<ModelStatus>(statusKey(tokenId))) ?? null;
  } catch (err) {
    console.error(`getModelStatus failed for token ${tokenId}:`, err);
    return null;
  }
}
