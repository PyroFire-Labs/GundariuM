import { type NextRequest, NextResponse } from "next/server";
import { renderCard } from "@/lib/card/draw-frame";
import { RARITY_PALETTES } from "@/lib/card/frame-config";
import type { Rarity, TraitSet } from "@/types/nft";

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
  const traitsEntry = formData.get("traits");

  if (!(imageFile instanceof File) || !traitsEntry) {
    return NextResponse.json(
      { error: "Missing required fields: image, traits" },
      { status: 400 }
    );
  }

  let traits: TraitSet;
  try {
    const traitsJson =
      traitsEntry instanceof File
        ? await traitsEntry.text()
        : (traitsEntry as string);
    traits = JSON.parse(traitsJson) as TraitSet;
  } catch {
    return NextResponse.json({ error: "Invalid traits JSON" }, { status: 400 });
  }

  const rarity = traits.rarity;
  if (!VALID_RARITIES.has(rarity)) {
    return NextResponse.json(
      { error: `Invalid rarity "${rarity}"` },
      { status: 400 }
    );
  }

  const palette = RARITY_PALETTES[rarity];

  let pngBuffer: Buffer;
  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    const photoBuffer = Buffer.from(arrayBuffer);

    pngBuffer = await renderCard({
      photoBuffer,
      suitName: traits.name,
      rarity,
      pilotName: traits.pilotName,
      hp: traits.hp,
      armorType: traits.armorType,
      weapons: [
        { label: "PRI", name: traits.primaryWeapon, damage: traits.primaryDamage },
        { label: "SEC", name: traits.secondaryWeapon, damage: traits.secondaryDamage },
        { label: "TER", name: traits.tertiaryWeapon, damage: traits.tertiaryDamage },
        { label: "SPL", name: traits.specialAttack, damage: traits.specialDamage },
      ],
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
