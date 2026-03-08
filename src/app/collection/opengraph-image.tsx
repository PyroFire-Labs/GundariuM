import { generateOgImage } from "@/lib/og/generateOgImage";

export const runtime = "nodejs";
export const revalidate = 60;
export const alt = "GundariuM — Collection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return generateOgImage({ pageTitle: "COLLECTION", missionLabel: "COLLECTION UNLOCKS · MAY 10, 2026" });
}
