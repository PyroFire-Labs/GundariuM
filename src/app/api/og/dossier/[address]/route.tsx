import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { DAILY_CHECKIN_ABI } from "@/lib/contracts/abis/DailyCheckIn";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";

export const runtime = "nodejs";
export const contentType = "image/png";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

interface RouteContext {
  params: Promise<{ address: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return new Response("Invalid address", { status: 400 });
  }

  const contracts = getContracts(base.id);
  let streak = 0;
  let total = 0;

  if (!isPlaceholder(contracts.dailyCheckIn)) {
    try {
      const result = await publicClient.readContract({
        address: contracts.dailyCheckIn,
        abi: DAILY_CHECKIN_ABI,
        functionName: "getStreak",
        args: [address as `0x${string}`],
      });
      streak = Number(result[0]);
      total = Number(result[2]);
    } catch {
      // fall through with zeros
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0a0f",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 8, color: "#00d4ff", textTransform: "uppercase" }}>
          Frame-Runner Dossier
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 900, marginTop: 24 }}>{streak} DAY STREAK</div>
        <div style={{ display: "flex", fontSize: 28, color: "#888", marginTop: 16 }}>{total} total check-ins</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
