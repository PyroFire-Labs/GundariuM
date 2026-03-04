import { NextRequest, NextResponse } from "next/server";

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const GNDM_ADDRESS = "0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3";
const CHAIN_ID = "8453";

// Firm quote — returns transaction data for client to sign and send
export async function GET(req: NextRequest) {
  const sellAmount = req.nextUrl.searchParams.get("sellAmount");
  const taker = req.nextUrl.searchParams.get("taker");

  if (!sellAmount || !taker) {
    return NextResponse.json({ error: "sellAmount and taker required" }, { status: 400 });
  }

  const params = new URLSearchParams({
    chainId: CHAIN_ID,
    sellToken: NATIVE_TOKEN,
    buyToken: GNDM_ADDRESS,
    sellAmount,
    slippageBps: "200",
    taker,
  });

  const res = await fetch(`https://clawn.ch/api/swap/quote?${params}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();

  // Return only what the client needs to build the transaction
  return NextResponse.json({
    to: data.transaction?.to,
    data: data.transaction?.data,
    value: data.transaction?.value,
    buyAmount: data.buyAmount,
    liquidityAvailable: data.liquidityAvailable ?? true,
  });
}
