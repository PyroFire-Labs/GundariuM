import Anthropic from "@anthropic-ai/sdk";
import { GUNPLA_TRAIT_PROMPT } from "@/lib/constants/prompts";
import type { TraitSet } from "@/types/nft";

export type ImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Extended thinking budget: gives Claude reasoning space to work through
// silhouette, visible text, and distinctive features before committing to JSON.
const THINKING_BUDGET = 8000;

export async function analyzeGunpla(
  imageBase64: string,
  mediaType: ImageMediaType
): Promise<TraitSet> {
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
            text: GUNPLA_TRAIT_PROMPT,
          },
        ],
      },
    ],
  });

  // With extended thinking the response contains thinking blocks before the text block.
  // Find the text block explicitly rather than assuming content[0].
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text block in Claude response");
  }

  // Strip any accidental markdown code fences
  const raw = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
  const traits = JSON.parse(raw) as TraitSet;
  return traits;
}
