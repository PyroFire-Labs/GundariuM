import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { parseSiweMessage } from "viem/siwe";
import {
  consumeNonce,
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const message = body?.message;
  const signature = body?.signature;
  if (typeof message !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
  }

  const parsed = parseSiweMessage(message);
  if (!parsed.address || !parsed.nonce) {
    return NextResponse.json({ error: "Malformed SIWE message" }, { status: 400 });
  }

  const nonceValid = await consumeNonce(parsed.nonce);
  if (!nonceValid) {
    return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
  }

  const domain = request.headers.get("host") ?? undefined;
  const verified = await publicClient
    .verifySiweMessage({
      message,
      signature: signature as `0x${string}`,
      domain,
      nonce: parsed.nonce,
    })
    .catch(() => false);
  if (!verified) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  const sessionId = await createSession(parsed.address);
  const response = NextResponse.json({ address: parsed.address });
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}
