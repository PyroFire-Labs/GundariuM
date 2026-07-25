/**
 * Server-only SIWE + session storage. Nonces and sessions both live in the
 * same Upstash Redis instance already used by lineupStore.ts and the
 * leaderboard cache — no new infra, no new Doppler secret.
 */

import { Redis } from "@upstash/redis";
import { generateSiweNonce } from "viem/siwe";

const redis = Redis.fromEnv();

export const SESSION_COOKIE_NAME = "gundarium_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const NONCE_TTL_SECONDS = 60 * 5; // 5 minutes

interface SessionData {
  address: string;
}

function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

function nonceKey(nonce: string): string {
  return `siwe:nonce:${nonce}`;
}

/** Issues a fresh SIWE nonce, stored server-side for one-time use. */
export async function issueNonce(): Promise<string> {
  const nonce = generateSiweNonce();
  await redis.set(nonceKey(nonce), "1", { ex: NONCE_TTL_SECONDS });
  return nonce;
}

/**
 * Consumes a nonce — true if it was valid and unused, false otherwise.
 * Deletes it either way so it can never be checked twice (one-time use,
 * and this is what makes a replayed sign-in request fail the second time).
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  const key = nonceKey(nonce);
  const result = await redis.getdel(key);
  return result !== null;
}

export async function createSession(address: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  await redis.set<SessionData>(
    sessionKey(sessionId),
    { address },
    { ex: SESSION_TTL_SECONDS }
  );
  return sessionId;
}

export async function getSessionAddress(
  sessionId: string | undefined
): Promise<string | null> {
  if (!sessionId) return null;
  try {
    const data = await redis.get<SessionData>(sessionKey(sessionId));
    return data?.address ?? null;
  } catch (err) {
    console.error(`getSessionAddress failed for session ${sessionId}:`, err);
    return null;
  }
}

export async function destroySession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  await redis.del(sessionKey(sessionId));
}
