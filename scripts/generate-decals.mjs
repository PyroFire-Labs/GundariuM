import { GoogleGenerativeAI } from "@google/generative-ai";
import { writeFileSync, readFileSync } from "fs";
import { resolve } from "path";

// Read .env.local manually
const envFile = readFileSync(".env.local", "utf8");
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

const DECALS = [
  {
    id: "zeon-crest",
    prompt: "Design a military emblem/crest for the Principality of Zeon from Mobile Suit Gundam. A bold red and gold circular insignia with angular sci-fi design elements. Clean vector style on a solid black background. No text. Military badge aesthetic.",
  },
  {
    id: "efsf-star",
    prompt: "Design a military star insignia for the Earth Federation Space Force from Mobile Suit Gundam. A blue and white star emblem with clean geometric lines, sci-fi military aesthetic. Clean vector style on a solid black background. No text.",
  },
  {
    id: "anaheim",
    prompt: "Design a sleek corporate logo for a fictional sci-fi weapons manufacturer called Anaheim Electronics. Silver/grey metallic look, minimalist futuristic design, hexagonal or circuit-like elements. Clean vector style on a solid black background. No text.",
  },
  {
    id: "ace-badge",
    prompt: "Design a gold ace pilot badge/medal for a mecha anime. A winged golden emblem with a star center, military achievement award aesthetic. Clean vector style on a solid black background. No text.",
  },
  {
    id: "kill-tally",
    prompt: "Design a kill tally mark insignia for a mecha pilot. Red hash marks/tally lines arranged in groups of five, painted on metal plating. Military nose-art style. Clean design on a solid black background. No text.",
  },
  {
    id: "campaign",
    prompt: "Design a military campaign ribbon/medal for a sci-fi space war. Green and gold ribbon with a small medal, military service decoration aesthetic. Clean vector style on a solid black background. No text.",
  },
];

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

async function generateDecal(decal) {
  console.log(`Generating: ${decal.id}...`);

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: decal.prompt }] }],
      generationConfig: {
        responseModalities: ["image", "text"],
      },
    });

    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        const outPath = resolve("public/data/decals", `${decal.id}.png`);
        writeFileSync(outPath, buffer);
        console.log(`  ✓ Saved ${outPath} (${buffer.length} bytes)`);
        return true;
      }
    }

    console.log(`  ✗ No image in response for ${decal.id}`);
    console.log(`  Response parts:`, parts.map(p => p.text ?? "[image]").join(", "));
    return false;
  } catch (err) {
    console.error(`  ✗ Error generating ${decal.id}:`, err.message);
    return false;
  }
}

async function main() {
  console.log("Generating decal artwork with Gemini...\n");

  let success = 0;
  for (const decal of DECALS) {
    const ok = await generateDecal(decal);
    if (ok) success++;
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\nDone: ${success}/${DECALS.length} decals generated.`);
}

main();
