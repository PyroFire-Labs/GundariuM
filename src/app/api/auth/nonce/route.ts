import { NextRequest, NextResponse } from "next/server";
import { issueNonce } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = await checkRateLimit(`siwe-nonce:${ip}`, 20, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      }
    );
  }

  const nonce = await issueNonce();
  return NextResponse.json({ nonce });
}
