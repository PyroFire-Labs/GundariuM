import { NextResponse } from "next/server";
import type { KitbashTraits, TraitSet } from "@/types/nft";
import {
  rollTraits,
  deriveCardRarity,
  deriveStats,
  getTraitRarity,
} from "@/lib/kitbash/traits";
import { pickFallbackName } from "@/lib/kitbash/namePools";
import { generateKitbashImage } from "@/lib/kitbash/generate";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkRateLimit } from "@/lib/rateLimit";
import { FACTION_KEYS, type FactionKey } from "@/lib/constants/factions";

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

    // Two-layer rate limit per IP: 5 generations/hour AND 20 generations/day.
    // The hourly bucket throttles burst abuse; the daily bucket is the
    // backstop that prevents slow-roll attacks under the hourly ceiling.
    // NOTE: the underlying store is in-memory per Vercel serverless instance,
    // so the effective ceiling is N × max where N is the active instance
    // count. Move to Vercel KV / Upstash post-launch for cross-instance
    // accuracy. Defense-in-depth for now: hard daily budget cap on the
    // Google AI Studio account bounds total spend even if the limit leaks.
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const hourly = checkRateLimit(`gen:hour:${ip}`, 5, 60 * 60 * 1000);
    const daily = checkRateLimit(`gen:day:${ip}`, 20, 24 * 60 * 60 * 1000);
    if (!hourly.allowed || !daily.allowed) {
      const retryAfterMs = !hourly.allowed
        ? hourly.retryAfterMs
        : daily.retryAfterMs;
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        }
      );
    }

    // Honor the user's faction selection. Validate against the canonical
    // faction list; treat anything unexpected (or missing) as UNKNOWN, which
    // produces a fully randomized roll across all universes.
    const validHint: FactionKey | null =
      factionHint &&
      (FACTION_KEYS as readonly string[]).includes(factionHint) &&
      factionHint !== "UNKNOWN"
        ? (factionHint as FactionKey)
        : null;

    const kitbashTraits = rollTraits(validHint ?? undefined);
    const rarity = deriveCardRarity(kitbashTraits);
    const stats = deriveStats(rarity);
    const name = pickFallbackName(rarity);
    const faction = validHint ?? deriveFaction(kitbashTraits.colorway);
    const armorType = deriveArmorType(kitbashTraits);

    const { imageBase64, mimeType } = await generateKitbashImage(
      kitbashTraits,
      validHint ?? undefined
    );

    const traits: TraitSet = {
      name,
      series: "GundariuM Genesis",
      faction,
      rarity,
      ...stats,
      pilotName: "Autonomous AI",
      armorType,
      primaryWeapon: kitbashTraits.primaryWeapon,
      secondaryWeapon: deriveSecondaryWeapon(kitbashTraits, faction),
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
    "Titans Navy Blue": "TITANS",
    "AEUG Dark Blue & Red": "AEUG",
    "Neo Zeon Crimson": "NEO_ZEON",
    "Celestial Being Gunmetal & White": "CELESTIAL_BEING",
    "OZ Royal Purple": "OZ",
    "Desert Tan & Brown": "HUMAN_REFORM_LEAGUE",
    "Arctic White & Silver": "EFSF",
    "Shadow Black & Gold": "GUNDAM_WING_TEAM",
    "Psychoframe Aurora (iridescent)": "INNOVATION",
    "Chrome Silver": "UNKNOWN",
    "Phantom Midnight Blue": "UNKNOWN",
    "ZAFT Maroon & Grey": "ZAFT",
    "Strike White, Blue & Red": "ALLIANCE",
    "Dagger Grey & Navy": "ALLIANCE",
    "Akatsuki Gold & Black": "ORB",
    "Astray Red & White": "ASTRAY",
    "Astray Blue & White": "ASTRAY",
    "Rusty Iron & Orange": "TEKKADAN",
    "Tekkadan Dark Olive": "TEKKADAN",
    "Gjallarhorn Emerald & Slate": "GJALLARHORN",
    "Gjallarhorn Royal Blue": "GJALLARHORN",
    "Vibrant Primary (G-Nations)": "G_NATIONS",
    "Vagan Gold & Purple": "VAGAN",
    "Vagan Pale Grey & Pink": "VAGAN",
    "Pastel Blue & Translucent (G-Self)": "G_SELF",
    "Lime Green & Silver": "G_SELF",
    "Permet Teal & White": "AD_STELLA",
    "Slate Blue & Charcoal": "AD_STELLA",
    "Mafty Pale Orange & White": "MAFTY",
    "Hyaku Shiki Gold": "AEUG",
    "Solar Orange & White": "CELESTIAL_BEING",
    "Stealth Black & Purple": "CELESTIAL_BEING",
  };
  return map[colorway] ?? "UNKNOWN";
}

function deriveArmorType(traits: KitbashTraits): TraitSet["armorType"] {
  if (traits.special.includes("Psychoframe")) return "GN Particle";
  if (traits.special.includes("Trans-Am")) return "GN Particle";
  if (traits.special.includes("Phase")) return "Phase Shift";
  if (
    traits.backpack === "GN Drive (Cone)" ||
    traits.backpack === "GN Drive Tau (Flat)" ||
    traits.backpack === "Trans-Am Booster"
  )
    return "GN Particle";
  if (traits.backpack === "Ahab Reactor Thrusters") return "Gundanium";
  if (traits.frameType === "Full Armor") return "Gundanium";
  if (traits.frameType === "Heavy Armor") return "Luna Titanium";
  if (traits.frameType === "Stealth") return "I-Field";
  return "Standard";
}

const PHYSICAL_WEAPONS = new Set([
  "Heat Hawk",
  "Heat Sword",
  "Bazooka",
  "Machine Gun",
  "Gatling Gun",
  "Pile Bunker",
  "Smoothbore Cannon",
  "Heavy Physical Blade",
  "Battle Blade",
  "Halberd",
  "Heat Shotel",
  "Tactical Arms",
  "Gerbera Straight Katana",
  "Dainsleif Launcher",
]);

// Factions whose canon explicitly forbids beam-class weapons. If the secondary
// weapon derivation lands on a beam variant, substitute with a faction-
// appropriate physical alternative.
const NO_BEAM_FACTIONS = new Set([
  "TEKKADAN",
  "GJALLARHORN",
  "HUMAN_REFORM_LEAGUE",
]);

const NO_BEAM_PHYSICAL_FALLBACK: Record<string, string> = {
  TEKKADAN: "Sub-Arm Knife",
  GJALLARHORN: "Battle Blade",
  HUMAN_REFORM_LEAGUE: "Carbon Blade",
};

function isBeamWeapon(name: string): boolean {
  return /\b(Beam|GN |GUND-Bit|Photon|DODS|Mega Particle)\b/.test(name);
}

function deriveSecondaryWeapon(
  traits: KitbashTraits,
  faction?: string
): string {
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
    "Heat Sword": "Bazooka",
    "Beam Naginata": "Beam Cannon",
    "Pile Bunker": "Sub-Arm Knife",
    "Smoothbore Cannon": "Carbon Blade",
    "Schwert Gewehr": "Beam Boomerang",
    "Agni Hyper Impulse Cannon": "Beam Saber",
    "GN Sniper Rifle": "GN Pistol",
    "Dober Gun": "Beam Saber",
    "Beam Scythe": "Hyper Jammer",
    "Heat Shotel": "Heat Shotel (paired)",
    "Long Blade Rifle": "Beam Saber",
    "Beam Shotrifle": "Beam Tomahawk",
    "Beam Magnum": "Beam Saber",
    "GUND-Bit Stave": "Beam Carbine",
    "Heavy Physical Blade": "Beam Carbine",
    "Beam Carbine": "GUND-Bit",
    "Burning Finger": "Erupting Burning Finger",
    "Photon Beam Rifle": "Beam Wire",
    "DODS Rifle": "Beam Saber",
    "Tactical Arms": "Beam Boomerang",
    Halberd: "Battle Blade",
    "Battle Blade": "Pile Bunker",
    "Dainsleif Launcher": "Battle Blade",
    "Mega Bazooka Launcher": "Beam Saber",
    "Funnel Bits": "Beam Shotrifle",
    "Beam Wire": "Beam Shield",
    "Gerbera Straight Katana": "Beam Rifle",
  };
  const secondary = map[traits.primaryWeapon] ?? "Beam Saber";

  // No-beam factions: if the derived secondary is beam-class, substitute with
  // a faction-appropriate physical sidearm.
  if (faction && NO_BEAM_FACTIONS.has(faction) && isBeamWeapon(secondary)) {
    return NO_BEAM_PHYSICAL_FALLBACK[faction] ?? "Sub-Arm Knife";
  }

  return secondary;
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
    "Wizard Pack": "Wizard Beam Volley",
    "Aile Striker Pack": "Aile Beam Boomerang",
    "Sword Striker Pack": "Anti-Ship Sword Throw",
    "Launcher Striker Pack": "Agni Burst",
    IWSP: "Combined Weapon Volley",
    "GN Drive (Cone)": "GN Burst",
    "GN Drive Tau (Flat)": "GN Beam Volley",
    "Active Cloak": "Cloak Slash",
    "Ahab Reactor Thrusters": "Reactor Boost Charge",
    "Sub-Arm Rigging": "Sub-Arm Strike",
    "Minovsky Flight Craft": "Minovsky Sweep",
    "Multi-Petal Binders": "Petal Beam Volley",
    "Reflector Pack": "Photon Reflector Beam",
    "Bit On-Form": "GUND-Bit Volley",
    "Trans-Am Booster": "Trans-Am Sweep",
    "Movable Frame Thrusters": "Frame Boost Strike",
    "Funnel Rack": "Funnel Volley",
    "Shield Booster (Stackable)": "Shield Beam Burst",
    "Atmospheric Pack": "Atmospheric Burn",
    "Tail-Blade Thruster": "Tail-Blade Sweep",
    "Core Lander": "Core Lander Charge",
    "Power Cylinder": "Power Burst",
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
    "GN Drive (Cone)": "Trans-Am Overdrive",
    "GN Drive Tau (Flat)": "GN Field Burst",
    "Trans-Am Booster": "Trans-Am Burst",
    "Ahab Reactor Thrusters": "Reactor Overload",
    "Funnel Rack": "All-Range Funnel Storm",
    "Bit On-Form": "GUND-Bit All-Range Strike",
    "Reflector Pack": "Photon Reflector Burst",
    "Minovsky Flight Craft": "Minovsky Acceleration",
    "Wizard Pack": "Wizard Limit Break",
    "Aile Striker Pack": "Aile Limit Break",
  };

  // Tekkadan / Gjallarhorn (no beam) — use physical-melee finishers
  if (PHYSICAL_WEAPONS.has(traits.primaryWeapon) && !map[traits.backpack]) {
    return "Brutal Overdrive Strike";
  }

  return map[traits.backpack] ?? "Limit Break";
}
