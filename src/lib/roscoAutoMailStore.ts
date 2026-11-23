import { createHash } from "node:crypto";
import type { AutoState, Reference, ThreadAdmission } from "./roscoAutoMailCore";

interface RedisClient {
  eval<T>(script: string, keys: string[], args: unknown[]): Promise<T>;
}
const DUE = "rosco:auto-mail:v1:due";
const STATE = "rosco:auto-mail:v1:states";
const LEASES = "rosco:auto-mail:v1:leases";
export const LEASE_MS = 120_000;
export const THREAD_LIMITS = { shortWindow:600_000, shortCount:3, dayWindow:86_400_000, dayCount:12, breakMs:1_800_000, failureCount:3 } as const;
function threadKeys(task: Reference): string[] {
  const digest = createHash("sha256").update(`${task.inboxId}\0${task.threadId}`).digest("hex");
  return [`rosco:auto-mail:v2:thread:${digest}`, `rosco:auto-mail:v2:allowances:${digest}`];
}
export function createAutoMailStore(redis: RedisClient) {
  return {
    /** One active worker per thread; admitted retries retain their original allowance. */
    async acquireThread(task: Reference, token: string, now = Date.now()): Promise<ThreadAdmission> {
      const result = await redis.eval<string>(`
        local deadline = redis.call('ZSCORE', KEYS[1], ARGV[1])
        if redis.call('HGET', KEYS[3], ARGV[1]) ~= ARGV[2] or not deadline or tonumber(deadline) <= tonumber(ARGV[3]) then
          return cjson.encode({status='busy'})
        end
        local raw = redis.call('GET', KEYS[4])
        local guard = raw and cjson.decode(raw) or {failures=0, openUntil=0}
        redis.call('ZREMRANGEBYSCORE', KEYS[5], '-inf', tonumber(ARGV[3])-tonumber(ARGV[4]))
        local admitted = redis.call('ZSCORE', KEYS[5], ARGV[1])
        if not admitted then
          if guard.openUntil > tonumber(ARGV[3]) then return cjson.encode({status='review_only'}) end
          local short = redis.call('ZCOUNT', KEYS[5], tonumber(ARGV[3])-tonumber(ARGV[5]), '+inf')
          if short >= tonumber(ARGV[6]) or redis.call('ZCARD', KEYS[5]) >= tonumber(ARGV[7]) then
            guard.openUntil = tonumber(ARGV[3])+tonumber(ARGV[8])
            redis.call('SET', KEYS[4], cjson.encode(guard))
            return cjson.encode({status='review_only'})
          end
        end
        if guard.taskId and (guard.taskId ~= ARGV[1] or (guard.token ~= '' and guard.token ~= ARGV[2])) then
          if guard.untilAt > tonumber(ARGV[3]) then return cjson.encode({status='busy'}) end
          local oldRaw = redis.call('HGET', KEYS[2], guard.taskId)
          local old = oldRaw and cjson.decode(oldRaw)
          if guard.taskId ~= ARGV[1] and old and old.phase ~= 'sent' and old.phase ~= 'review_only' then
            -- Do not shorten an already renewed predecessor lease.
            local oldDeadline=redis.call('ZSCORE', KEYS[1], guard.taskId)
            local oldToken=redis.call('HGET', KEYS[3], guard.taskId)
            if not oldToken or not oldDeadline or tonumber(oldDeadline)<=tonumber(ARGV[3]) then
              redis.call('ZADD', KEYS[1], ARGV[3], guard.taskId)
            end
            return cjson.encode({status='busy'})
          end
        end
        if not admitted then redis.call('ZADD', KEYS[5], ARGV[3], ARGV[1]) end
        guard.taskId=ARGV[1]; guard.token=ARGV[2]; guard.untilAt=tonumber(deadline)
        redis.call('SET', KEYS[4], cjson.encode(guard))
        return cjson.encode({status='acquired', lastReplyId=guard.lastReplyId})
      `, [DUE,STATE,LEASES,...threadKeys(task)], [task.id,token,now,THREAD_LIMITS.dayWindow,THREAD_LIMITS.shortWindow,THREAD_LIMITS.shortCount,THREAD_LIMITS.dayCount,THREAD_LIMITS.breakMs]);
      return typeof result === "string" ? JSON.parse(result) : result;
    },
    async verifyThread(task: Reference, token: string, now = Date.now()): Promise<boolean> {
      return await redis.eval<number>(`
        local raw=redis.call('GET', KEYS[3]); if not raw then return 0 end
        local guard=cjson.decode(raw)
        local deadline=redis.call('ZSCORE', KEYS[1], ARGV[1])
        if redis.call('HGET', KEYS[2], ARGV[1]) ~= ARGV[2] or not deadline or tonumber(deadline) <= tonumber(ARGV[3]) then return 0 end
        if guard.taskId ~= ARGV[1] or guard.token ~= ARGV[2] or guard.untilAt <= tonumber(ARGV[3]) then return 0 end
        return 1
      `,[DUE,LEASES,threadKeys(task)[0]],[task.id,token,now]) === 1;
    },
    async claim(token: string, now = Date.now()): Promise<{ id: string; state: AutoState } | null> {
      const result = await redis.eval<string | null>(`
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
      `,[DUE,STATE,LEASES],[now,token,now+LEASE_MS]);
      return typeof result === "string" ? JSON.parse(result) : result;
    },
    async save(id: string, token: string, state: AutoState, now = Date.now(), task?: Reference): Promise<boolean> {
      return await redis.eval<number>(`
        if redis.call('HGET', KEYS[3], ARGV[1]) ~= ARGV[2] then return 0 end
        local deadline = redis.call('ZSCORE', KEYS[1], ARGV[1])
        if not deadline or tonumber(deadline) <= tonumber(ARGV[4]) then return 0 end
        local guardRaw = ARGV[7]=='1' and redis.call('GET', KEYS[4])
        local guard = guardRaw and cjson.decode(guardRaw)
        if ARGV[7]=='1' and (ARGV[5]=='delivering' or ARGV[5]=='sent') then
          if not guard or guard.taskId ~= ARGV[1] or guard.token ~= ARGV[2] or guard.untilAt <= tonumber(ARGV[4]) then return 0 end
        end
        local state=cjson.decode(ARGV[3])
        if ARGV[5]=='sent' and not state.replyMessageId then return 0 end
        redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
        if ARGV[5]=='delivering' then return 1 end
        if guard and guard.taskId==ARGV[1] and (guard.token==ARGV[2] or guard.token=='' or guard.untilAt<=tonumber(ARGV[4])) then
          if ARGV[5]=='retry' then
            -- Hold the thread across backoff; the same task can resume on a new lease.
            guard.token=''; guard.untilAt=tonumber(ARGV[6])+tonumber(ARGV[8])
          else
            guard.taskId=nil; guard.token=nil; guard.untilAt=nil
            if ARGV[5]=='sent' then guard.lastReplyId=state.replyMessageId; guard.failures=0
            elseif redis.call('ZSCORE', KEYS[5], ARGV[1]) then
              guard.failures=(guard.failures or 0)+1
              if guard.failures>=tonumber(ARGV[9]) then
                guard.openUntil=tonumber(ARGV[4])+tonumber(ARGV[10]); guard.failures=0
              end
            end
          end
          redis.call('SET', KEYS[4], cjson.encode(guard))
        end
        redis.call('HDEL', KEYS[3], ARGV[1])
        if ARGV[5]=='retry' then redis.call('ZADD', KEYS[1], ARGV[6], ARGV[1])
        else redis.call('ZREM', KEYS[1], ARGV[1]) end
        return 1
      `,[DUE,STATE,LEASES,...(task ? threadKeys(task) : [STATE+':unused',STATE+':unused-allowances'])],
      [id,token,JSON.stringify(state),now,state.phase,state.nextAt??now,task?'1':'0',LEASE_MS,THREAD_LIMITS.failureCount,THREAD_LIMITS.breakMs]) === 1;
    },
  };
}
