import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySession(sessionId);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
