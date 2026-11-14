import { Webhook } from "svix";
import {
  makeRoscoMailTaskId,
  sanitizeMailSubject,
  extractSenderDomain,
  type RoscoMailReviewTask,
} from "./roscoMailReviewStoreCore";

const MAX_BODY_BYTES = 128 * 1024;
const VERIFY_HEADERS = ["svix-id", "svix-timestamp", "svix-signature"] as const;

export interface AgentMailWebhookConfig {
  secret?: string;
  inboxId?: string;
}

export interface AgentMailWebhookDependencies {
  getConfig(): AgentMailWebhookConfig;
  enqueue(task: RoscoMailReviewTask): Promise<unknown>;
}

async function readBodyWithinLimit(request: Request): Promise<Buffer | null> {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

function taskFromEvent(inboxId: string, value: unknown): RoscoMailReviewTask | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (event.event_type !== "message.received") return null;

  const message = event.message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const fields = message as Record<string, unknown>;
  if (fields.inbox_id !== inboxId) return null;

  const messageId = fields.message_id;
  const threadId = fields.thread_id;
  const timestamp = fields.timestamp;
  if (
    typeof messageId !== "string" ||
    messageId.length < 1 ||
    messageId.length > 512 ||
    typeof threadId !== "string" ||
    threadId.length < 1 ||
    threadId.length > 512 ||
    typeof timestamp !== "string" ||
    !Number.isFinite(Date.parse(timestamp))
  ) {
    return null;
  }

  return {
    id: makeRoscoMailTaskId(inboxId, messageId),
    state: "pending_review",
    receivedAt: new Date(timestamp).toISOString(),
    inboxId,
    messageId,
    threadId,
    senderDomain: extractSenderDomain(fields.from),
    subject: sanitizeMailSubject(fields.subject),
    contentReference: { provider: "agentmail", inboxId, messageId },
    contentTrust: "untrusted",
    allowedAction: "human_review_only",
  };
}

export function createAgentMailWebhookHandler({
  getConfig,
  enqueue,
}: AgentMailWebhookDependencies) {
  return async function handleAgentMailWebhook(request: Request): Promise<Response> {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return new Response("Unsupported media type", { status: 415 });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return new Response("Payload too large", { status: 413 });
    }

    const { secret, inboxId } = getConfig();
    if (!secret || !inboxId) {
      return new Response("Webhook is not configured", { status: 503 });
    }

    const rawBody = await readBodyWithinLimit(request);
    if (!rawBody) return new Response("Payload too large", { status: 413 });

    const headers = Object.fromEntries(
      VERIFY_HEADERS.map((name) => [name, request.headers.get(name) ?? ""]),
    );
    try {
      new Webhook(secret).verify(rawBody, headers);
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    if (!event || typeof event !== "object" || Array.isArray(event)) {
      return new Response("Bad Request", { status: 400 });
    }
    const fields = event as Record<string, unknown>;
    if (fields.event_type !== "message.received") {
      return new Response("Unsupported event", { status: 400 });
    }

    const message = fields.message;
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return new Response("Bad Request", { status: 400 });
    }
    const eventInboxId = (message as Record<string, unknown>).inbox_id;
    if (typeof eventInboxId !== "string") {
      return new Response("Bad Request", { status: 400 });
    }
    if (eventInboxId !== inboxId) return new Response("Forbidden", { status: 403 });

    const task = taskFromEvent(inboxId, event);
    if (!task) return new Response("Bad Request", { status: 400 });

    try {
      await enqueue(task);
    } catch {
      // A 5xx asks AgentMail to retry; do not acknowledge an event that was not stored.
      return new Response("Temporary storage failure", { status: 503 });
    }

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  };
}
