import { createHmac } from "crypto";
import { sendAlert } from "@/lib/alert";

export async function POST(req: Request) {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  const sig = req.headers.get("x-vercel-signature");
  const body = await req.text();

  if (secret) {
    const expected = createHmac("sha1", secret).update(body).digest("hex");
    if (sig !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let event: { type: string; payload?: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (event.type === "deployment.error") {
    const payload = event.payload as Record<string, Record<string, string>> | undefined;
    const projectName = payload?.project?.name ?? payload?.deployment?.name ?? "unknown";
    const deployUrl = payload?.deployment?.url
      ? `https://${payload.deployment.url}`
      : "https://vercel.com/dashboard";
    await sendAlert(`⛔ <b>Deploy failed</b> — <code>${projectName}</code>\n${deployUrl}`);
  }

  return new Response("OK");
}
