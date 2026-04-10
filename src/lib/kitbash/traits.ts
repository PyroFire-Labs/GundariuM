import type { KitbashTraits, Rarity, TraitRarity } from "@/types/nft";

interface WeightedTrait {
  name: string;
  weight: number;
}

// ─── Trait Tables ──────────────────────────────────────────────────

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

export function rollTraits(factionHint?: string): KitbashTraits {
  return {
    frameType: weightedRandom(TRAIT_TABLES.frameType),
    head: weightedRandom(TRAIT_TABLES.head),
    primaryWeapon: weightedRandom(TRAIT_TABLES.primaryWeapon),
    backpack: weightedRandom(TRAIT_TABLES.backpack),
    colorway: factionHint
      ? factionColorway(factionHint)
      : weightedRandom(TRAIT_TABLES.colorway),
    stance: weightedRandom(TRAIT_TABLES.stance),
    background: weightedRandom(TRAIT_TABLES.background),
    special: weightedRandom(TRAIT_TABLES.special),
  };
}

// ─── Rarity Derivation ────────────────────────────────────────────

export function getTraitRarity(
  traitKey: keyof KitbashTraits,
  traitValue: string
): TraitRarity {
  const table = TRAIT_TABLES[traitKey];
  const item = table.find((t) => t.name === traitValue);
  if (!item) return "Common";
  const total = table.reduce((sum, t) => sum + t.weight, 0);
  const pct = (item.weight / total) * 100;
  if (pct <= 3) return "Legendary";
  if (pct <= 6) return "Ultra Rare";
  if (pct <= 10) return "Rare";
  if (pct <= 15) return "Uncommon";
  return "Common";
}

export function deriveCardRarity(traits: KitbashTraits): Rarity {
  const keys = Object.keys(traits) as (keyof KitbashTraits)[];
  let hasLegendary = false;
  let nonCommonCount = 0;

  for (const key of keys) {
    const rarity = getTraitRarity(key, traits[key]);
    if (rarity === "Legendary") hasLegendary = true;
    if (rarity !== "Common") nonCommonCount++;
  }

  if (hasLegendary) return "Legendary";
  if (nonCommonCount >= 4) return "Ultra Rare";
  if (nonCommonCount >= 3) return "Rare";
  if (nonCommonCount >= 2) return "Uncommon";
  return "Common";
}

// ─── Faction Colorway Bias ─────────────────────────────────────────

const FACTION_COLORWAYS: Record<string, string[]> = {
  EFSF: ["Federation White & Blue"],
  ZEON: ["Zeon Army Green", "Char Red", "Neo Zeon Crimson"],
  ZAFT: ["Zeon Army Green", "Celestial Being Gunmetal & White"],
  ALLIANCE: ["Federation White & Blue", "Titans Navy Blue"],
  OZ: ["OZ Royal Purple", "Titans Navy Blue"],
  GUNDAM_WING_TEAM: ["Federation White & Blue", "Shadow Black & Gold"],
  CELESTIAL_BEING: ["Celestial Being Gunmetal & White"],
  HUMAN_REFORM_LEAGUE: ["Desert Tan & Brown", "Titans Navy Blue"],
  INNOVATION: ["Psychoframe Aurora (iridescent)", "OZ Royal Purple"],
};

function factionColorway(faction: string): string {
  const options = FACTION_COLORWAYS[faction];
  if (options && options.length > 0) {
    return options[Math.floor(Math.random() * options.length)];
  }
  return weightedRandom(TRAIT_TABLES.colorway);
}

// ─── Stats Derivation ──────────────────────────────────────────────

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

// ─── Name Generation ───────────────────────────────────────────────

export function generateSuitName(traits: KitbashTraits): string {
  const prefixes: Record<string, string[]> = {
    Standard: ["GN", "RX", "MSN", "GAT"],
    "Heavy Armor": ["FA", "RX-FA", "XXXG"],
    "High Mobility": ["MS", "RGZ", "GNY"],
    Sniper: ["RGM", "MSZ", "GN"],
    Commander: ["MSN", "RX", "CB"],
    Berserker: ["MRX", "NZ", "OZ"],
    Stealth: ["RGM-S", "GN-X", "ASW"],
    "Full Armor": ["FA", "FAZZ", "PF"],
  };
  const opts = prefixes[traits.frameType] ?? ["MS"];
  const prefix = opts[Math.floor(Math.random() * opts.length)];
  const num = randInt(10, 999);
  const suffix = traits.head === "Mono-Eye" ? "" : " Gundam";
  return `${prefix}-${num}${suffix}`;
}
