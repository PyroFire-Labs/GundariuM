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

// Terms with no plausible legitimate substring overlap — checked against a
// normalized (letters-only, lowercased) form so spacing / hyphen / digit
// evasion still gets caught ("f u c k", "f-u-c-k", "fu5ck" all normalize to
// "fuck").
const BLOCKED_UNAMBIGUOUS: readonly string[] = [
  // Profanity
  "fuck", "shit", "bitch", "cunt", "pussy", "asshole", "bastard", "whore", "slut",
  // Racial / ethnic slurs
  "nigger", "nigga", "chink", "kike", "wetback", "gook", "raghead", "towelhead", "beaner",
  // Antisemitic / Nazi-glorifying
  "hitler", "sieghei", "kkk", "jewboy",
  // Homophobic / transphobic
  "faggot", "tranny",
  // Sexual violence
  "molest",
];

// Terms that are substrings of legitimate words ("ashkenazi" contains "nazi",
// "drape" contains "rape", "spicy" contains "spic", "cocktail" contains
// "cock", "pedometer" contains "pedo"). Enforced with word-boundary regex on
// the original lowercased string so real-word usage passes but the slur
// standing alone is blocked.
const BLOCKED_AMBIGUOUS: readonly string[] = [
  "cock", "spic", "nazi", "rape", "pedo",
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function containsBlockedContent(name: string): boolean {
  const lower = name.toLowerCase();
  const normalized = normalize(lower);
  for (const word of BLOCKED_UNAMBIGUOUS) {
    if (normalized.includes(word)) return true;
  }
  for (const word of BLOCKED_AMBIGUOUS) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return true;
  }
  return false;
}

/**
 * Strict client-side validator for user-typed names.
 * Enforces ASCII-only, 32-char cap, no "gundam", no offensive content.
 */
export function validateCustomName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 32) return "Name must be 32 characters or less.";
  if (!ALLOWED_CHARS.test(trimmed)) {
    return "Letters, numbers, spaces, and hyphens only.";
  }
  const normalized = normalize(trimmed);
  if (normalized.includes("gundam")) {
    return "Name cannot include that word.";
  }
  if (containsBlockedContent(trimmed)) {
    return "Name contains language not permitted.";
  }
  return null;
}

/**
 * Content-only server-side gate. Accepts unicode (the \u03A9 symbol in the
 * Legendary pool must pass) but still blocks "gundam" and offensive terms in
 * case a client somehow submits a name that bypassed the strict form check.
 */
export function validateNameContent(name: string): string | null {
  if (!name || name.trim().length === 0) return "Name required";
  if (name.length > 64) return "Name too long";
  const normalized = normalize(name);
  if (normalized.includes("gundam")) return "Invalid name";
  if (containsBlockedContent(name)) return "Invalid name";
  return null;
}
