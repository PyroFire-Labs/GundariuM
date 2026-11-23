import { createMailGenerator } from "./roscoOpenAIMail";
import { Redis } from "@upstash/redis";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  createAutoMailTransport,
  approvedSenders,
  exactMailbox,
  processAutoMail,
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
  if (!apiKey || !inboxId || !process.env.OPENAI_API_KEY?.trim())
    return new Response("Processor unavailable", { status: 503 });
  try {
    const redis = Redis.fromEnv();
    const store = createAutoMailStore(redis);
    const token = randomUUID();
    const claim = await store.claim(token);
    if (!claim) return new Response(null, { status: 204 });
    const task = await createRoscoMailReviewStore(redis).get(claim.id);
    const save = (state: Parameters<typeof store.save>[2]) =>
      store.save(claim.id, token, state, Date.now(), task ?? undefined);
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
        fetchInbox: (reference) => transport.fetchInbox(reference),
        acquireThread: (reference) => store.acquireThread(reference, token),
        verifyThread: (reference) => store.verifyThread(reference, token),
        fetchHistory: (reference, inbox, target, approved, lastReplyId) => transport.fetchHistory(reference, inbox, target, approved, lastReplyId),
        fetchMessage: async () => {
          const message = await transport.fetchMessage(task);
          recipient = exactMailbox(message.from);
          return message;
        },
        generate: createMailGenerator({
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.ROSCO_OPENAI_MODEL,
        }),
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
