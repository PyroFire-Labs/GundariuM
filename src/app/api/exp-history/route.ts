/**
 * GET /api/exp-history?address=0x...
 *
 * Thin wrapper around updateExpHistory (src/lib/expHistoryScan.ts), the
 * incrementally-cached scan shared with refresh-leaderboard so both
 * surfaces agree on the same EXP total for a given wallet.
 */

import { NextResponse } from "next/server";
import type { Address } from "viem";
import { updateExpHistory } from "@/lib/expHistoryScan";

export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const addressParam = searchParams.get("address");
  if (!addressParam || !/^0x[a-fA-F0-9]{40}$/.test(addressParam)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  const address = addressParam.toLowerCase() as Address;

  const totals = await updateExpHistory(address);
  return NextResponse.json(totals);
}
