import { createAgentMailWebhookHandler } from "@/lib/agentmailWebhook";
import { enqueueRoscoMailReviewTask } from "@/lib/roscoMailReviewStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handleAgentMailWebhook = createAgentMailWebhookHandler({
  getConfig: () => ({
    secret: process.env.AGENTMAIL_WEBHOOK_SECRET,
    inboxId: process.env.AGENTMAIL_ROSCO_INBOX_ID,
  }),
  enqueue: enqueueRoscoMailReviewTask,
});

export async function POST(request: Request): Promise<Response> {
  return handleAgentMailWebhook(request);
}
