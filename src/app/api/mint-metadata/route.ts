import { NextRequest, NextResponse } from "next/server";
import { uploadImage, uploadMetadata } from "@/lib/pinata/upload";
import type { TraitSet } from "@/types/nft";
import { verifyTurnstile } from "@/lib/turnstile";
import { validateNameContent } from "@/lib/kitbash/namePools";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let imageFile: File;
    let traits: TraitSet;

    if (contentType.includes("application/json")) {
      // Generative flow: image arrives as base64
      const body = await request.json();
      const { imageBase64, imageMimeType, traits: bodyTraits, turnstileToken } = body;

      // Anti-abuse: verify Turnstile
      if (turnstileToken) {
        const valid = await verifyTurnstile(turnstileToken);
        if (!valid) {
          return NextResponse.json({ error: "Bot detected" }, { status: 403 });
        }
      }

      if (!imageBase64 || !bodyTraits) {
        return NextResponse.json(
          { error: "Missing imageBase64 or traits" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(imageBase64, "base64");
      const ext = imageMimeType === "image/png" ? "png" : "jpg";
      imageFile = new File([buffer], `kitbash.${ext}`, {
        type: imageMimeType ?? "image/png",
      });
      traits = bodyTraits as TraitSet;
    } else {
      // Legacy photo flow: image arrives as FormData
      const form = await request.formData();
      const file = form.get("image") as File | null;
      const traitsEntry = form.get("traits");

      if (!file || !traitsEntry) {
        return NextResponse.json(
          { error: "Missing image or traits" },
          { status: 400 }
        );
      }

      imageFile = file;
      const traitsJson =
        traitsEntry instanceof File
          ? await traitsEntry.text()
          : (traitsEntry as string);
      traits = JSON.parse(traitsJson) as TraitSet;
    }

    const nameError = validateNameContent(traits.name);
    if (nameError) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const imageHash = await uploadImage(imageFile);
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
