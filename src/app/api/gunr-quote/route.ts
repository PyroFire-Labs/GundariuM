import { NextRequest, NextResponse } from "next/server";

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const GUNR_ADDRESS = "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07";
const CHAIN_ID = "8453"; // Base mainnet

// Indicative price — no wallet/taker required
export async function GET(req: NextRequest) {
  const sellAmount = req.nextUrl.searchParams.get("sellAmount");
  if (!sellAmount) {
    return NextResponse.json({ error: "sellAmount required" }, { status: 400 });
  }

  const params = new URLSearchParams({
    chainId: CHAIN_ID,
    sellToken: NATIVE_TOKEN,
    buyToken: GUNR_ADDRESS,
    sellAmount,
    slippageBps: "200",
  });

  const res = await fetch(`https://clawn.ch/api/swap/price?${params}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ buyAmount: data.buyAmount, sellAmount: data.sellAmount });
}
