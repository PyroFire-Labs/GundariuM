export interface SuitData {
  id: string;
  name: string;
  model_number: string;
  grades: string[];
  series: string;
  timeline: string;
  era: string;
  faction: string;
  pilot: string;
  weapons: string[];
  armor_type: string;
  kit_rarity: string;
  kit_rarity_score: number;
  known_print_run: string;
  stat_ranges: {
    hp: [number, number];
    attack: [number, number];
    defense: [number, number];
    speed: [number, number];
  };
}

export type Rarity = "Common" | "Uncommon" | "Rare" | "Ultra Rare" | "Legendary";

export type ArmorType =
  | "Standard"
  | "Gundanium"
  | "Phase Shift"
  | "I-Field"
  | "GN Particle"
  | "Luna Titanium";

export type KitGrade = "SD" | "HG" | "RG" | "MG" | "MG_VERKA" | "HIRM" | "PG";

export interface TraitSet {
  name: string;
  series: string;
  faction: string;
  grade?: KitGrade;
  rarity: Rarity;
  hp: number;
  pilotName: string;
  armorType: ArmorType;
  primaryWeapon: string;
  primaryDamage: number;
  secondaryWeapon: string;
  secondaryDamage: number;
  tertiaryWeapon: string;
  tertiaryDamage: number;
  specialAttack: string;
  specialDamage: number;
  confidence?: number;
  // Cosmetics (mutable after mint)
  repaintColor?: string;
  decalId?: string;
}

export interface GunplaCardMetadata {
  name: string;
  description: string;
  image: string; // ipfs://... URI
  attributes: OpenSeaAttribute[];
}

export interface OpenSeaAttribute {
  trait_type: string;
  value: string | number;
  display_type?: "number" | "boost_number" | "boost_percentage" | "date";
  max_value?: number;
}

export interface MintedCard {
  tokenId: bigint;
  owner: string;
  tokenUri: string;
  traits: TraitSet;
  imageUrl: string;
  mintedAt: number;
}

export function rarityToIndex(rarity: Rarity): number {
  const map: Record<Rarity, number> = {
    Common: 0,
    Uncommon: 1,
    Rare: 2,
    "Ultra Rare": 3,
    Legendary: 4,
  };
  return map[rarity];
}

export function indexToRarity(index: number): Rarity {
  const rarities: Rarity[] = [
    "Common",
    "Uncommon",
    "Rare",
    "Ultra Rare",
    "Legendary",
  ];
  return rarities[index] ?? "Common";
}

export function buildOpenSeaAttributes(traits: TraitSet): OpenSeaAttribute[] {
  return [
    { trait_type: "Series", value: traits.series },
    { trait_type: "Faction", value: traits.faction },
    { trait_type: "Grade", value: traits.grade ?? "HG" },
    { trait_type: "Rarity", value: traits.rarity },
    { trait_type: "Pilot", value: traits.pilotName },
    { trait_type: "Armor Type", value: traits.armorType },
    { trait_type: "HP", display_type: "number", value: traits.hp, max_value: 2000 },
    { trait_type: "Primary Weapon", value: traits.primaryWeapon },
    { trait_type: "Primary Damage", display_type: "number", value: traits.primaryDamage },
    { trait_type: "Secondary Weapon", value: traits.secondaryWeapon },
    { trait_type: "Secondary Damage", display_type: "number", value: traits.secondaryDamage },
    { trait_type: "Tertiary Weapon", value: traits.tertiaryWeapon },
    { trait_type: "Tertiary Damage", display_type: "number", value: traits.tertiaryDamage },
    { trait_type: "Special Attack", value: traits.specialAttack },
    { trait_type: "Special Damage", display_type: "number", value: traits.specialDamage },
    ...(traits.repaintColor ? [{ trait_type: "Repaint", value: traits.repaintColor }] : []),
    ...(traits.decalId ? [{ trait_type: "Decal", value: traits.decalId }] : []),
  ];
}

/** Rolled traits for a generative kitbash mint */
export interface KitbashTraits {
  frameType: string;
  head: string;
  primaryWeapon: string;
  backpack: string;
  colorway: string;
  stance: string;
  background: string;
  special: string;
}

/** Rarity tier for individual traits */
export type TraitRarity = "Common" | "Uncommon" | "Rare" | "Ultra Rare" | "Legendary";
