import { NextRequest, NextResponse } from "next/server";

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const GUNR_ADDRESS = "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07";
const CHAIN_ID = "8453";
const UPSTREAM_TIMEOUT_MS = 10_000;

const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
const isPositiveIntString = (v: string) => /^[1-9][0-9]*$/.test(v);

export async function GET(req: NextRequest) {
  const sellAmount = req.nextUrl.searchParams.get("sellAmount");
  const taker = req.nextUrl.searchParams.get("taker");

  if (!sellAmount || !taker) {
    return NextResponse.json({ error: "sellAmount and taker required" }, { status: 400 });
  }
  if (!isAddress(taker)) {
    return NextResponse.json({ error: "Invalid taker address" }, { status: 400 });
  }
  if (!isPositiveIntString(sellAmount)) {
    return NextResponse.json({ error: "Invalid sellAmount" }, { status: 400 });
  }

  const params = new URLSearchParams({
    chainId: CHAIN_ID,
    sellToken: NATIVE_TOKEN,
    buyToken: GUNR_ADDRESS,
    sellAmount,
    slippageBps: "200",
    taker,
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(`https://clawn.ch/api/swap/quote?${params}`, {
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });

    if (!res.ok) {
      console.error(`gunr-swap upstream ${res.status}`);
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Quote service busy — please try again shortly." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "Quote service unavailable" }, { status: 503 });
    }

    const data = await res.json();
    return NextResponse.json({
      to: data.transaction?.to,
      data: data.transaction?.data,
      value: data.transaction?.value,
      buyAmount: data.buyAmount,
      liquidityAvailable: data.liquidityAvailable ?? true,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    console.error(`gunr-swap upstream ${timedOut ? "timeout" : "error"}`, err);
    return NextResponse.json(
      {
        error: timedOut
          ? "Quote service timed out — please try again."
          : "Quote service unavailable",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}
