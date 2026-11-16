import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  createAutoMailTransport,
  approvedSenders,
  exactMailbox,
  processAutoMail,
  SYSTEM_POLICY,
} from "./roscoAutoMailCore";
import { createAutoMailStore } from "./roscoAutoMailStore";
import { createRoscoMailReviewStore } from "./roscoMailReviewStoreCore";

export async function handleAutoMail(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  if (process.env.ROSCO_AUTO_REPLY_ENABLED?.trim().toLowerCase() !== "true")
    return new Response(null, { status: 204 });
  const apiKey = process.env.AGENTMAIL_API_KEY;
  const inboxId = process.env.AGENTMAIL_ROSCO_INBOX_ID;
  if (!apiKey || !inboxId || !process.env.ANTHROPIC_API_KEY)
    return new Response("Processor unavailable", { status: 503 });
  try {
    const redis = Redis.fromEnv();
    const store = createAutoMailStore(redis);
    const token = randomUUID();
    const claim = await store.claim(token);
    if (!claim) return new Response(null, { status: 204 });
    const task = await createRoscoMailReviewStore(redis).get(claim.id);
    const save = (state: Parameters<typeof store.save>[2]) =>
      store.save(claim.id, token, state);
    if (!task || task.inboxId !== inboxId || claim.state.attempts > 4) {
      await save({ phase: "review_only", attempts: claim.state.attempts });
      return new Response(null, { status: 204 });
    }
    const transport = createAutoMailTransport(apiKey);
    let recipient: string | null = null;
    await processAutoMail(
      task,
      claim.state,
      approvedSenders(process.env.ROSCO_APPROVED_SENDERS),
      {
        save,
        fetchMessage: async () => {
          const message = await transport.fetchMessage(task);
          recipient = exactMailbox(message.from);
          return message;
        },
        generate: async (text) => {
          const client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
            maxRetries: 0,
            timeout: 25_000,
          });
          const result = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 600,
            system: SYSTEM_POLICY,
            messages: [{ role: "user", content: text }],
          });
          return result.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
        },
        deliver: async (_task, text, key) => {
          return recipient
            ? transport.reply(task, text, key, recipient)
            : "review_only";
        },
      },
    );
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("Temporary processing failure", { status: 503 });
  }
}
