import { NextResponse } from "next/server";
import type { KitbashTraits, TraitSet } from "@/types/nft";
import {
  rollTraits,
  deriveCardRarity,
  deriveStats,
  generateSuitName,
  getTraitRarity,
} from "@/lib/kitbash/traits";
import { generateKitbashImage } from "@/lib/kitbash/generate";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkRateLimit } from "@/lib/rateLimit";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { faction: factionHint, turnstileToken } = body as {
      faction?: string;
      turnstileToken?: string;
    };

    // Anti-abuse: verify Turnstile
    if (turnstileToken) {
      const valid = await verifyTurnstile(turnstileToken);
      if (!valid) {
        return NextResponse.json({ error: "Bot detected" }, { status: 403 });
      }
    }

    // Rate limit: 10 generations per hour per IP
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const limit = checkRateLimit(`gen:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
      );
    }

    const kitbashTraits = rollTraits(factionHint);
    const rarity = deriveCardRarity(kitbashTraits);
    const stats = deriveStats(rarity);
    const name = generateSuitName(kitbashTraits);
    const faction = deriveFaction(kitbashTraits.colorway);
    const armorType = deriveArmorType(kitbashTraits);

    const { imageBase64, mimeType } = await generateKitbashImage(kitbashTraits);

    const traits: TraitSet = {
      name,
      series: "GundariuM Genesis",
      faction,
      rarity,
      ...stats,
      pilotName: "Autonomous AI",
      armorType,
      primaryWeapon: kitbashTraits.primaryWeapon,
      secondaryWeapon: deriveSecondaryWeapon(kitbashTraits),
      secondaryDamage: stats.secondaryDamage,
      tertiaryWeapon: deriveTertiaryWeapon(kitbashTraits),
      tertiaryDamage: stats.tertiaryDamage,
      specialAttack: deriveSpecialAttack(kitbashTraits),
      specialDamage: stats.specialDamage,
    };

    const traitRarities = Object.fromEntries(
      (Object.keys(kitbashTraits) as (keyof KitbashTraits)[]).map((key) => [
        key,
        getTraitRarity(key, kitbashTraits[key]),
      ])
    );

    return NextResponse.json({
      traits,
      kitbashTraits,
      traitRarities,
      imageBase64,
      imageMimeType: mimeType,
    });
  } catch (error) {
    console.error("Kitbash generation failed:", error);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}

function deriveFaction(colorway: string): string {
  const map: Record<string, string> = {
    "Federation White & Blue": "EFSF",
    "Zeon Army Green": "ZEON",
    "Char Red": "ZEON",
    "Titans Navy Blue": "ALLIANCE",
    "AEUG Dark Blue & Red": "EFSF",
    "Neo Zeon Crimson": "ZEON",
    "Celestial Being Gunmetal & White": "CELESTIAL_BEING",
    "OZ Royal Purple": "OZ",
    "Desert Tan & Brown": "HUMAN_REFORM_LEAGUE",
    "Arctic White & Silver": "EFSF",
    "Shadow Black & Gold": "GUNDAM_WING_TEAM",
    "Psychoframe Aurora (iridescent)": "INNOVATION",
    "Chrome Silver": "UNKNOWN",
    "Phantom Midnight Blue": "UNKNOWN",
  };
  return map[colorway] ?? "UNKNOWN";
}

function deriveArmorType(traits: KitbashTraits): TraitSet["armorType"] {
  if (traits.special.includes("Psychoframe")) return "GN Particle";
  if (traits.special.includes("Trans-Am")) return "GN Particle";
  if (traits.special.includes("Phase")) return "Phase Shift";
  if (traits.frameType === "Full Armor") return "Gundanium";
  if (traits.frameType === "Heavy Armor") return "Luna Titanium";
  if (traits.frameType === "Stealth") return "I-Field";
  if (traits.head === "Mono-Eye") return "Standard";
  return "Standard";
}

function deriveSecondaryWeapon(traits: KitbashTraits): string {
  const map: Record<string, string> = {
    "Beam Rifle": "Beam Saber",
    "Machine Gun": "Heat Hawk",
    "Heat Hawk": "Machine Gun",
    "Beam Saber (dual)": "Vulcan Pod",
    Bazooka: "Machine Gun",
    "Gatling Gun": "Missile Pod",
    "Beam Cannon": "Beam Saber",
    "Mega Launcher": "Beam Saber",
    "Twin Buster Rifle": "Beam Saber",
    "GN Sword": "GN Beam Pistol",
    "Ship-Cutting Sword": "Vulcan Pod",
  };
  return map[traits.primaryWeapon] ?? "Beam Saber";
}

function deriveTertiaryWeapon(traits: KitbashTraits): string {
  const map: Record<string, string> = {
    "Standard Thruster Pack": "Head Vulcan",
    "Flight Unit": "Wing Beam Cannon",
    "Heavy Arms Rack": "Micro-Missile Barrage",
    "Funnel System": "Funnel Beam",
    "DRAGOON System": "DRAGOON Volley",
    "Booster Pod": "Chest Vulcan",
    "Wing Binders": "Binder Beam Gun",
    "Psychoframe Emitter": "Psycho Wave",
  };
  return map[traits.backpack] ?? "Head Vulcan";
}

function deriveSpecialAttack(traits: KitbashTraits): string {
  if (traits.special === "Trans-Am burst (red energy aura)")
    return "Trans-Am Overdrive";
  if (traits.special === "Psychoframe glow (pink/green energy lines)")
    return "Psychoframe Resonance";
  if (traits.special === "Full armor bolt-on plates")
    return "Full Armor Purge Assault";
  if (traits.special === "Holographic camo pattern")
    return "Mirage Colloid Strike";

  const map: Record<string, string> = {
    "Funnel System": "All-Range Attack",
    "DRAGOON System": "Full Burst Mode",
    "Psychoframe Emitter": "Newtype Flash",
    "Heavy Arms Rack": "Full Payload Barrage",
  };
  return map[traits.backpack] ?? "Limit Break";
}
