/**
 * Pure, deterministic PvE Arena combat resolution — shared by the client
 * (src/app/arena/page.tsx) and the federation receipt route
 * (src/app/api/federation/submit-battle-receipt/route.ts) so both compute a
 * battle's outcome the exact same way. If these ever drift apart, a
 * `deterministic: true` receipt stops being something the server can
 * actually verify — it'd just be trusting the client again.
 *
 * Matchup selection (which two cards fight) is deliberately NOT part of this
 * module or the seed contract — it's decided with plain Math.random() in
 * the component and the resulting player/enemy stat blocks are transmitted
 * explicitly in a receipt payload. `seed` here governs combat only: every
 * crit roll and every enemy weapon pick, nothing before the fight starts.
 */

export type WeaponSlot = "primary" | "secondary" | "tertiary" | "special";

export interface BattleCard {
  name: string;
  hp: number;
  armorType: string;
  primaryWeapon: string;
  primaryDamage: number;
  secondaryWeapon: string;
  secondaryDamage: number;
  tertiaryWeapon: string;
  tertiaryDamage: number;
  specialAttack: string;
  specialDamage: number;
}

export const PLAYER_CRIT_CHANCE = 0.1;
export const ENEMY_CRIT_CHANCE = 0.05;
export const CRIT_MULTIPLIER = 1.6;
export const MAX_TURNS = 30;

const ENEMY_SLOTS: WeaponSlot[] = ["primary", "secondary", "tertiary"];

// Small, fast, deterministic PRNG (mulberry32). Seeding combat with this
// instead of Math.random() makes a battle's outcome a pure function of
// (seed, player move sequence, starting stats) — anyone holding all three
// can replay the exact same rolls and confirm the result.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function armorMultiplier(slot: WeaponSlot, armor: string): number {
  switch (armor) {
    case "I-Field":
      return slot === "secondary" ? 1.0 : 0.45;
    case "Phase Shift":
      return slot === "secondary" ? 0.15 : 1.0;
    case "Gundanium":
      return 0.8;
    case "GN Particle":
      return slot === "secondary" ? 1.0 : 0.65;
    case "Luna Titanium":
      return slot === "secondary" ? 0.6 : 1.0;
    default:
      return 1.0;
  }
}

export function getWeapon(card: BattleCard, slot: WeaponSlot) {
  switch (slot) {
    case "primary":
      return { name: card.primaryWeapon, damage: card.primaryDamage, label: "PRIMARY" };
    case "secondary":
      return { name: card.secondaryWeapon, damage: card.secondaryDamage, label: "SECONDARY" };
    case "tertiary":
      return { name: card.tertiaryWeapon, damage: card.tertiaryDamage, label: "TERTIARY" };
    case "special":
      return { name: card.specialAttack, damage: card.specialDamage, label: "SPECIAL" };
  }
}

export function rollAttack(
  attacker: BattleCard,
  slot: WeaponSlot,
  defender: BattleCard,
  critChance: number,
  rng: () => number
) {
  const weapon = getWeapon(attacker, slot);
  const mult = armorMultiplier(slot, defender.armorType);
  const isCrit = rng() < critChance;
  const critMult = isCrit ? CRIT_MULTIPLIER : 1;
  const damage = Math.max(1, Math.round(weapon.damage * mult * critMult));
  return { damage, isCrit, weaponName: weapon.name };
}

export interface ReplayResult {
  winner: "player" | "enemy";
  turns: number;
  damageDealt: number;
}

/**
 * Replays combat from a seed and the player's move sequence — the same
 * player-attacks-then-enemy-counters turn order the live Arena uses (enemy
 * never picks special, matching WeaponPicker's own charge gating). Enemy
 * moves aren't supplied; they're a deterministic function of the seed, same
 * as in the live component.
 */
export function replayBattle(
  seed: number,
  moves: WeaponSlot[],
  player: BattleCard,
  enemy: BattleCard
): ReplayResult {
  const rng = mulberry32(seed);
  let playerHp = player.hp;
  let enemyHp = enemy.hp;
  let turn = 0;
  let damageDealt = 0;

  for (const slot of moves) {
    turn += 1;

    const playerHit = rollAttack(player, slot, enemy, PLAYER_CRIT_CHANCE, rng);
    enemyHp = Math.max(0, enemyHp - playerHit.damage);
    damageDealt += playerHit.damage;
    if (enemyHp <= 0) return { winner: "player", turns: turn, damageDealt };

    const enemySlot = ENEMY_SLOTS[Math.floor(rng() * ENEMY_SLOTS.length)];
    const enemyHit = rollAttack(enemy, enemySlot, player, ENEMY_CRIT_CHANCE, rng);
    playerHp = Math.max(0, playerHp - enemyHit.damage);
    if (playerHp <= 0) return { winner: "enemy", turns: turn, damageDealt };

    if (turn >= MAX_TURNS) break;
  }

  const pPct = playerHp / player.hp;
  const ePct = enemyHp / enemy.hp;
  return { winner: pPct >= ePct ? "player" : "enemy", turns: turn, damageDealt };
}
