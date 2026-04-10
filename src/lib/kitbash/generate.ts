import { GoogleGenAI } from "@google/genai";
import type { KitbashTraits } from "@/types/nft";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

function buildPrompt(traits: KitbashTraits): string {
  const specialDesc =
    traits.special !== "None"
      ? `\nSpecial feature: ${traits.special}`
      : "";

  return `Generate a high-quality 3D-rendered image of a unique kitbashed Mobile Suit (mecha/Gundam-style robot) for an NFT collection called "GundariuM".

CRITICAL STYLE REQUIREMENTS:
- Clean, professional 3D render quality (like a high-end model kit product photo)
- Dramatic studio lighting with subtle rim light
- The mech should fill most of the frame
- Sharp details, metallic materials, panel lines visible
- NOT anime/cartoon style — this should look like a rendered 3D model or high-quality Gunpla photograph
- Consistent collection aesthetic — every card should feel like it belongs in the same set

MOBILE SUIT SPECIFICATIONS:
Frame type: ${traits.frameType}
Head design: ${traits.head}
Primary weapon: ${traits.primaryWeapon}
Backpack/thruster system: ${traits.backpack}
Color scheme: ${traits.colorway}
Pose: ${traits.stance}
Background: ${traits.background}${specialDesc}

IMPORTANT:
- This is a KITBASH — parts from different mecha designs combined into something new and unique
- The design should feel cohesive despite mixing parts from different sources
- No text, watermarks, or UI elements in the image
- Square aspect ratio (1:1)
- The mech should be the clear focal point`;
}

export interface GenerationResult {
  imageBase64: string;
  mimeType: string;
}

export async function generateKitbashImage(
  traits: KitbashTraits
): Promise<GenerationResult> {
  const prompt = buildPrompt(traits);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["TEXT", "IMAGE"] as unknown as undefined,
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error("No response from Gemini image generation");
  }

  for (const part of parts) {
    const inline = (part as Record<string, unknown>).inlineData as
      | { mimeType: string; data: string }
      | undefined;
    if (inline?.data) {
      return {
        imageBase64: inline.data,
        mimeType: inline.mimeType ?? "image/png",
      };
    }
  }

  throw new Error("No image returned from Gemini");
}
