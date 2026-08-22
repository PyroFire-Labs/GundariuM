import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const windowSeconds = Math.ceil(windowMs / 1000);

  try {
    // Single round trip: INCR bumps (or creates) the counter, EXPIRE NX sets
    // the TTL only on the first request so the window is fixed from when it
    // opened — not sliding. NX means "only set if the key has no expiry yet"
    // so subsequent requests in the same window leave the deadline alone.
    const [count] = await redis
      .pipeline()
      .incr(key)
      .expire(key, windowSeconds, "nx")
      .exec();

    const n = count as number;
    if (n <= maxRequests) {
      return { allowed: true, remaining: maxRequests - n, retryAfterMs: 0 };
    }

    const ttl = await redis.ttl(key);
    return { allowed: false, remaining: 0, retryAfterMs: ttl > 0 ? ttl * 1000 : windowMs };
  } catch (err) {
    // Redis unavailable — fail open so a database blip doesn't block every
    // user from generating. The hard spend cap on the Google AI account is
    // the backstop against runaway cost if this path is hit repeatedly.
    console.error("checkRateLimit: Redis error, failing open:", err);
    return { allowed: true, remaining: maxRequests, retryAfterMs: 0 };
  }
}
