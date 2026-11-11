import { createHash } from "node:crypto";

const QUEUE_KEY = "rosco:mail-review:v1:pending";
const TASK_KEY_PREFIX = "rosco:mail-review:v1:task:";

interface RedisLike {
  eval<TArgs extends unknown[], TResult>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TResult>;
  lrange<TResult = string>(key: string, start: number, stop: number): Promise<TResult[]>;
  get<TResult>(key: string): Promise<TResult | null>;
}

export interface RoscoMailReviewTask {
  id: string;
  state: "pending_review";
  receivedAt: string;
  inboxId: string;
  messageId: string;
  threadId: string;
  senderDomain: string | null;
  subject: string;
  contentReference: {
    provider: "agentmail";
    inboxId: string;
    messageId: string;
  };
  contentTrust: "untrusted";
  allowedAction: "human_review_only";
}

export function makeRoscoMailTaskId(inboxId: string, messageId: string): string {
  return createHash("sha256").update(`${inboxId}\0${messageId}`).digest("hex");
}

function taskKey(taskId: string): string {
  return `${TASK_KEY_PREFIX}${taskId}`;
}

export function createRoscoMailReviewStore(client: RedisLike) {
  return {
    /** Atomically insert a task once for its inbox/message pair and index it. */
    async enqueue(task: RoscoMailReviewTask): Promise<boolean> {
      const inserted = await client.eval<[string, string], number>(
        `
          if redis.call("EXISTS", KEYS[1]) == 1 then
            return 0
          end
          redis.call("SET", KEYS[1], ARGV[1])
          redis.call("LPUSH", KEYS[2], ARGV[2])
          return 1
        `,
        [taskKey(task.id), QUEUE_KEY],
        [JSON.stringify(task), task.id],
      );

      return inserted === 1;
    },

    async list(offset: number, limit: number): Promise<RoscoMailReviewTask[]> {
      const ids = await client.lrange<string>(QUEUE_KEY, offset, offset + limit - 1);
      if (ids.length === 0) return [];

      const tasks = await Promise.all(
        ids.map((id) => client.get<RoscoMailReviewTask>(taskKey(id))),
      );
      return tasks.filter((task): task is RoscoMailReviewTask => task !== null);
    },

    async get(taskId: string): Promise<RoscoMailReviewTask | null> {
      return client.get<RoscoMailReviewTask>(taskKey(taskId));
    },
  };
}

export function sanitizeMailSubject(value: unknown): string {
  if (typeof value !== "string") return "(no subject)";
  const clean = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return clean || "(no subject)";
}

export function extractSenderDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.match(/<\s*([^<>]+)\s*>/)?.[1] ?? value;
  const at = address.lastIndexOf("@");
  if (at < 1) return null;
  const domain = address.slice(at + 1).trim().toLowerCase().replace(/[>].*$/, "");
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    domain,
  )
    ? domain
    : null;
}
