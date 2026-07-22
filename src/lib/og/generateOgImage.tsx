import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export async function generateOgImage({
  pageTitle,
  missionLabel,
}: {
  pageTitle: string;
  missionLabel: string;
}) {
  // Load icon image
  const iconPath = path.join(process.cwd(), "public", "icon.png");
  const iconData = await readFile(iconPath);
  const iconSrc = `data:image/png;base64,${iconData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#080c14",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(37,99,235,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.06) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Corner decorations */}
        {/* TL */}
        <div style={{ position: "absolute", top: 24, left: 24, width: 40, height: 40, borderTop: "2px solid #3b82f6", borderLeft: "2px solid #3b82f6" }} />
        {/* TR */}
        <div style={{ position: "absolute", top: 24, right: 24, width: 40, height: 40, borderTop: "2px solid #3b82f6", borderRight: "2px solid #3b82f6" }} />
        {/* BL */}
        <div style={{ position: "absolute", bottom: 24, left: 24, width: 40, height: 40, borderBottom: "2px solid #3b82f6", borderLeft: "2px solid #3b82f6" }} />
        {/* BR */}
        <div style={{ position: "absolute", bottom: 24, right: 24, width: 40, height: 40, borderBottom: "2px solid #3b82f6", borderRight: "2px solid #3b82f6" }} />

        {/* Icon + title row */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "16px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} width={72} height={72} alt="" style={{ borderRadius: "8px" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: "13px", letterSpacing: "0.3em", color: "#60a5fa", fontWeight: 700 }}>
              GUNDARIUM · BASE NETWORK
            </div>
            <div style={{ display: "flex", fontSize: "48px", fontWeight: 900, color: "#ffffff", letterSpacing: "0.05em", lineHeight: 1.1 }}>
              {pageTitle}
            </div>
          </div>
        </div>

        {/* Mission label tag */}
        <div style={{
          display: "flex",
          border: "1px solid rgba(59,130,246,0.6)",
          padding: "4px 16px",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: "#60a5fa",
        }}>
          {missionLabel}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
