import type { AutoState } from "./roscoAutoMailCore";

interface RedisClient {
  eval<T>(script: string, keys: string[], args: unknown[]): Promise<T>;
}
const DUE = "rosco:auto-mail:v1:due";
const STATE = "rosco:auto-mail:v1:states";
const LEASES = "rosco:auto-mail:v1:leases";
export const LEASE_MS = 120_000;
export function createAutoMailStore(redis: RedisClient) {
  return {
    async claim(
      token: string,
      now = Date.now(),
    ): Promise<{ id: string; state: AutoState } | null> {
      const result = await redis.eval<string | null>(
        `
        local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 1)
        if #ids == 0 then return nil end
        local id = ids[1]
        local raw = redis.call('HGET', KEYS[2], id)
        local state = raw and cjson.decode(raw) or {phase='processing', attempts=0}
        if state.phase == 'sent' or state.phase == 'review_only' then
          redis.call('ZREM', KEYS[1], id)
          return nil
        end
        state.attempts = state.attempts + 1
        redis.call('HSET', KEYS[2], id, cjson.encode(state))
        redis.call('HSET', KEYS[3], id, ARGV[2])
        redis.call('ZADD', KEYS[1], ARGV[3], id)
        return cjson.encode({id=id, state=state})
      `,
        [DUE, STATE, LEASES],
        [now, token, now + LEASE_MS],
      );
      return typeof result === "string" ? JSON.parse(result) : result;
    },
    async save(
      id: string,
      token: string,
      state: AutoState,
      now = Date.now(),
    ): Promise<boolean> {
      return (
        (await redis.eval<number>(
          `
        if redis.call('HGET', KEYS[3], ARGV[1]) ~= ARGV[2] then return 0 end
        local deadline = redis.call('ZSCORE', KEYS[1], ARGV[1])
        if not deadline or tonumber(deadline) <= tonumber(ARGV[4]) then return 0 end
        redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
        if ARGV[5] == 'delivering' then return 1 end
        redis.call('HDEL', KEYS[3], ARGV[1])
        if ARGV[5] == 'retry' then
          redis.call('ZADD', KEYS[1], ARGV[6], ARGV[1])
        else redis.call('ZREM', KEYS[1], ARGV[1]) end
        return 1
      `,
          [DUE, STATE, LEASES],
          [
            id,
            token,
            JSON.stringify(state),
            now,
            state.phase,
            state.nextAt ?? now,
          ],
        )) === 1
      );
    },
  };
}
