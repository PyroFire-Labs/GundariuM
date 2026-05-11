/**
 * GET /api/runner-profile/[address]
 *
 * Public profile lookup for a wallet address. Phase 1 sources entirely
 * from Farcaster via Neynar. Phase 2 will check a Vercel KV custom
 * profile table first, falling back to Farcaster.
 *
 * Returns a RunnerProfile shape (see src/types/runner.ts). Always returns
 * a profile object — `source: "none"` if no identity is available, so
 * clients can safely render without null-checking the wrapper.
 *
 * Cached at the edge for 30 minutes. Profile data doesn't change often
 * and this endpoint will be called frequently (card displays, dossier
 * pages, etc.).
 */

import { NextResponse } from "next/server";
import { lookupFarcasterByAddress } from "@/lib/neynar";
import { emptyRunnerProfile } from "@/types/runner";

export const revalidate = 1800; // 30 minutes

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isValidAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address format" },
      { status: 400 }
    );
  }

  const normalized = address.toLowerCase();
  const farcasterProfile = await lookupFarcasterByAddress(normalized);

  if (farcasterProfile) {
    return NextResponse.json(farcasterProfile, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  }

  // No Farcaster identity — return empty profile so the client can render
  // the fallback (truncated address) without null-checking.
  return NextResponse.json(emptyRunnerProfile(normalized), {
    headers: {
      // Shorter cache for empties — a user might link a Farcaster account
      // soon and we want their profile to surface within the hour.
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
