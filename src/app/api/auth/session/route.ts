import { NextRequest, NextResponse } from "next/server";
import { getSessionAddress, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const address = await getSessionAddress(sessionId);
  return NextResponse.json({ address });
}
