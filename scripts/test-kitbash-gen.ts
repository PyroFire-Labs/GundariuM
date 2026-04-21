/**
 * GundariuM Kitbash Generation Prototype
 *
 * Tests on-demand AI image generation for unique Mobile Suit kitbashes.
 * Uses Gemini's image generation with style reference prompting.
 *
 * Usage: npx tsx scripts/test-kitbash-gen.ts [--traits "custom traits"]
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

// ─── Trait Tables ──────────────────────────────────────────────────
// Each trait has a name + rarity weight (higher = more common)

const TRAIT_TABLES = {
  frameType: [
    { name: "Standard", weight: 30 },
    { name: "Heavy Armor", weight: 15 },
    { name: "High Mobility", weight: 15 },
    { name: "Sniper", weight: 12 },
    { name: "Commander", weight: 10 },
    { name: "Berserker", weight: 8 },
    { name: "Stealth", weight: 6 },
    { name: "Full Armor", weight: 4 },
  ],
  head: [
    { name: "Classic V-Fin", weight: 25 },
    { name: "Mono-Eye", weight: 20 },
    { name: "Visor Type", weight: 15 },
    { name: "Twin Horn", weight: 12 },
    { name: "Antenna Array", weight: 10 },
    { name: "Crown Crest", weight: 8 },
    { name: "Blade Antenna", weight: 6 },
    { name: "Multi-Sensor", weight: 4 },
  ],
  primaryWeapon: [
    { name: "Beam Rifle", weight: 20 },
    { name: "Machine Gun", weight: 15 },
    { name: "Heat Hawk", weight: 12 },
    { name: "Beam Saber (dual)", weight: 12 },
    { name: "Bazooka", weight: 10 },
    { name: "Gatling Gun", weight: 8 },
    { name: "Beam Cannon", weight: 8 },
    { name: "Mega Launcher", weight: 5 },
    { name: "Twin Buster Rifle", weight: 4 },
    { name: "GN Sword", weight: 3 },
    { name: "Ship-Cutting Sword", weight: 3 },
  ],
  backpack: [
    { name: "Standard Thruster Pack", weight: 25 },
    { name: "Flight Unit", weight: 20 },
    { name: "Heavy Arms Rack", weight: 12 },
    { name: "Funnel System", weight: 8 },
    { name: "DRAGOON System", weight: 6 },
    { name: "Booster Pod", weight: 15 },
    { name: "Wing Binders", weight: 10 },
    { name: "Psychoframe Emitter", weight: 4 },
  ],
  colorway: [
    { name: "Federation White & Blue", weight: 15 },
    { name: "Zeon Army Green", weight: 12 },
    { name: "Char Red", weight: 10 },
    { name: "Titans Navy Blue", weight: 10 },
    { name: "AEUG Dark Blue & Red", weight: 8 },
    { name: "Neo Zeon Crimson", weight: 8 },
    { name: "Celestial Being Gunmetal & White", weight: 8 },
    { name: "OZ Royal Purple", weight: 6 },
    { name: "Desert Tan & Brown", weight: 5 },
    { name: "Arctic White & Silver", weight: 5 },
    { name: "Shadow Black & Gold", weight: 4 },
    { name: "Psychoframe Aurora (iridescent)", weight: 3 },
    { name: "Chrome Silver", weight: 3 },
    { name: "Phantom Midnight Blue", weight: 3 },
  ],
  stance: [
    { name: "Standing at attention, weapon held", weight: 20 },
    { name: "Combat ready, weapon aimed", weight: 20 },
    { name: "Dynamic action pose mid-attack", weight: 15 },
    { name: "Kneeling with rifle braced", weight: 12 },
    { name: "Aerial hover with thrusters firing", weight: 10 },
    { name: "Dramatic sword draw", weight: 8 },
    { name: "Walking forward menacingly", weight: 10 },
    { name: "Dual-wielding combat stance", weight: 5 },
  ],
  background: [
    { name: "Military hangar with dramatic lighting", weight: 18 },
    { name: "Deep space with stars and debris", weight: 15 },
    { name: "Space colony interior", weight: 12 },
    { name: "Desert battlefield", weight: 10 },
    { name: "Urban ruins", weight: 10 },
    { name: "Ocean platform at sunset", weight: 8 },
    { name: "Asteroid field", weight: 8 },
    { name: "Lunar surface", weight: 7 },
    { name: "Forest with mech tracks", weight: 6 },
    { name: "Volcanic terrain with lava", weight: 4 },
    { name: "Orbital elevator", weight: 2 },
  ],
  special: [
    { name: "None", weight: 50 },
    { name: "Battle damage (scratches, dents, scorch marks)", weight: 15 },
    { name: "Gold trim accents", weight: 8 },
    { name: "Psychoframe glow (pink/green energy lines)", weight: 6 },
    { name: "Trans-Am burst (red energy aura)", weight: 5 },
    { name: "Weathered veteran (rust, paint chips, mud)", weight: 8 },
    { name: "Full armor bolt-on plates", weight: 5 },
    { name: "Holographic camo pattern", weight: 3 },
  ],
};

// ─── Weighted Random Selection ─────────────────────────────────────

function weightedRandom<T extends { name: string; weight: number }>(
  items: T[]
): string {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.name;
  }
  return items[items.length - 1].name;
}

function rollTraits() {
  return {
    frameType: weightedRandom(TRAIT_TABLES.frameType),
    head: weightedRandom(TRAIT_TABLES.head),
    primaryWeapon: weightedRandom(TRAIT_TABLES.primaryWeapon),
    backpack: weightedRandom(TRAIT_TABLES.backpack),
    colorway: weightedRandom(TRAIT_TABLES.colorway),
    stance: weightedRandom(TRAIT_TABLES.stance),
    background: weightedRandom(TRAIT_TABLES.background),
    special: weightedRandom(TRAIT_TABLES.special),
  };
}

// ─── Generation ────────────────────────────────────────────────────

function buildPrompt(traits: ReturnType<typeof rollTraits>): string {
  const specialDesc =
    traits.special !== "None" ? `\nSpecial feature: ${traits.special}` : "";

  return `Generate a high-quality 3D-rendered image of a unique kitbashed Mobile Suit (mecha/Gundam-style robot) for an NFT collection called "GundariuM".

CRITICAL STYLE REQUIREMENTS:
- Clean, professional 3D render quality (like a high-end model kit product photo)
- Dramatic studio lighting with subtle rim light
- The mech should fill most of the frame
- Sharp details, metallic materials, panel lines visible
- NOT anime/cartoon style — this should look like a rendered 3D model or high-quality Gunpla photograph
- Consistent with the reference image style provided

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

async function generateKitbash(traits?: ReturnType<typeof rollTraits>) {
  const rolled = traits ?? rollTraits();

  console.log("\n═══ TRAIT ROLL ═══");
  Object.entries(rolled).forEach(([key, value]) => {
    const rarity = getRarity(key, value);
    console.log(`  ${key.padEnd(16)} ${value} ${rarity}`);
  });

  const prompt = buildPrompt(rolled);

  // Load reference image
  const refImagePath =
    "/Users/joshuagrubbs/.claude/image-cache/f9a02e46-01c0-404e-81a7-5eef8a0f13e9/1.png";
  const refImageData = fs.readFileSync(refImagePath);
  const refImageBase64 = refImageData.toString("base64");

  console.log("\n⏳ Generating kitbash with Gemini...");
  const startTime = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: refImageBase64,
              },
            },
            {
              text: `Use this image as a STYLE REFERENCE for the art direction and quality level. Generate a new, unique Mobile Suit in this same visual style:\n\n${prompt}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"] as any,
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Generated in ${elapsed}s`);

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      console.error("No parts in response");
      console.log("Full response:", JSON.stringify(response, null, 2));
      return;
    }

    let imageFound = false;
    for (const part of parts) {
      if ((part as any).inlineData) {
        const imageData = (part as any).inlineData;
        const ext = imageData.mimeType === "image/png" ? "png" : "jpg";
        const filename = `kitbash-${Date.now()}.${ext}`;
        const outputPath = path.resolve(__dirname, "..", "scripts", filename);
        fs.writeFileSync(outputPath, Buffer.from(imageData.data, "base64"));
        console.log(`\n📸 Saved to: ${outputPath}`);
        console.log(`   Open: open "${outputPath}"`);
        imageFound = true;
      }
      if ((part as any).text) {
        console.log(`\n📝 Model notes: ${(part as any).text.slice(0, 200)}`);
      }
    }

    if (!imageFound) {
      console.log("\n⚠️  No image in response. Gemini may need a different model for image generation.");
      console.log("Parts received:", parts.map((p: any) => Object.keys(p)));

      // Try with imagen model
      console.log("\n🔄 Retrying with gemini-2.0-flash-preview-image-generation...");
      await generateWithImagen(rolled, prompt);
    }
  } catch (error: any) {
    console.error("Generation failed:", error.message);

    if (error.message?.includes("not found") || error.message?.includes("not supported")) {
      console.log("\n🔄 Trying alternate model...");
      await generateWithImagen(rolled, prompt);
    }
  }
}

async function generateWithImagen(
  traits: ReturnType<typeof rollTraits>,
  prompt: string
) {
  const startTime = Date.now();

  try {
    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: prompt,
      config: {
        numberOfImages: 1,
      },
    } as any);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const images = (response as any).generatedImages || (response as any).images;
    if (!images || images.length === 0) {
      console.error("No images in Imagen response");
      console.log("Response keys:", Object.keys(response as any));
      return;
    }

    for (const img of images) {
      const imageData = img.image?.imageBytes || img.imageBytes || img.data;
      if (imageData) {
        const filename = `kitbash-${Date.now()}.png`;
        const outputPath = path.resolve(__dirname, "..", "scripts", filename);
        fs.writeFileSync(outputPath, Buffer.from(imageData, "base64"));
        console.log(`✅ Generated in ${elapsed}s`);
        console.log(`📸 Saved to: ${outputPath}`);
        console.log(`   Open: open "${outputPath}"`);
      }
    }
  } catch (error: any) {
    console.error("Imagen generation failed:", error.message);
    if (error.message) {
      console.error("Details:", error.message.slice(0, 500));
    }
  }
}

function getRarity(traitKey: string, traitValue: string): string {
  const table = TRAIT_TABLES[traitKey as keyof typeof TRAIT_TABLES];
  if (!table) return "";
  const item = table.find((t) => t.name === traitValue);
  if (!item) return "";
  const totalWeight = table.reduce((sum, t) => sum + t.weight, 0);
  const pct = (item.weight / totalWeight) * 100;
  if (pct <= 3) return "🟣 LEGENDARY";
  if (pct <= 6) return "🟡 ULTRA RARE";
  if (pct <= 10) return "🔵 RARE";
  if (pct <= 15) return "🟢 UNCOMMON";
  return "⚪ COMMON";
}

// ─── Main ──────────────────────────────────────────────────────────

const customTraits = process.argv.find((a) => a === "--traits");
if (customTraits) {
  console.log("Custom traits not yet implemented — using random roll");
}

console.log("🎲 GundariuM Kitbash Generator — Prototype v0.1");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
generateKitbash();
