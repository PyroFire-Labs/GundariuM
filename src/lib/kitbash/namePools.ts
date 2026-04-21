import type { Rarity } from "@/types/nft";

export const NAME_POOLS: Record<Rarity, readonly string[]> = {
  Common: [
    "Aegis-Titan",
    "Gundar-Vanguard Type-0",
    "Lunar-Alloy Breacher",
    "Obsidian Strider",
  ],
  Uncommon: [
    "Titanium Vanguard",
    "Obsidian-Frame",
    "Lunar-Alloy MK-II",
    "Gundar Sentinel",
  ],
  Rare: [
    "Apex-Centurion",
    "Sovereign-Frame",
    "Exalted-Gundar",
    "Nova-Alloy Harbinger",
  ],
  "Ultra Rare": [
    "Zenith-Class Striker",
    "Apex Sovereign Ver.Z",
    "Nova-Alloy Vanguard",
    "Exalted-Gundar Type-II",
  ],
  Legendary: [
    "\u03A9 Iron-Duke",
    "\u03A9 Paladin-Gundar",
    "\u03A9 Ronin-Frame",
    "\u03A9 Dreadnaught-Alloy",
    "\u03A9 Valkyrie-Frame",
  ],
};

export function pickFallbackName(rarity: Rarity): string {
  const pool = NAME_POOLS[rarity];
  return pool[Math.floor(Math.random() * pool.length)];
}

const ALLOWED_CHARS = /^[a-zA-Z0-9\- ]+$/;
const BLOCKED_SUBSTRING = /gundam/i;

export function validateCustomName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 32) return "Name must be 32 characters or less.";
  if (!ALLOWED_CHARS.test(trimmed)) {
    return "Letters, numbers, spaces, and hyphens only.";
  }
  if (BLOCKED_SUBSTRING.test(trimmed)) {
    return "Name cannot include that word.";
  }
  return null;
}
