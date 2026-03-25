import { type NextRequest, NextResponse } from "next/server";
import { renderCard } from "@/lib/card/draw-frame";
import { RARITY_PALETTES } from "@/lib/card/frame-config";
import type { Rarity } from "@/types/nft";

export const maxDuration = 10;

const VALID_RARITIES = new Set<Rarity>([
  "Common",
  "Uncommon",
  "Rare",
  "Ultra Rare",
  "Legendary",
]);

export async function POST(req: NextRequest): Promise<Response> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    console.error("[render-card]", err);
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const imageFile = formData.get("image");
  const suitName = formData.get("suitName");
  const rarityRaw = formData.get("rarity");
  const pilotName = formData.get("pilotName");
  const hpRaw = formData.get("hp");

  if (
    !(imageFile instanceof File) ||
    typeof suitName !== "string" ||
    !suitName.trim() ||
    typeof rarityRaw !== "string" ||
    typeof pilotName !== "string" ||
    !pilotName.trim() ||
    typeof hpRaw !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing required fields: image, suitName, rarity, pilotName, hp" },
      { status: 400 }
    );
  }

  const rarity = rarityRaw as Rarity;
  if (!VALID_RARITIES.has(rarity)) {
    return NextResponse.json(
      {
        error: `Invalid rarity "${rarityRaw}". Must be one of: ${[...VALID_RARITIES].join(", ")}`,
      },
      { status: 400 }
    );
  }

  const hp = Number(hpRaw);
  if (!Number.isFinite(hp)) {
    return NextResponse.json({ error: "hp must be a valid number" }, { status: 400 });
  }

  const palette = RARITY_PALETTES[rarity];

  let pngBuffer: Buffer;
  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    const photoBuffer = Buffer.from(arrayBuffer);

    pngBuffer = await renderCard({
      photoBuffer,
      suitName: suitName.trim(),
      rarity,
      pilotName: pilotName.trim(),
      hp,
      palette,
    });
  } catch (err) {
    console.error("[render-card]", err);
    return NextResponse.json({ error: "Failed to render card" }, { status: 500 });
  }

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(pngBuffer.length),
    },
  });
}
