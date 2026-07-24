import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const contentType = "image/png";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const player = searchParams.get("player") ?? "Unknown Frame";
  const enemy = searchParams.get("enemy") ?? "Unknown Frame";
  const hp = searchParams.get("hp") ?? "0";
  const won = searchParams.get("won") !== "false";
  const accent = won ? "#00d4ff" : "#fb923c";

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
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 8, color: accent, textTransform: "uppercase" }}>
          {won ? "Victory" : "Defeat"}
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 900, marginTop: 16 }}>{won ? player : enemy}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#888", marginTop: 8 }}>
          {won ? `defeated ${enemy}` : `defeated ${player}`}
        </div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 24, color: accent }}>{hp}% HP remaining</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Access-Control-Allow-Origin": "*" },
    }
  );
}
