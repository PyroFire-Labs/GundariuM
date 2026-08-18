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
    const { tokenId, chainId, kitbashTraits, secondaryWeapon, tertiaryWeapon } = body as {
      tokenId?: string;
      // Required, not optional — GunplaCard's tokenId sequence restarts at
      // 1 per chain (mainnet + Base Sepolia), so "tokenId 5" alone is
      // ambiguous about which chain's token this job is for. See
      // src/lib/modelStore.ts's statusKey comment.
      chainId?: number;
      kitbashTraits?: KitbashTraits;
      // Not part of KitbashTraits — derived at generate-kitbash time
      // (deriveSecondaryWeapon) and carried on TraitSet instead. Passed
      // separately here so per-move battle animations (see worker/blender/
      // lib/animation.py) have real weapon names for all three attack slots,
      // not just primary.
      secondaryWeapon?: string;
      tertiaryWeapon?: string;
    };

    if (!tokenId || !/^\d+$/.test(tokenId)) {
      return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
    }
    if (chainId !== 8453 && chainId !== 84532) {
      return NextResponse.json({ error: "chainId must be 8453 (Base) or 84532 (Base Sepolia)" }, { status: 400 });
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
    if (typeof secondaryWeapon !== "string" || !secondaryWeapon) {
      return NextResponse.json({ error: "Missing or invalid trait: secondaryWeapon" }, { status: 400 });
    }
    if (typeof tertiaryWeapon !== "string" || !tertiaryWeapon) {
      return NextResponse.json({ error: "Missing or invalid trait: tertiaryWeapon" }, { status: 400 });
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
      chainId,
      tokenId,
      traits: {
        frameType: kitbashTraits.frameType,
        head: kitbashTraits.head,
        primaryWeapon: kitbashTraits.primaryWeapon,
        secondaryWeapon,
        tertiaryWeapon,
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
