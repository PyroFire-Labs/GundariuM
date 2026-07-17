import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const contentType = "image/png";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const player = searchParams.get("player") ?? "Unknown Frame";
  const enemy = searchParams.get("enemy") ?? "Unknown Frame";
  const hp = searchParams.get("hp") ?? "0";

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
          Victory
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 900, marginTop: 16 }}>{player}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#888", marginTop: 8 }}>defeated {enemy}</div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 24, color: "#00d4ff" }}>{hp}% HP remaining</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
