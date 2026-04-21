import { NextRequest, NextResponse } from "next/server";

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const GUNR_ADDRESS = "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07";
const CHAIN_ID = "8453";

const CACHE_TTL_MS = 30_000;
const STALE_GRACE_MS = 5 * 60_000;

type CacheEntry = { buyAmount: string; sellAmount: string; fetchedAt: number };
const quoteCache = new Map<string, CacheEntry>();

function respond(entry: CacheEntry, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { buyAmount: entry.buyAmount, sellAmount: entry.sellAmount, ...extra },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}

export async function GET(req: NextRequest) {
  const sellAmount = req.nextUrl.searchParams.get("sellAmount");
  if (!sellAmount) {
    return NextResponse.json({ error: "sellAmount required" }, { status: 400 });
  }

  const now = Date.now();
  const cached = quoteCache.get(sellAmount);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return respond(cached);
  }

  const params = new URLSearchParams({
    chainId: CHAIN_ID,
    sellToken: NATIVE_TOKEN,
    buyToken: GUNR_ADDRESS,
    sellAmount,
    slippageBps: "200",
  });

  try {
    const res = await fetch(`https://clawn.ch/api/swap/price?${params}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      if (cached && now - cached.fetchedAt < STALE_GRACE_MS) {
        return respond(cached, { stale: true });
      }
      return NextResponse.json({ error: "upstream unavailable" }, { status: 503 });
    }

    const data = await res.json();
    const entry: CacheEntry = {
      buyAmount: data.buyAmount,
      sellAmount: data.sellAmount,
      fetchedAt: now,
    };
    quoteCache.set(sellAmount, entry);
    return respond(entry);
  } catch {
    if (cached && now - cached.fetchedAt < STALE_GRACE_MS) {
      return respond(cached, { stale: true });
    }
    return NextResponse.json({ error: "upstream error" }, { status: 503 });
  }
}
