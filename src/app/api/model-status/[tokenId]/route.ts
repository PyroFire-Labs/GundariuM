/**
 * GET /api/model-status/[tokenId]?chainId=8453
 *
 * Polled by the card page / MintSuccess / Arena while the 3D worker (see
 * worker/ at the repo root) turns a mint's traits into a GLB in the
 * background. Returns { status: "unknown" } for a tokenId nothing was ever
 * queued for, rather than a 404 — this is polled optimistically, so "not
 * there yet" and "never asked for" should look the same to the caller.
 *
 * chainId is required, not optional — GunplaCard is deployed independently
 * per chain with its own tokenId sequence starting at 1, so "tokenId 5"
 * alone is ambiguous between mainnet and Base Sepolia. See src/lib/
 * modelStore.ts's statusKey comment for how this bit tonight (Aug 18 2026).
 */

import { NextResponse } from "next/server";
import { getModelStatus } from "@/lib/modelStore";
import { ipfsToHttp } from "@/lib/ipfs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }

  const chainIdParam = new URL(req.url).searchParams.get("chainId");
  const chainId = chainIdParam ? Number(chainIdParam) : NaN;
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return NextResponse.json({ error: "Missing or invalid chainId query param" }, { status: 400 });
  }

  const status = await getModelStatus(chainId, tokenId);
  if (!status) {
    return NextResponse.json({ status: "unknown" });
  }

  return NextResponse.json({
    status: status.status,
    modelUrl: status.uri ? ipfsToHttp(status.uri) : undefined,
    error: status.status === "failed" ? status.error : undefined,
  });
}
