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
// chainId is part of the key, not just the payload — GunplaCard is deployed
// independently per chain (mainnet + Base Sepolia), each with its own
// tokenId sequence starting at 1. Without the chain in the key, mainnet
// token 5 and Sepolia token 5 collide on the same status key and can each
// clobber the other's (unrelated) 3D model. Found this Aug 18, 2026 while
// wiring the Arena's Sepolia NPC roster — no collision had happened yet
// (the worker didn't exist before that night), but it was guaranteed to the
// moment both chains had overlapping tokenIds, which they already do.
const statusKey = (chainId: number, tokenId: string) => `model:status:${chainId}:${tokenId}`;

export type ModelStatusState = "pending" | "processing" | "ready" | "failed";

export interface ModelStatus {
  status: ModelStatusState;
  uri?: string;
  error?: string;
  updatedAt: number;
}

export interface ModelJob {
  chainId: number;
  tokenId: string;
  traits: Pick<
    KitbashTraits,
    "frameType" | "head" | "primaryWeapon" | "backpack" | "colorway" | "special"
  > & {
    // Not part of KitbashTraits (the raw rolled generation-input traits) —
    // these are derived at generate-kitbash time (deriveSecondaryWeapon) and
    // live on TraitSet instead. Carried here as plain extra fields rather
    // than forcing them onto KitbashTraits, which genuinely doesn't have them.
    secondaryWeapon: string;
    tertiaryWeapon: string;
  };
  enqueuedAt: number;
}

export async function enqueueModelJob(job: ModelJob): Promise<void> {
  await redis.lpush(MODEL_JOB_QUEUE_KEY, job);
  // Set eagerly so a poll that lands before the worker picks the job up sees
  // "pending" rather than a stale/missing key.
  await redis.set(statusKey(job.chainId, job.tokenId), {
    status: "pending",
    updatedAt: Date.now(),
  } satisfies ModelStatus);
}

export async function getModelStatus(chainId: number, tokenId: string): Promise<ModelStatus | null> {
  try {
    return (await redis.get<ModelStatus>(statusKey(chainId, tokenId))) ?? null;
  } catch (err) {
    console.error(`getModelStatus failed for chain ${chainId} token ${tokenId}:`, err);
    return null;
  }
}
