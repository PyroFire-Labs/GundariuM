import { NextRequest, NextResponse } from "next/server";
import { analyzeGunpla, type ImageMediaType } from "@/lib/claude/analyzeGunpla";
import type { KitGrade, Rarity, TraitSet } from "@/types/nft";

const VALID_GRADES: KitGrade[] = ["SD", "HG", "RG", "MG", "MG_VERKA", "HIRM", "PG"];

const GRADE_TO_RARITY: Record<KitGrade, Rarity> = {
  SD: "Common",
  HG: "Common",
  RG: "Uncommon",
  MG: "Rare",
  MG_VERKA: "Ultra Rare",
  HIRM: "Ultra Rare",
  PG: "Legendary",
};

const HP_RANGES: Record<Rarity, [number, number]> = {
  Common: [150, 349],
  Uncommon: [350, 599],
  Rare: [600, 899],
  "Ultra Rare": [900, 1199],
  Legendary: [1200, 2000],
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function deriveStats(grade: KitGrade) {
  const rarity = GRADE_TO_RARITY[grade];
  const [hpMin, hpMax] = HP_RANGES[rarity];
  const hp = randInt(hpMin, hpMax);
  return {
    rarity,
    hp,
    primaryDamage: randInt(Math.floor(hp * 0.15), Math.floor(hp * 0.25)),
    secondaryDamage: randInt(Math.floor(hp * 0.25), Math.floor(hp * 0.40)),
    tertiaryDamage: randInt(Math.floor(hp * 0.08), Math.floor(hp * 0.15)),
    specialDamage: randInt(Math.floor(hp * 0.50), Math.floor(hp * 0.80)),
  };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("image") as File | null;
    const gradeRaw = form.get("grade") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }
    if (!gradeRaw || !VALID_GRADES.includes(gradeRaw as KitGrade)) {
      return NextResponse.json(
        { error: "Invalid or missing grade. Must be one of: " + VALID_GRADES.join(", ") },
        { status: 400 }
      );
    }

    const grade = gradeRaw as KitGrade;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const suit = await analyzeGunpla(base64, file.type as ImageMediaType, grade);
    const stats = deriveStats(grade);

    const traits: TraitSet = {
      ...suit,
      grade,
      rarity: stats.rarity,
      hp: stats.hp,
      primaryDamage: stats.primaryDamage,
      secondaryDamage: stats.secondaryDamage,
      tertiaryDamage: stats.tertiaryDamage,
      specialDamage: stats.specialDamage,
    };

    return NextResponse.json({ traits });
  } catch (err) {
    console.error("[analyze-gunpla]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
