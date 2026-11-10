import assert from "node:assert/strict";
import test from "node:test";

import { toFrameStats } from "./frameStats.ts";

const traits = {
  name: "Aegis",
  series: "UC",
  faction: "EFSF",
  rarity: "Rare",
  hp: 600,
  pilotName: "Josh",
  armorType: "Gundanium",
  primaryWeapon: "Rifle",
  primaryDamage: 100,
  secondaryWeapon: "Saber",
  secondaryDamage: 120,
  tertiaryWeapon: "Funnels",
  tertiaryDamage: 80,
  specialAttack: "Overdrive",
  specialDamage: 300,
} as const;

test("toFrameStats exposes all four typed moves and a lossless battle card", () => {
  const result = toFrameStats(traits, 42n);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.moves.map((move) => [move.type, move.name, move.power]), [
    ["primary", "Rifle", 100], ["secondary", "Saber", 120],
    ["tertiary", "Funnels", 80], ["special", "Overdrive", 300],
  ]);
  assert.deepEqual(result.value.battleCard, {
    name: "Aegis", hp: 600, armorType: "Gundanium", primaryWeapon: "Rifle", primaryDamage: 100,
    secondaryWeapon: "Saber", secondaryDamage: 120, tertiaryWeapon: "Funnels", tertiaryDamage: 80,
    specialAttack: "Overdrive", specialDamage: 300,
  });
});

test("toFrameStats rejects non-positive stats, blank weapons, and missing special data", () => {
  for (const invalid of [
    { ...traits, hp: 0 }, { ...traits, primaryDamage: -1 }, { ...traits, secondaryWeapon: "  " },
    { ...traits, specialAttack: "" }, { ...traits, specialDamage: 0 },
  ]) {
    const result = toFrameStats(invalid);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error.message, /required|positive/i);
  }
});
