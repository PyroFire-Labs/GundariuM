import type { BattleCard, WeaponSlot } from "../battle/deterministicSim";
import type { TraitSet } from "../../types/nft";

export interface Move {
  type: WeaponSlot;
  name: string;
  power: number;
}

export interface FrameStats {
  tokenId?: bigint;
  name: string;
  armorType: TraitSet["armorType"];
  moves: readonly [Move, Move, Move, Move];
  battleCard: BattleCard;
}

export interface FrameStatsError { message: string; }
export type FrameStatsResult = { ok: true; value: FrameStats } | { ok: false; error: FrameStatsError };

function invalid(message: string): FrameStatsResult { return { ok: false, error: { message } }; }

export function toFrameStats(traits: TraitSet, tokenId?: bigint): FrameStatsResult {
  if (!Number.isFinite(traits.hp) || traits.hp <= 0) return invalid("HP must be positive");
  const source: Array<[WeaponSlot, string, number]> = [
    ["primary", traits.primaryWeapon, traits.primaryDamage], ["secondary", traits.secondaryWeapon, traits.secondaryDamage],
    ["tertiary", traits.tertiaryWeapon, traits.tertiaryDamage], ["special", traits.specialAttack, traits.specialDamage],
  ];
  for (const [, name, power] of source) {
    if (!name.trim()) return invalid("Move name is required");
    if (!Number.isFinite(power) || power <= 0) return invalid("Move power must be positive");
  }
  const moves: FrameStats["moves"] = [
    { type: "primary", name: traits.primaryWeapon, power: traits.primaryDamage },
    { type: "secondary", name: traits.secondaryWeapon, power: traits.secondaryDamage },
    { type: "tertiary", name: traits.tertiaryWeapon, power: traits.tertiaryDamage },
    { type: "special", name: traits.specialAttack, power: traits.specialDamage },
  ];
  return { ok: true, value: { tokenId, name: traits.name, armorType: traits.armorType, moves, battleCard: {
    name: traits.name, hp: traits.hp, armorType: traits.armorType, primaryWeapon: traits.primaryWeapon, primaryDamage: traits.primaryDamage,
    secondaryWeapon: traits.secondaryWeapon, secondaryDamage: traits.secondaryDamage, tertiaryWeapon: traits.tertiaryWeapon, tertiaryDamage: traits.tertiaryDamage,
    specialAttack: traits.specialAttack, specialDamage: traits.specialDamage,
  } } };
}
