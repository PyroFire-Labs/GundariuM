export interface FrameSkin {
  id: string;
  name: string;
  description: string;
  category: "faction" | "elite";
  preview: string;
}

export interface Decal {
  id: string;
  name: string;
  description: string;
  category: "faction" | "battle" | "custom";
  preview: string;
}

export interface RepaintStyle {
  id: number;
  name: string;
  description: string;
  category: "weathering" | "tactical" | "fantasy";
  prompt: string;
}

export const FRAME_SKINS: FrameSkin[] = [
  {
    id: "base",
    name: "GundariuM Standard",
    description: "The default HUD frame",
    category: "faction",
    preview: "#00d4ff",
  },
  {
    id: "zeon",
    name: "Zeon Crimson",
    description: "Principality of Zeon red frame",
    category: "faction",
    preview: "#dc2626",
  },
  {
    id: "efsf",
    name: "EFSF Blue",
    description: "Earth Federation blue frame",
    category: "faction",
    preview: "#2563eb",
  },
  {
    id: "celestial",
    name: "Celestial Being",
    description: "GN particle green frame",
    category: "faction",
    preview: "#22c55e",
  },
  {
    id: "titans",
    name: "Titans Purple",
    description: "Titans elite purple frame",
    category: "faction",
    preview: "#7c3aed",
  },
  {
    id: "chrome",
    name: "Chrome Elite",
    description: "Polished chrome finish",
    category: "elite",
    preview: "#e5e7eb",
  },
  {
    id: "holo",
    name: "Holographic",
    description: "Holographic shimmer effect",
    category: "elite",
    preview: "#f59e0b",
  },
  {
    id: "damaged",
    name: "Battle Damaged",
    description: "War-torn frame with scratches",
    category: "elite",
    preview: "#78716c",
  },
];

export const DECALS: Decal[] = [
  {
    id: "zeon-crest",
    name: "Zeon Crest",
    description: "Principality emblem",
    category: "faction",
    preview: "#dc2626",
  },
  {
    id: "efsf-star",
    name: "EFSF Star",
    description: "Federation star insignia",
    category: "faction",
    preview: "#2563eb",
  },
  {
    id: "anaheim",
    name: "Anaheim Electronics",
    description: "AE corporate logo",
    category: "faction",
    preview: "#94a3b8",
  },
  {
    id: "ace-badge",
    name: "Ace Pilot",
    description: "5-kill ace badge",
    category: "battle",
    preview: "#f59e0b",
  },
  {
    id: "kill-tally",
    name: "Kill Tally",
    description: "Sortie count marks",
    category: "battle",
    preview: "#ef4444",
  },
  {
    id: "campaign",
    name: "Campaign Ribbon",
    description: "Operation veteran ribbon",
    category: "battle",
    preview: "#22c55e",
  },
];

export const REPAINT_STYLES: RepaintStyle[] = [
  {
    id: 1,
    name: "Desert Storm",
    description: "Sand-blasted weathering with dust accumulation",
    category: "weathering",
    prompt:
      "Apply a desert storm weathering effect to this Gunpla model. Sand-blasted, faded paint with dust accumulation.",
  },
  {
    id: 2,
    name: "Arctic Ops",
    description: "Ice-white camouflage with frost damage",
    category: "weathering",
    prompt:
      "Apply arctic ops weathering to this Gunpla model. Ice-white camouflage with frost damage and cold-cracked paint.",
  },
  {
    id: 3,
    name: "Battle Scarred",
    description: "Heavy combat damage with deep scratches and burns",
    category: "weathering",
    prompt:
      "Apply heavy battle scarring to this Gunpla model. Deep scratches, scorch marks, and dented armor plating from intense combat.",
  },
  {
    id: 4,
    name: "Deep Space Corroded",
    description: "Oxidized plating from prolonged vacuum exposure",
    category: "weathering",
    prompt:
      "Apply deep space corrosion to this Gunpla model. Oxidized plating, micro-meteorite pitting, and vacuum-bleached paint from prolonged space exposure.",
  },
  {
    id: 5,
    name: "Urban Camo",
    description: "Grey-and-black urban camouflage pattern",
    category: "tactical",
    prompt:
      "Repaint this Gunpla model in urban camouflage. Grey, black, and dark concrete tones in angular geometric patterns.",
  },
  {
    id: 6,
    name: "Forest Camo",
    description: "Green-and-brown jungle camouflage pattern",
    category: "tactical",
    prompt:
      "Repaint this Gunpla model in forest camouflage. Deep greens, browns, and earth tones in organic irregular patterns.",
  },
  {
    id: 7,
    name: "Stealth Black",
    description: "Matte radar-absorbing black coating",
    category: "tactical",
    prompt:
      "Repaint this Gunpla model in stealth matte black. Flat radar-absorbing surface with minimal light reflection and dark panel lines.",
  },
  {
    id: 8,
    name: "Titan Chrome",
    description: "Mirror-polished chrome tactical finish",
    category: "tactical",
    prompt:
      "Repaint this Gunpla model in mirror-polished chrome. High-gloss reflective metallic surface with sharp panel line definition.",
  },
  {
    id: 9,
    name: "Neon Cyberpunk",
    description: "Dark armor with vivid neon accent lighting",
    category: "fantasy",
    prompt:
      "Repaint this Gunpla model in a neon cyberpunk style. Matte dark armor with vivid neon pink, cyan, and purple accent lines and glowing joint segments.",
  },
  {
    id: 10,
    name: "Blood Red Ace",
    description: "Deep crimson finish with gold trim — the speed of three",
    category: "fantasy",
    prompt:
      "Repaint this Gunpla model in blood red ace colors. Deep crimson primary armor with gold trim accents and black secondary panels.",
  },
  {
    id: 11,
    name: "Ghost White",
    description: "Ethereal pearl white with translucent blue shading",
    category: "fantasy",
    prompt:
      "Repaint this Gunpla model in ghost white. Pearlescent white primary armor with translucent blue shading in recessed areas and subtle iridescent highlights.",
  },
  {
    id: 12,
    name: "Gold Plated",
    description: "Ceremonial gold plating with black detail work",
    category: "fantasy",
    prompt:
      "Repaint this Gunpla model in ceremonial gold plating. Rich metallic gold primary armor with deep black panel lines and detail work.",
  },
];

export const COSMETIC_PRICE = 0.5; // $0.50 USDC
export const REPAINT_PRICE = 2.0; // $2.00 USDC
