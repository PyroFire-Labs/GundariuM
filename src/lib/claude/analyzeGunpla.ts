import Anthropic from "@anthropic-ai/sdk";
import { buildGunplaPrompt } from "@/lib/constants/prompts";
import type { ArmorType, KitGrade } from "@/types/nft";

export type ImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

// What Claude returns — suit identification only (no grade/rarity/stats)
export interface SuitIdentification {
  name: string;
  series: string;
  faction: string;
  pilotName: string;
  armorType: ArmorType;
  primaryWeapon: string;
  secondaryWeapon: string;
  tertiaryWeapon: string;
  specialAttack: string;
  confidence: number;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Extended thinking budget: gives Claude reasoning space to work through
// silhouette, visible text, and distinctive features before committing to JSON.
const THINKING_BUDGET = 8000;

export async function analyzeGunpla(
  imageBase64: string,
  mediaType: ImageMediaType,
  grade: KitGrade
): Promise<SuitIdentification> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: THINKING_BUDGET + 2048,
    thinking: {
      type: "enabled",
      budget_tokens: THINKING_BUDGET,
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: buildGunplaPrompt(grade),
          },
        ],
      },
    ],
  });

  // With extended thinking the response contains thinking blocks before the text block.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text block in Claude response");
  }

  // Strip any accidental markdown code fences
  const raw = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
  const suit = JSON.parse(raw) as SuitIdentification;
  return suit;
}
