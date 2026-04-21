import { GoogleGenAI } from "@google/genai";
import type { KitbashTraits } from "@/types/nft";
import { FACTIONS, type FactionKey } from "@/lib/constants/factions";
import { FACTION_BIAS } from "./factionBias";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

function buildUniverseBlock(faction?: FactionKey): string {
  if (!faction || faction === "UNKNOWN") {
    return `UNIVERSE CONTEXT:
This mobile suit's faction affiliation is unknown. Render a generic mecha that doesn't strongly resemble any specific Gundam universe. Stay in the broader "real-robot" military aesthetic.`;
  }

  const factionInfo = FACTIONS[faction];
  const bias = FACTION_BIAS[faction];
  if (!factionInfo || !bias) return "";

  return `UNIVERSE CONTEXT (CRITICAL — THIS DRIVES THE DESIGN):
Faction: ${factionInfo.name}
Universe: ${factionInfo.universe}
Design language: ${bias.designLanguage}
Reference suit silhouettes: ${bias.referenceSuits}

FORBIDDEN DESIGN INFLUENCES (DO NOT RENDER THESE):
${bias.forbiddenInfluences}`;
}

function buildPrompt(traits: KitbashTraits, faction?: FactionKey): string {
  const specialDesc =
    traits.special !== "None" ? `\nSpecial feature: ${traits.special}` : "";

  const universeBlock = buildUniverseBlock(faction);

  return `ABSOLUTE TOP-PRIORITY RULE — NO TEXT IN IMAGE:
The output image MUST contain ZERO text of any kind. No "GundariuM" logo. No suit ID numbers. No watermarks. No signatures. No HUD text overlays. No model kit branding. No serial numbers. No subtitles or captions. The image is pure visual mecha render — text rendering is FORBIDDEN. If any text appears anywhere in the rendered output, the generation has failed.

Generate a high-quality 3D-rendered image of a unique kitbashed Mobile Suit (mecha/Gundam-style robot) for an NFT collection.

CRITICAL STYLE REQUIREMENTS:
- Clean, professional 3D render quality (like a high-end model kit product photo)
- Dramatic studio lighting with subtle rim light
- The mech should fill most of the frame
- Sharp details, metallic materials, panel lines visible
- NOT anime/cartoon style — this should look like a rendered 3D model or high-quality Gunpla photograph
- Consistent collection aesthetic — every card should feel like it belongs in the same set

${universeBlock}

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
- The design MUST stay within the faction's universe — do not bleed silhouettes from other Gundam universes into the render
- The design should feel cohesive despite mixing parts from canonical sources within this universe
- Square aspect ratio (1:1)
- The mech should be the clear focal point

FINAL REMINDER — TEXT IS FORBIDDEN:
Do NOT render any letters, digits, logos, watermarks, signatures, branding text, "GundariuM" text, suit ID labels, kit-box text, decals containing readable letters, or any other written/typographic content anywhere in the image. The frame must be 100% pure mecha render with zero text. Decals on the mecha may use abstract symbols or numerals-as-art only if essential, but never readable words or brand names.`;
}

export interface GenerationResult {
  imageBase64: string;
  mimeType: string;
}

export async function generateKitbashImage(
  traits: KitbashTraits,
  faction?: FactionKey
): Promise<GenerationResult> {
  const prompt = buildPrompt(traits, faction);

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
