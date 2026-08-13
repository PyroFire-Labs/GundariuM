import { NextResponse } from "next/server";
import { enqueueModelJob } from "@/lib/modelStore";
import { checkRateLimit } from "@/lib/rateLimit";
import type { KitbashTraits } from "@/types/nft";

const GEOMETRY_TRAIT_KEYS = [
  "frameType",
  "head",
  "primaryWeapon",
  "backpack",
  "colorway",
  "special",
] as const satisfies readonly (keyof KitbashTraits)[];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tokenId, kitbashTraits } = body as {
      tokenId?: string;
      kitbashTraits?: KitbashTraits;
    };

    if (!tokenId || !/^\d+$/.test(tokenId)) {
      return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
    }
    if (!kitbashTraits || typeof kitbashTraits !== "object") {
      return NextResponse.json({ error: "Missing kitbashTraits" }, { status: 400 });
    }
    for (const key of GEOMETRY_TRAIT_KEYS) {
      if (typeof kitbashTraits[key] !== "string" || !kitbashTraits[key]) {
        return NextResponse.json(
          { error: `Missing or invalid trait: ${key}` },
          { status: 400 }
        );
      }
    }

    // This only ever fires once per real mint from MintConfirm, so the
    // ceiling here just bounds abuse of the endpoint directly (replayed
    // tokenIds, scripted spam) rather than legitimate traffic — same shape
    // as generate-kitbash's free-tier limit, no paid-tier carve-out needed
    // since there's no payment gate on this route.
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const limit = await checkRateLimit(`gen-model:hour:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
        }
      );
    }

    await enqueueModelJob({
      tokenId,
      traits: {
        frameType: kitbashTraits.frameType,
        head: kitbashTraits.head,
        primaryWeapon: kitbashTraits.primaryWeapon,
        backpack: kitbashTraits.backpack,
        colorway: kitbashTraits.colorway,
        special: kitbashTraits.special,
      },
      enqueuedAt: Date.now(),
    });

    return NextResponse.json({ status: "queued" });
  } catch (error) {
    console.error("generate-model enqueue failed:", error);
    return NextResponse.json({ error: "Failed to queue model generation" }, { status: 500 });
  }
}
