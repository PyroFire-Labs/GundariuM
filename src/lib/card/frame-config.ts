import type { Rarity } from "@/types/nft";

// ─── Card Dimensions ─────────────────────────────────────────────────────────

export const CARD_WIDTH = 600;
export const CARD_HEIGHT = 900;

export const PHOTO_PADDING = 24;
export const NAMEPLATE_HEIGHT = 120;
export const HEADER_HEIGHT = 40;

export const PHOTO_X = PHOTO_PADDING;
export const PHOTO_Y = PHOTO_PADDING + HEADER_HEIGHT;
export const PHOTO_WIDTH = CARD_WIDTH - PHOTO_PADDING * 2;
export const PHOTO_HEIGHT =
  CARD_HEIGHT - PHOTO_PADDING * 2 - HEADER_HEIGHT - NAMEPLATE_HEIGHT;

// ─── Rarity Palettes ─────────────────────────────────────────────────────────

export interface RarityPalette {
  primary: string;
  secondary: string;
  glow: string;
  text: string;
  background: string;
}

export const RARITY_PALETTES: Record<Rarity, RarityPalette> = {
  Common: {
    primary: "#9ca3af",
    secondary: "#6b7280",
    glow: "rgba(156,163,175,0.5)",
    text: "#e5e7eb",
    background: "#1f2937",
  },
  Uncommon: {
    primary: "#22c55e",
    secondary: "#16a34a",
    glow: "rgba(34,197,94,0.5)",
    text: "#dcfce7",
    background: "#14532d",
  },
  Rare: {
    primary: "#3b82f6",
    secondary: "#2563eb",
    glow: "rgba(59,130,246,0.5)",
    text: "#dbeafe",
    background: "#1e3a5f",
  },
  "Ultra Rare": {
    primary: "#a855f7",
    secondary: "#9333ea",
    glow: "rgba(168,85,247,0.5)",
    text: "#f3e8ff",
    background: "#3b0764",
  },
  Legendary: {
    primary: "#f59e0b",
    secondary: "#d97706",
    glow: "rgba(245,158,11,0.5)",
    text: "#fef3c7",
    background: "#451a03",
  },
};

// ─── Frame Element Constants ──────────────────────────────────────────────────

export const BRACKET_SIZE = 30;
export const BRACKET_THICKNESS = 2;
export const RETICLE_RADIUS = 40;
export const HEX_SIZE = 16;
export const BORDER_WIDTH = 3;
