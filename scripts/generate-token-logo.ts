/**
 * Generate GNDM token logo using Gemini image generation
 *
 * Usage: npx tsx scripts/generate-token-logo.ts
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

const PROMPT = `Generate a bold, iconic token logo for a cryptocurrency called "GNDM" (Gundarium) — a Gunpla NFT battle game on the Base blockchain.

DESIGN REQUIREMENTS:
- Circular coin/emblem format, like a high-quality crypto token icon
- Central motif: a stylized Gundam-style mecha head in 3/4 view, detailed but clean
- Color palette: deep space black background, SILVER and steel blue tones, cool blue accent lighting. NO gold anywhere — all silver/chrome/steel
- Materials: polished silver metal, chrome, brushed steel — premium but cold/industrial
- Clean rendering with sharp edges and visible panel lines on the mecha head
- Circular border ring in dark silver/gunmetal
- NO text — the symbol should stand alone without letters
- Square canvas (1:1 aspect ratio) with the circular emblem centered
- Should read clearly at small sizes (32px)

STYLE:
- Premium cryptocurrency token art
- Silver/chrome mecha aesthetic — think platinum, not gold
- Futuristic, military, mechanical
- NOT cute, NOT cartoonish — serious combat game token

ABSOLUTELY NO:
- Lens flares, sparkles, or starburst effects
- Gold or warm metallic colors — silver/steel ONLY
- Text or letters
- Full body mecha
- Busy or cluttered design
- Watermarks`;

async function generateLogo() {
  console.log("🎨 Generating GNDM token logo...\n");
  const startTime = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      config: {
        responseModalities: ["TEXT", "IMAGE"] as unknown as undefined,
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const parts = response.candidates?.[0]?.content?.parts;

    if (!parts) {
      console.error("No response from Gemini");
      return;
    }

    for (const part of parts) {
      const inline = (part as Record<string, unknown>).inlineData as
        | { mimeType: string; data: string }
        | undefined;
      if (inline?.data) {
        const ext = inline.mimeType === "image/png" ? "png" : "jpg";
        const filename = `gndm-token-logo-${Date.now()}.${ext}`;
        const outputPath = path.resolve(__dirname, filename);
        fs.writeFileSync(outputPath, Buffer.from(inline.data, "base64"));
        console.log(`✅ Generated in ${elapsed}s`);
        console.log(`📸 Saved to: ${outputPath}`);
        console.log(`   Open: open "${outputPath}"`);
        return;
      }
      if ((part as Record<string, unknown>).text) {
        console.log(`📝 ${((part as Record<string, unknown>).text as string).slice(0, 200)}`);
      }
    }

    console.error("⚠️  No image in response");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Generation failed:", msg);
  }
}

generateLogo();
