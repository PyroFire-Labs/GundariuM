/**
 * Generates a new circular badge/coin-style icon in the same visual
 * language as public/token-icon.png, for use as a Farcaster group chat
 * image. Uses the token icon itself as a style reference so the result
 * is recognizably GundariuM but a distinct mecha head, not a copy.
 *
 * Usage: npx tsx scripts/generate-groupchat-icon.ts
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

const PROMPT = `Generate a circular coin/medallion-style badge icon, in the exact same visual format as the reference image provided.

STYLE REQUIREMENTS (match the reference exactly):
- Circular badge with a brushed metallic silver ring/border, double-lined
- Solid black background outside and inside the ring
- A single Gundam-style Mobile Suit HEAD (bust/portrait crop, not full body) centered inside the ring, filling most of the circle
- Clean, professional 3D render quality — sharp metallic panel lines, dramatic studio lighting, glowing eyes/visor in a bright accent color
- No text, no watermarks, no UI elements
- Square image, 1:1 aspect ratio, 768x768

WHAT TO CHANGE FROM THE REFERENCE:
- A completely different Mobile Suit head design — sleek, high-mobility "runner" type silhouette (streamlined, aerodynamic fins/vents rather than heavy armor plating), fitting a fast scout/vanguard unit
- Color scheme: electric blue and white, with bright white-hot glowing eyes/visor — distinct from the reference's silver/chrome and avoid red/gold entirely
- This should read as a distinct, new badge in the same family, not a copy of the reference`;

async function main() {
  const refImagePath = path.resolve(__dirname, "..", "public", "token-icon.png");
  const refImageBase64 = fs.readFileSync(refImagePath).toString("base64");

  console.log("⏳ Generating group chat icon with Gemini...");
  const startTime = Date.now();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: refImageBase64 } },
          { text: PROMPT },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"] as any,
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    console.error("No parts in response:", JSON.stringify(response, null, 2));
    process.exit(1);
  }

  let saved = false;
  for (const part of parts) {
    if ((part as any).inlineData) {
      const imageData = (part as any).inlineData;
      const ext = imageData.mimeType === "image/png" ? "png" : "jpg";
      const outputPath = path.resolve(__dirname, `groupchat-icon-${Date.now()}.${ext}`);
      fs.writeFileSync(outputPath, Buffer.from(imageData.data, "base64"));
      console.log(`✅ Generated in ${elapsed}s`);
      console.log(`📸 Saved to: ${outputPath}`);
      saved = true;
    }
    if ((part as any).text) {
      console.log(`📝 Model notes: ${(part as any).text.slice(0, 300)}`);
    }
  }

  if (!saved) {
    console.error("No image returned. Parts:", parts.map((p: any) => Object.keys(p)));
    process.exit(1);
  }
}

main();
