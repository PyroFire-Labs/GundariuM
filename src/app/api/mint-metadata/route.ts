import { NextRequest, NextResponse } from "next/server";
import { uploadImage, uploadMetadata } from "@/lib/pinata/upload";
import type { TraitSet } from "@/types/nft";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("image") as File | null;
    const traitsEntry = form.get("traits");

    if (!file || !traitsEntry) {
      return NextResponse.json(
        { error: "Missing image or traits" },
        { status: 400 }
      );
    }

    // traitsEntry may be a File (Blob with filename) or a plain string
    const traitsJson =
      traitsEntry instanceof File
        ? await traitsEntry.text()
        : (traitsEntry as string);

    const traits = JSON.parse(traitsJson) as TraitSet;

    const imageHash = await uploadImage(file);
    const metadataUri = await uploadMetadata(traits, imageHash);

    return NextResponse.json({ imageHash, metadataUri });
  } catch (err) {
    console.error("[mint-metadata]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
