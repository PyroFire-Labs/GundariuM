import { NextRequest, NextResponse } from "next/server";
import { analyzeGunpla, type ImageMediaType } from "@/lib/claude/analyzeGunpla";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const traits = await analyzeGunpla(base64, file.type as ImageMediaType);
    return NextResponse.json({ traits });
  } catch (err) {
    console.error("[analyze-gunpla]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
