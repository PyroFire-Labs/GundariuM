import assert from "node:assert/strict";
import test from "node:test";

import { armorMultiplier, replayBattle, rollAttack, type BattleCard } from "./deterministicSim.ts";

const player: BattleCard = {
  name: "Player",
  hp: 100,
  armorType: "Standard",
  primaryWeapon: "Rifle",
  primaryDamage: 20,
  secondaryWeapon: "Blade",
  secondaryDamage: 30,
  tertiaryWeapon: "Missiles",
  tertiaryDamage: 10,
  specialAttack: "Nova",
  specialDamage: 80,
};

const enemy: BattleCard = {
  name: "Enemy",
  hp: 100,
  armorType: "Standard",
  primaryWeapon: "Cannon",
  primaryDamage: 15,
  secondaryWeapon: "Axe",
  secondaryDamage: 25,
  tertiaryWeapon: "Pods",
  tertiaryDamage: 10,
  specialAttack: "Burst",
  specialDamage: 60,
};

test("replayBattle returns the same result for the same inputs", () => {
  const moves = ["primary", "secondary", "tertiary", "special"] as const;

  const first = replayBattle(1234, [...moves], player, enemy);
  const second = replayBattle(1234, [...moves], player, enemy);

  assert.deepEqual(first, second);
});

test("armorMultiplier preserves the beam and physical counters", () => {
  assert.equal(armorMultiplier("primary", "I-Field"), 0.45);
  assert.equal(armorMultiplier("secondary", "I-Field"), 1);
  assert.equal(armorMultiplier("secondary", "Phase Shift"), 0.15);
  assert.equal(armorMultiplier("primary", "Gundanium"), 0.8);
});

test("rollAttack applies a deterministic critical hit", () => {
  const result = rollAttack(player, "primary", enemy, 0.1, () => 0.05);

  assert.deepEqual(result, { damage: 32, isCrit: true, weaponName: "Rifle" });
});

test("replayBattle stops when the player defeats the enemy", () => {
  const fragileEnemy = { ...enemy, hp: 10 };

  assert.deepEqual(replayBattle(1, ["primary"], player, fragileEnemy), {
    winner: "player",
    turns: 1,
    damageDealt: 20,
  });
});

test("replayBattle stops when the enemy defeats the player", () => {
  const fragilePlayer = { ...player, hp: 1 };

  assert.deepEqual(replayBattle(1, ["tertiary"], fragilePlayer, enemy), {
    winner: "enemy",
    turns: 1,
    damageDealt: 10,
  });
});

test("replayBattle resolves a turn-cap tie in favor of the player", () => {
  const durablePlayer = { ...player, hp: 1_000_000, primaryDamage: 1, secondaryDamage: 1, tertiaryDamage: 1, specialDamage: 1 };
  const durableEnemy = { ...enemy, hp: 1_000_000, primaryDamage: 1, secondaryDamage: 1, tertiaryDamage: 1, specialDamage: 1 };
  const moves = Array.from({ length: 30 }, () => "primary" as const);

  const result = replayBattle(0, moves, durablePlayer, durableEnemy);

  assert.equal(result.turns, 30);
  assert.equal(result.winner, "player");
});
