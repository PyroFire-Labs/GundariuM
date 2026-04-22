import type { KitbashTraits, Rarity, TraitRarity } from "@/types/nft";
import type { FactionKey } from "@/lib/constants/factions";
import { FACTION_BIAS } from "./factionBias";

interface WeightedTrait {
  name: string;
  weight: number;
}

// ─── Trait Tables ──────────────────────────────────────────────────
// Existing entries preserved; signature faction-specific entries added
// at low weights so they remain rare in the global pool but become
// natural choices when faction bias filters the pool down.

export const TRAIT_TABLES: Record<keyof KitbashTraits, WeightedTrait[]> = {
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
    // Generic / cross-universe
    { name: "Classic V-Fin", weight: 25 },
    { name: "Mono-Eye", weight: 20 },
    { name: "Visor Type", weight: 15 },
    { name: "Twin Horn", weight: 12 },
    { name: "Antenna Array", weight: 10 },
    { name: "Crown Crest", weight: 8 },
    { name: "Blade Antenna", weight: 6 },
    { name: "Multi-Sensor", weight: 4 },
    // Faction-signature heads
    { name: "Commander Horn", weight: 5 },
    { name: "Gas-Mask Intake", weight: 4 },
    { name: "Knight-Crest", weight: 5 },
    { name: "Multi-Sensor Array", weight: 5 },
    { name: "Beast-like Fin", weight: 5 },
    { name: "Guard Plate", weight: 5 },
    { name: "Knight's Visor", weight: 6 },
    { name: "Permet Shell Faceplate", weight: 4 },
    { name: "Reptilian Crown", weight: 3 },
    { name: "Samurai Helmet", weight: 3 },
    { name: "GN Condenser Head", weight: 4 },
    { name: "Rick Dias Hockey Mask", weight: 3 },
    { name: "Curved V-Fin", weight: 4 },
    { name: "Rabbit-Ear Sensors", weight: 3 },
    { name: "Plumed Sensor", weight: 4 },
    { name: "Slit Visor", weight: 5 },
  ],
  primaryWeapon: [
    // Generic / cross-universe
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
    // Faction-signature weapons
    { name: "Heat Sword", weight: 5 },
    { name: "Beam Naginata", weight: 5 },
    { name: "Pile Bunker", weight: 4 },
    { name: "Smoothbore Cannon", weight: 4 },
    { name: "Schwert Gewehr", weight: 3 },
    { name: "Agni Hyper Impulse Cannon", weight: 3 },
    { name: "GN Sniper Rifle", weight: 4 },
    { name: "Dober Gun", weight: 5 },
    { name: "Beam Scythe", weight: 4 },
    { name: "Heat Shotel", weight: 4 },
    { name: "Long Blade Rifle", weight: 3 },
    { name: "Beam Shotrifle", weight: 3 },
    { name: "Beam Magnum", weight: 3 },
    { name: "GUND-Bit Stave", weight: 3 },
    { name: "Heavy Physical Blade", weight: 5 },
    { name: "Beam Carbine", weight: 5 },
    { name: "Burning Finger", weight: 3 },
    { name: "Photon Beam Rifle", weight: 4 },
    { name: "DODS Rifle", weight: 4 },
    { name: "Tactical Arms", weight: 3 },
    { name: "Halberd", weight: 4 },
    { name: "Battle Blade", weight: 5 },
    { name: "Dainsleif Launcher", weight: 2 },
    { name: "Mega Bazooka Launcher", weight: 3 },
    { name: "Funnel Bits", weight: 3 },
    { name: "Beam Wire", weight: 3 },
    { name: "Gerbera Straight Katana", weight: 3 },
  ],
  backpack: [
    // Generic / cross-universe
    { name: "Standard Thruster Pack", weight: 25 },
    { name: "Flight Unit", weight: 20 },
    { name: "Heavy Arms Rack", weight: 12 },
    { name: "Funnel System", weight: 8 },
    { name: "DRAGOON System", weight: 6 },
    { name: "Booster Pod", weight: 15 },
    { name: "Wing Binders", weight: 10 },
    { name: "Psychoframe Emitter", weight: 4 },
    // Faction-signature backpacks
    { name: "Wizard Pack", weight: 6 },
    { name: "Aile Striker Pack", weight: 6 },
    { name: "Sword Striker Pack", weight: 4 },
    { name: "Launcher Striker Pack", weight: 4 },
    { name: "IWSP", weight: 3 },
    { name: "GN Drive (Cone)", weight: 4 },
    { name: "GN Drive Tau (Flat)", weight: 5 },
    { name: "Active Cloak", weight: 4 },
    { name: "Ahab Reactor Thrusters", weight: 5 },
    { name: "Sub-Arm Rigging", weight: 4 },
    { name: "Minovsky Flight Craft", weight: 3 },
    { name: "Multi-Petal Binders", weight: 3 },
    { name: "Reflector Pack", weight: 4 },
    { name: "Bit On-Form", weight: 4 },
    { name: "Trans-Am Booster", weight: 3 },
    { name: "Movable Frame Thrusters", weight: 5 },
    { name: "Funnel Rack", weight: 4 },
    { name: "Shield Booster (Stackable)", weight: 5 },
    { name: "Atmospheric Pack", weight: 4 },
    { name: "Tail-Blade Thruster", weight: 3 },
    { name: "Core Lander", weight: 3 },
    { name: "Power Cylinder", weight: 4 },
  ],
  colorway: [
    // Existing
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
    // New canonical palettes
    { name: "ZAFT Maroon & Grey", weight: 5 },
    { name: "Strike White, Blue & Red", weight: 5 },
    { name: "Dagger Grey & Navy", weight: 4 },
    { name: "Akatsuki Gold & Black", weight: 3 },
    { name: "Astray Red & White", weight: 4 },
    { name: "Astray Blue & White", weight: 4 },
    { name: "Rusty Iron & Orange", weight: 4 },
    { name: "Tekkadan Dark Olive", weight: 4 },
    { name: "Gjallarhorn Emerald & Slate", weight: 4 },
    { name: "Gjallarhorn Royal Blue", weight: 4 },
    { name: "Vibrant Primary (G-Nations)", weight: 3 },
    { name: "Vagan Gold & Purple", weight: 3 },
    { name: "Vagan Pale Grey & Pink", weight: 3 },
    { name: "Pastel Blue & Translucent (G-Self)", weight: 3 },
    { name: "Lime Green & Silver", weight: 3 },
    { name: "Permet Teal & White", weight: 4 },
    { name: "Slate Blue & Charcoal", weight: 4 },
    { name: "Mafty Pale Orange & White", weight: 3 },
    { name: "Hyaku Shiki Gold", weight: 3 },
    { name: "Solar Orange & White", weight: 3 },
    { name: "Stealth Black & Purple", weight: 3 },
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

// ─── Selection Logic ───────────────────────────────────────────────

function weightedRandom(items: WeightedTrait[]): string {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.name;
  }
  return items[items.length - 1].name;
}

function pickFromAllowList(
  table: WeightedTrait[],
  allowed: readonly string[] | undefined
): string {
  if (!allowed || allowed.length === 0) return weightedRandom(table);
  const filtered = table.filter((t) => allowed.includes(t.name));
  if (filtered.length === 0) return weightedRandom(table);
  return weightedRandom(filtered);
}

export function rollTraits(faction?: FactionKey): KitbashTraits {
  const bias = faction && faction !== "UNKNOWN" ? FACTION_BIAS[faction] : null;

  return {
    frameType: pickFromAllowList(TRAIT_TABLES.frameType, bias?.allowedFrames),
    head: pickFromAllowList(TRAIT_TABLES.head, bias?.allowedHeads),
    primaryWeapon: pickFromAllowList(
      TRAIT_TABLES.primaryWeapon,
      bias?.allowedWeapons
    ),
    backpack: pickFromAllowList(TRAIT_TABLES.backpack, bias?.allowedBackpacks),
    colorway: pickFromAllowList(TRAIT_TABLES.colorway, bias?.colorways),
    stance: weightedRandom(TRAIT_TABLES.stance),
    background: weightedRandom(TRAIT_TABLES.background),
    special: pickFromAllowList(TRAIT_TABLES.special, bias?.allowedSpecial),
  };
}

// ─── Rarity Derivation ────────────────────────────────────────────

// Trait rarity labels use cumulative-weight percentile against a
// weight-descending sort of the pool. This scales with pool size — when
// tables get expanded, thresholds stay meaningful. Percentiles mirror the
// card-rarity distribution below: top 50% is Common, next 25% Uncommon,
// next 15% Rare, next 7% Ultra Rare, final 3% Legendary.
export function getTraitRarity(
  traitKey: keyof KitbashTraits,
  traitValue: string
): TraitRarity {
  const table = TRAIT_TABLES[traitKey];
  const sorted = [...table].sort((a, b) => b.weight - a.weight);
  const total = sorted.reduce((sum, t) => sum + t.weight, 0);
  let cumulative = 0;
  for (const t of sorted) {
    cumulative += t.weight;
    if (t.name === traitValue) {
      const pct = (cumulative / total) * 100;
      if (pct <= 50) return "Common";
      if (pct <= 75) return "Uncommon";
      if (pct <= 90) return "Rare";
      if (pct <= 97) return "Ultra Rare";
      return "Legendary";
    }
  }
  return "Common";
}

const CARD_RARITY_DISTRIBUTION: ReadonlyArray<{ tier: Rarity; weight: number }> = [
  { tier: "Common",     weight: 50 },
  { tier: "Uncommon",   weight: 25 },
  { tier: "Rare",       weight: 15 },
  { tier: "Ultra Rare", weight: 7 },
  { tier: "Legendary",  weight: 3 },
];

// Card rarity is a direct weighted roll, decoupled from per-trait rarity.
// This guarantees the mint-pool distribution regardless of how the trait
// tables evolve (adding new faction variants, new weapons, etc.).
// Traits argument is kept for future mechanics (faction rarity boosts,
// cosmetic luck effects) but is unused today.
export function deriveCardRarity(_traits: KitbashTraits): Rarity {
  let roll = Math.random() * 100;
  for (const entry of CARD_RARITY_DISTRIBUTION) {
    roll -= entry.weight;
    if (roll <= 0) return entry.tier;
  }
  return "Common";
}

// ─── Stats Derivation ──────────────────────────────────────────────

// Ranges match the documented spec in CLAUDE.md: non-overlapping, with
// ~7× Legendary-to-Common HP spread. Damage ranges are percentages of HP.
const HP_RANGES: Record<Rarity, [number, number]> = {
  Common: [150, 349],
  Uncommon: [350, 599],
  Rare: [600, 899],
  "Ultra Rare": [900, 1199],
  Legendary: [1200, 2000],
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function deriveStats(rarity: Rarity) {
  const [hpMin, hpMax] = HP_RANGES[rarity];
  const hp = randInt(hpMin, hpMax);
  return {
    hp,
    primaryDamage: randInt(Math.floor(hp * 0.15), Math.floor(hp * 0.25)),
    secondaryDamage: randInt(Math.floor(hp * 0.25), Math.floor(hp * 0.40)),
    tertiaryDamage: randInt(Math.floor(hp * 0.08), Math.floor(hp * 0.15)),
    specialDamage: randInt(Math.floor(hp * 0.50), Math.floor(hp * 0.80)),
  };
}

