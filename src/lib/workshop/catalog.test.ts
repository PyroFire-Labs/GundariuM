import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkshopFrame, toggleSavedFrame, type GalleryCard } from "./catalog.ts";

const cards: GalleryCard[] = [
  { id: 6, image: "/gallery/token-6.png", name: "GNY-508 Gundam", series: "GundariuM Genesis", faction: "EFSF", rarity: "Legendary", hp: 1156, armorType: "Standard", primaryWeapon: "Ship-Cutting Sword", primaryDamage: 180, secondaryWeapon: "Vulcan Pod", secondaryDamage: 372, tertiaryWeapon: "Binder Beam Gun", tertiaryDamage: 92, specialAttack: "Limit Break", specialDamage: 722 },
  { id: 11, image: "/gallery/token-11.png", name: "CB-512 Gundam", series: "GundariuM Genesis", faction: "CELESTIAL_BEING", rarity: "Legendary", hp: 1293, armorType: "GN Particle", primaryWeapon: "Mega Launcher", primaryDamage: 280, secondaryWeapon: "Beam Saber", secondaryDamage: 385, tertiaryWeapon: "Binder Beam Gun", tertiaryDamage: 189, specialAttack: "Trans-Am Overdrive", specialDamage: 846 },
  { id: 15, image: "/gallery/token-15.png", name: "ASW-G-415 Gundam", series: "GundariuM Genesis", faction: "GJALLARHORN", rarity: "Legendary", hp: 1073, armorType: "Standard", primaryWeapon: "Pile Bunker", primaryDamage: 260, secondaryWeapon: "Sub-Arm Knife", secondaryDamage: 350, tertiaryWeapon: "Head Vulcan", tertiaryDamage: 106, specialAttack: "Brutal Overdrive Strike", specialDamage: 757 },
  { id: 17, image: "/gallery/token-17.png", name: "White Knight", series: "GundariuM Genesis", faction: "AGE_WOLF", rarity: "Ω GundariuM", hp: 1216, armorType: "Standard", primaryWeapon: "Beam Rifle", primaryDamage: 300, secondaryWeapon: "Beam Saber", secondaryDamage: 321, tertiaryWeapon: "Chest Vulcan", tertiaryDamage: 122, specialAttack: "Limit Break", specialDamage: 819 },
  { id: 18, image: "/gallery/token-18.png", name: "Ω Valkyrie-Frame", series: "GundariuM Genesis", faction: "AEUG", rarity: "Ω GundariuM", hp: 1121, armorType: "GN Particle", primaryWeapon: "Beam Cannon", primaryDamage: 259, secondaryWeapon: "Beam Saber", secondaryDamage: 288, tertiaryWeapon: "Funnel Beam", tertiaryDamage: 142, specialAttack: "Trans-Am Overdrive", specialDamage: 708 },
];

test("buildWorkshopFrame gives every catalog frame six stable assemblies", () => {
  for (const card of cards) {
    const frame = buildWorkshopFrame(card);
    assert.equal(frame.id, card.id);
    assert.deepEqual(frame.assemblies.map((assembly) => assembly.id), [
      "head-optics", "reactor-armor", "arms-shields", "leg-drives", "flight-pack", "primary-weapon",
    ]);
    assert.equal(frame.assemblies.length, 6);
  }
});

test("buildWorkshopFrame keeps selected assembly details with the selected card", () => {
  const frame = buildWorkshopFrame(cards[1]);
  const reactor = frame.assemblies.find((assembly) => assembly.id === "reactor-armor");

  assert.deepEqual(reactor, {
    id: "reactor-armor",
    index: "02",
    title: "Reactor & armor",
    detail: "GN Particle armor / CB-512 Gundam core",
    status: "SIMULATED",
  });
  assert.deepEqual(frame.stats, [
    { label: "SIM HP", value: 1293 },
    { label: "POWER", value: 1700 },
    { label: "MASS U", value: 74 },
  ]);
});

test("buildWorkshopFrame supplies explicit fallback labels for blank optional display inputs", () => {
  const frame = buildWorkshopFrame({ ...cards[0], faction: "", series: "", tertiaryWeapon: "" });

  assert.match(frame.assemblies[0].detail, /Unspecified faction/i);
  assert.match(frame.assemblies[3].detail, /Unspecified series/i);
  assert.match(frame.assemblies[4].detail, /Unspecified flight system/i);
});

test("toggleSavedFrame adds and removes only the selected local frame", () => {
  const saved = toggleSavedFrame(new Set([6]), 11);

  assert.deepEqual([...saved].sort((a, b) => a - b), [6, 11]);
  assert.deepEqual([...toggleSavedFrame(saved, 11)], [6]);
  assert.deepEqual([...saved].sort((a, b) => a - b), [6, 11]);
});
