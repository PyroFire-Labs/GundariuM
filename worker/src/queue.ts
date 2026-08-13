import { Redis } from "@upstash/redis";
import type { ModelJob } from "./types.js";

const redis = Redis.fromEnv();

// Shared with src/app/api/generate-model/route.ts in the main app — same
// Upstash instance, same key. Changing this string requires changing it in
// both places.
export const MODEL_JOB_QUEUE_KEY = "model:jobs";

/**
 * Upstash's REST API has no blocking pop (BRPOP) — it's HTTP request/response,
 * not a persistent connection — so the worker polls with a plain RPOP on an
 * interval instead of blocking server-side.
 */
export async function dequeueModelJob(): Promise<ModelJob | null> {
  const job = await redis.rpop<ModelJob>(MODEL_JOB_QUEUE_KEY);
  return job ?? null;
}

export async function enqueueModelJob(job: ModelJob): Promise<void> {
  await redis.lpush(MODEL_JOB_QUEUE_KEY, job);
}
