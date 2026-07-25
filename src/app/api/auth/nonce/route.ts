import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/auth";

export async function GET() {
  const nonce = await issueNonce();
  return NextResponse.json({ nonce });
}
