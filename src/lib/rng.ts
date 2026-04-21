import type { SuitData } from "@/types/nft";
import type { TraitSet, KitGrade, Rarity, ArmorType } from "@/types/nft";

const GRADE_RARITY: Record<KitGrade, Rarity> = {
  SD: "Common",
  HG: "Common",
  RG: "Uncommon",
  MG: "Rare",
  MG_VERKA: "Ultra Rare",
  HIRM: "Ultra Rare",
  PG: "Legendary",
};

// Higher grade = higher stat multiplier
const GRADE_MULTIPLIER: Record<KitGrade, number> = {
  SD: 0.7,
  HG: 1.0,
  RG: 1.1,
  MG: 1.2,
  MG_VERKA: 1.3,
  HIRM: 1.35,
  PG: 1.5,
};

const ARMOR_MAP: Record<string, ArmorType> = {
  standard: "Standard",
  gundanium: "Gundanium",
  phase_shift: "Phase Shift",
  "i-field": "I-Field",
  i_field: "I-Field",
  gn_particle: "GN Particle",
  luna_titanium: "Luna Titanium",
  chobham: "Standard",
  full_armor: "Standard",
  nanolaminate: "Standard",
  e_carbon: "Standard",
  gundarium: "Standard",
  tp_armor: "Standard",
  variable_phase_shift: "Phase Shift",
};

function randInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function scaledRoll(base: [number, number], multiplier: number): number {
  const min = Math.round(base[0] * multiplier);
  const max = Math.round(base[1] * multiplier);
  return randInRange(min, max);
}

export function generateTraits(suit: SuitData, grade: KitGrade): TraitSet {
  const { stat_ranges, weapons } = suit;
  const m = GRADE_MULTIPLIER[grade];

  const hp = scaledRoll(stat_ranges.hp, m);
  const attack = scaledRoll(stat_ranges.attack, m);

  // Distribute weapons across 4 slots
  const primary = weapons[0] ?? "Beam Rifle";
  const secondary = weapons[1] ?? "Beam Saber";
  const tertiary = weapons[2] ?? "Shield";
  const special = weapons[4] ?? weapons[3] ?? weapons[0] ?? "Vulcan Gun";

  // Damage values derived from scaled attack stat
  const primaryDamage = randInRange(attack - 5, attack + 10);
  const secondaryDamage = randInRange(Math.floor(attack * 0.7), Math.floor(attack * 0.9));
  const tertiaryDamage = randInRange(Math.floor(attack * 0.4), Math.floor(attack * 0.6));
  const specialDamage = randInRange(Math.floor(attack * 1.1), Math.floor(attack * 1.4));

  const armorType: ArmorType = ARMOR_MAP[suit.armor_type] ?? "Standard";
  const rarity: Rarity = GRADE_RARITY[grade];

  return {
    name: suit.name,
    series: suit.series,
    faction: suit.faction,
    grade,
    rarity,
    hp,
    pilotName: suit.pilot,
    armorType,
    primaryWeapon: primary,
    primaryDamage,
    secondaryWeapon: secondary,
    secondaryDamage,
    tertiaryWeapon: tertiary,
    tertiaryDamage,
    specialAttack: special,
    specialDamage,
  };
}
