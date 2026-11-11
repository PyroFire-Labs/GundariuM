import type { RoscoMailReviewTask } from "./roscoMailReviewStoreCore";

export interface RoscoMailReviewDependencies {
  authorize(request: Request): Promise<Response | null>;
  listTasks(offset: number, limit: number): Promise<RoscoMailReviewTask[]>;
  getTask(taskId: string): Promise<RoscoMailReviewTask | null>;
  getApiKey(): string | undefined;
  fetchMessage: typeof fetch;
}

type AgentMailMessageResponse = {
  message?: Record<string, unknown>;
  [key: string]: unknown;
};

function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function createRoscoMailReviewHandlers({
  authorize,
  listTasks,
  getTask,
  getApiKey,
  fetchMessage,
}: RoscoMailReviewDependencies) {
  return {
    async list(request: Request): Promise<Response> {
      const denied = await authorize(request);
      if (denied) return denied;

      const query = new URL(request.url).searchParams;
      const limit = Number(query.get("limit") ?? 20);
      const offset = Number(query.get("offset") ?? 0);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 100_000
      ) {
        return jsonError("Invalid pagination", 400);
      }

      try {
        const tasks = await listTasks(offset, limit);
        return Response.json(
          { tasks, nextOffset: tasks.length === limit ? offset + limit : null },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return jsonError("Review queue unavailable", 503);
      }
    },

    async fetchMessage(request: Request, taskId: string): Promise<Response> {
      const denied = await authorize(request);
      if (denied) return denied;
      if (!/^[a-f0-9]{64}$/.test(taskId)) return jsonError("Not found", 404);

      let task: RoscoMailReviewTask | null;
      try {
        task = await getTask(taskId);
      } catch {
        return jsonError("Review queue unavailable", 503);
      }
      if (!task) return jsonError("Not found", 404);

      const apiKey = getApiKey();
      if (!apiKey) return jsonError("Message review is not configured", 503);

      const messageUrl = new URL(
        `/v0/inboxes/${encodeURIComponent(task.inboxId)}/messages/${encodeURIComponent(task.messageId)}`,
        "https://api.agentmail.to",
      );
      let response: Response;
      try {
        response = await fetchMessage(messageUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
      } catch {
        return jsonError("AgentMail message fetch failed", 502);
      }

      if (!response.ok) return jsonError("AgentMail message fetch failed", 502);

      let payload: AgentMailMessageResponse;
      try {
        payload = (await response.json()) as AgentMailMessageResponse;
      } catch {
        return jsonError("AgentMail returned an invalid message", 502);
      }

      const message = payload.message ?? payload;
      if (message.inbox_id !== task.inboxId || message.message_id !== task.messageId) {
        return jsonError("AgentMail message reference mismatch", 502);
      }

      const text =
        typeof message.extracted_text === "string"
          ? message.extracted_text
          : typeof message.text === "string"
            ? message.text
            : typeof message.body_text === "string"
              ? message.body_text
              : null;

      return Response.json(
        {
          messageId: task.messageId,
          threadId: task.threadId,
          subject: task.subject,
          senderDomain: task.senderDomain,
          receivedAt: task.receivedAt,
          contentTrust: "untrusted",
          text,
          htmlOnly: text === null && (typeof message.html === "string" || typeof message.extracted_html === "string"),
          attachmentsAvailable: Array.isArray(message.attachments) && message.attachments.length > 0,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    },
  };
}
