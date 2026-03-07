import type { TraitSet, ArmorType } from "@/types/nft";

export interface TurnLog {
  turn: number;
  attackerName: string;
  weapon: string;
  rawDamage: number;
  finalDamage: number;
  defenderName: string;
  defenderHpAfter: number;
}

export interface BattleResult {
  winner: "player" | "enemy";
  finalHpWinner: number;
  log: TurnLog[];
}

// Weapon slots in rotation order
type WeaponSlot = "primary" | "secondary" | "tertiary" | "special";
const ROTATION: WeaponSlot[] = ["primary", "secondary", "tertiary", "special"];

function getWeapon(traits: TraitSet, slot: WeaponSlot) {
  switch (slot) {
    case "primary":   return { name: traits.primaryWeapon,   damage: traits.primaryDamage };
    case "secondary": return { name: traits.secondaryWeapon, damage: traits.secondaryDamage };
    case "tertiary":  return { name: traits.tertiaryWeapon,  damage: traits.tertiaryDamage };
    case "special":   return { name: traits.specialAttack,   damage: traits.specialDamage };
  }
}

// Armor damage multiplier based on weapon slot and defender armor type.
// Slot "primary" = ranged/beam, "secondary" = melee/physical, "special" = energy.
function armorMultiplier(weaponSlot: WeaponSlot, defenderArmor: ArmorType): number {
  switch (defenderArmor) {
    case "I-Field":
      // I-Field blocks beam — reduces ranged and special
      return weaponSlot === "secondary" ? 1.0 : 0.45;
    case "Phase Shift":
      // Phase Shift negates physical — reduces melee
      return weaponSlot === "secondary" ? 0.15 : 1.0;
    case "Gundanium":
      // Gundanium reduces all damage slightly
      return 0.80;
    case "GN Particle":
      // GN Particle reduces ranged/energy
      return weaponSlot === "secondary" ? 1.0 : 0.65;
    case "Luna Titanium":
      // Luna Titanium reduces physical
      return weaponSlot === "secondary" ? 0.60 : 1.0;
    case "Standard":
    default:
      return 1.0;
  }
}

/**
 * Simulate a full auto-battle between player and enemy.
 * Both combatants attack simultaneously each turn using a weapon rotation.
 * The session seed (sessionId) adds minor variance to enemy weapon picks.
 */
export function simulateBattle(
  player: TraitSet,
  enemy: TraitSet,
  sessionId: number
): BattleResult {
  let playerHp = player.hp;
  let enemyHp = enemy.hp;
  const log: TurnLog[] = [];

  const MAX_TURNS = 40;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    if (playerHp <= 0 || enemyHp <= 0) break;

    const playerSlot = ROTATION[(turn - 1) % 4];
    // Enemy picks weapon with a seeded offset for variety
    const enemySlot = ROTATION[((turn - 1) + (sessionId % 3)) % 4];

    const playerWeapon = getWeapon(player, playerSlot);
    const enemyWeapon  = getWeapon(enemy, enemySlot);

    // Player attacks enemy
    const playerMult  = armorMultiplier(playerSlot, enemy.armorType);
    const playerDmg   = Math.max(1, Math.round(playerWeapon.damage * playerMult));
    enemyHp = Math.max(0, enemyHp - playerDmg);
    log.push({
      turn,
      attackerName: player.name,
      weapon: playerWeapon.name,
      rawDamage: playerWeapon.damage,
      finalDamage: playerDmg,
      defenderName: enemy.name,
      defenderHpAfter: enemyHp,
    });

    if (enemyHp <= 0) break;

    // Enemy attacks player
    const enemyMult = armorMultiplier(enemySlot, player.armorType);
    const enemyDmg  = Math.max(1, Math.round(enemyWeapon.damage * enemyMult));
    playerHp = Math.max(0, playerHp - enemyDmg);
    log.push({
      turn,
      attackerName: enemy.name,
      weapon: enemyWeapon.name,
      rawDamage: enemyWeapon.damage,
      finalDamage: enemyDmg,
      defenderName: player.name,
      defenderHpAfter: playerHp,
    });

    if (playerHp <= 0) break;
  }

  // Determine winner — if max turns reached, highest remaining HP% wins
  let winner: "player" | "enemy";
  let finalHpWinner: number;

  if (playerHp <= 0 && enemyHp <= 0) {
    // Simultaneous KO — player wins by tiebreak
    winner = "player";
    finalHpWinner = 1;
  } else if (enemyHp <= 0) {
    winner = "player";
    finalHpWinner = playerHp;
  } else if (playerHp <= 0) {
    winner = "enemy";
    finalHpWinner = enemyHp;
  } else {
    // Time limit reached — compare HP %
    const playerPct = playerHp / player.hp;
    const enemyPct  = enemyHp  / enemy.hp;
    winner = playerPct >= enemyPct ? "player" : "enemy";
    finalHpWinner = winner === "player" ? playerHp : enemyHp;
  }

  return { winner, finalHpWinner, log };
}
