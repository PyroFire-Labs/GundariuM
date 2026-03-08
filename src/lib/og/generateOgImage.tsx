import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

// May 10, 2026 12:00 PM CDT = 17:00 UTC
const LAUNCH_DATE = new Date("2026-05-10T17:00:00.000Z");

function getTimeLeft() {
  const diff = LAUNCH_DATE.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 864e5),
    hours: Math.floor((diff % 864e5) / 36e5),
    minutes: Math.floor((diff % 36e5) / 6e4),
    seconds: Math.floor((diff % 6e4) / 1e3),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export async function generateOgImage({
  pageTitle,
  missionLabel,
}: {
  pageTitle: string;
  missionLabel: string;
}) {
  const time = getTimeLeft();

  // Load icon image
  const iconPath = path.join(process.cwd(), "public", "icon.png");
  const iconData = await readFile(iconPath);
  const iconSrc = `data:image/png;base64,${iconData.toString("base64")}`;

  const blocks = [
    { value: pad(time.days), label: "DAYS" },
    { value: pad(time.hours), label: "HRS" },
    { value: pad(time.minutes), label: "MIN" },
    { value: pad(time.seconds), label: "SEC" },
  ];

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
          marginBottom: "32px",
        }}>
          {missionLabel}
        </div>

        {/* Digit blocks */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {blocks.map((block, i) => (
            <div key={block.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Digit block */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", position: "relative", padding: "12px 20px" }}>
                  {/* Corner brackets */}
                  <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: 14, height: 14, borderTop: "2px solid #3b82f6", borderLeft: "2px solid #3b82f6" }} />
                  <div style={{ display: "flex", position: "absolute", top: 0, right: 0, width: 14, height: 14, borderTop: "2px solid #3b82f6", borderRight: "2px solid #3b82f6" }} />
                  <div style={{ display: "flex", position: "absolute", bottom: 0, left: 0, width: 14, height: 14, borderBottom: "2px solid #3b82f6", borderLeft: "2px solid #3b82f6" }} />
                  <div style={{ display: "flex", position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderBottom: "2px solid #3b82f6", borderRight: "2px solid #3b82f6" }} />
                  <div style={{ display: "flex", fontSize: "80px", fontWeight: 900, color: "#ffffff", letterSpacing: "0.05em", lineHeight: 1 }}>
                    {block.value}
                  </div>
                </div>
                <div style={{ display: "flex", fontSize: "11px", fontWeight: 700, letterSpacing: "0.3em", color: "#60a5fa" }}>
                  {block.label}
                </div>
              </div>
              {/* Colon separator (not after last) */}
              {i < blocks.length - 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(59,130,246,0.7)" }} />
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(59,130,246,0.7)" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Date */}
        <div style={{ display: "flex", marginTop: "28px", fontSize: "14px", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)" }}>
          MAY 10, 2026 · 12:00 PM CST
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
