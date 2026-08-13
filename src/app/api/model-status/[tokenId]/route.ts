/**
 * GET /api/model-status/[tokenId]
 *
 * Polled by the card page / MintSuccess while the 3D worker (see worker/ at
 * the repo root) turns a mint's traits into a GLB in the background.
 * Returns { status: "unknown" } for a tokenId nothing was ever queued for,
 * rather than a 404 — this is polled optimistically, so "not there yet" and
 * "never asked for" should look the same to the caller.
 */

import { NextResponse } from "next/server";
import { getModelStatus } from "@/lib/modelStore";
import { ipfsToHttp } from "@/lib/ipfs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }

  const status = await getModelStatus(tokenId);
  if (!status) {
    return NextResponse.json({ status: "unknown" });
  }

  return NextResponse.json({
    status: status.status,
    modelUrl: status.uri ? ipfsToHttp(status.uri) : undefined,
    error: status.status === "failed" ? status.error : undefined,
  });
}
