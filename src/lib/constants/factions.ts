export type FactionKey =
  | "EFSF"
  | "ZEON"
  | "TITANS"
  | "AEUG"
  | "NEO_ZEON"
  | "MAFTY"
  | "GQUUUUUUX"
  | "ZAFT"
  | "ALLIANCE"
  | "ORB"
  | "ASTRAY"
  | "OZ"
  | "GUNDAM_WING_TEAM"
  | "CELESTIAL_BEING"
  | "HUMAN_REFORM_LEAGUE"
  | "INNOVATION"
  | "TEKKADAN"
  | "GJALLARHORN"
  | "AD_STELLA"
  | "G_NATIONS"
  | "VAGAN"
  | "AGE_WOLF"
  | "G_SELF"
  | "UNKNOWN";

export interface Faction {
  key: FactionKey;
  name: string;
  universe: string;
  color: string;
  description: string;
}

export const FACTIONS: Record<FactionKey, Faction> = {
  EFSF: {
    key: "EFSF",
    name: "Earth Federation Space Force",
    universe: "Universal Century",
    color: "#3b82f6",
    description:
      "The military arm of the Earth Federation, defenders of humanity and order across the Universal Century timeline.",
  },
  ZEON: {
    key: "ZEON",
    name: "Principality of Zeon",
    universe: "Universal Century",
    color: "#dc2626",
    description:
      "The Spacenoid nation that declared independence from Earth and ignited the One Year War with a devastating first strike.",
  },
  TITANS: {
    key: "TITANS",
    name: "Titans",
    universe: "Universal Century (Zeta / AoZ)",
    color: "#1e293b",
    description:
      "The elite Federation task force formed to suppress Spacenoid dissent. EFSF aesthetic turned aggressive — dark colors, experimental tech, movable frames.",
  },
  AEUG: {
    key: "AEUG",
    name: "Anti-Earth Union Group",
    universe: "Universal Century (Zeta / ZZ)",
    color: "#eab308",
    description:
      "The anti-Titans rebel coalition operating high-performance prototype mobile suits — Zeta, ZZ, Hyaku Shiki, Rick Dias.",
  },
  NEO_ZEON: {
    key: "NEO_ZEON",
    name: "Neo-Zeon",
    universe: "Universal Century (CCA / UC / Hathaway)",
    color: "#7f1d1d",
    description:
      "The evolution of Zeon under Char and later remnant factions like the Sleeves. Massive, ornate suits packed with Psycommu and Funnel tech.",
  },
  MAFTY: {
    key: "MAFTY",
    name: "Mafty",
    universe: "Universal Century (Hathaway's Flash)",
    color: "#fb923c",
    description:
      "Hathaway Noa's anti-Federation insurgency. Late-UC pinnacle suits with massive Minovsky Flight Craft armor — Xi Gundam, Penelope, Messer.",
  },
  GQUUUUUUX: {
    key: "GQUUUUUUX",
    name: "GQuuuuuuX Era",
    universe: "Universal Century (Alt — post Zeta/ZZ, pre-Unicorn)",
    color: "#a78bfa",
    description:
      "Alternate Universal Century timeline mobile suits operating in the era between the Gryps Conflict and the Laplace Incident.",
  },
  ZAFT: {
    key: "ZAFT",
    name: "Zodiac Alliance of Freedom Treaty",
    universe: "Cosmic Era",
    color: "#16a34a",
    description:
      "The military force of the PLANTs, comprised entirely of Coordinators fighting for independence. High-tech modular suits with Wizard Packs and DRAGOON systems.",
  },
  ALLIANCE: {
    key: "ALLIANCE",
    name: "Earth Alliance / OMNI Enforcer",
    universe: "Cosmic Era",
    color: "#1d4ed8",
    description:
      "The Atlantic Federation-led coalition wielding stolen and reverse-engineered Gundam tech. Striker Pack modular weapons platform.",
  },
  ORB: {
    key: "ORB",
    name: "United Emirates of Orb",
    universe: "Cosmic Era",
    color: "#fbbf24",
    description:
      "The neutral island nation of Orb. High-mobility refined suits — M1 Astray mass production, Akatsuki royal guard.",
  },
  ASTRAY: {
    key: "ASTRAY",
    name: "Astray Pilots",
    universe: "Cosmic Era",
    color: "#ef4444",
    description:
      "Independent operators of the prototype Astray Frames — Junk Guild, mercenary teams, the Sahaku family. Red Frame, Blue Frame, Gold Frame.",
  },
  OZ: {
    key: "OZ",
    name: "Organization of the Zodiac",
    universe: "After Colony",
    color: "#7c3aed",
    description:
      "The clandestine mobile suit corps within the United Earth Sphere Alliance. Knight-like aesthetic — Tallgeese, Leo, Aries, Mercurius, Vayeate.",
  },
  GUNDAM_WING_TEAM: {
    key: "GUNDAM_WING_TEAM",
    name: "Operation Meteor",
    universe: "After Colony",
    color: "#e5e7eb",
    description:
      "The five young Gundam pilots sent from the colonies to wage war against OZ — Wing Zero, Deathscythe Hell, Heavyarms, Sandrock, Altron.",
  },
  CELESTIAL_BEING: {
    key: "CELESTIAL_BEING",
    name: "Celestial Being",
    universe: "Anno Domini",
    color: "#f59e0b",
    description:
      "Private armed organization eradicating war through GN-Drive powered Gundams — Exia, Dynames, Kyrios, Virtue, 00 Raiser.",
  },
  HUMAN_REFORM_LEAGUE: {
    key: "HUMAN_REFORM_LEAGUE",
    name: "Human Reform League",
    universe: "Anno Domini",
    color: "#0891b2",
    description:
      "Asian-led power bloc with heavy-tank doctrine. Tieren-line mobile suits — squat, durable, physical-weapon focused.",
  },
  INNOVATION: {
    key: "INNOVATION",
    name: "Innovators",
    universe: "Anno Domini",
    color: "#a855f7",
    description:
      "Ribbons Almark's Innovades operating sleek, predatory GN-Drive Tau suits — Reborns Gundam, Gadessa, Garazzo, Empruss.",
  },
  TEKKADAN: {
    key: "TEKKADAN",
    name: "Tekkadan",
    universe: "Post-Disaster",
    color: "#f97316",
    description:
      "Iron-Blooded Orphans private military. Brutal physical-combat aesthetic — exposed Ahab Reactor frames, maces, pile bunkers, smoothbore cannons.",
  },
  GJALLARHORN: {
    key: "GJALLARHORN",
    name: "Gjallarhorn",
    universe: "Post-Disaster",
    color: "#15803d",
    description:
      "The military authority governing Post-Disaster Earth Sphere. Regal knight aesthetic with halberds, battle blades, and the dread Dainsleif.",
  },
  AD_STELLA: {
    key: "AD_STELLA",
    name: "Ad Stella (Witch from Mercury)",
    universe: "Ad Stella",
    color: "#14b8a6",
    description:
      "The Benerit Group conglomerate era. Permet-tech suits with glowing faceplates and GUND-Bit weapons — Aerial, Calibarn, Pharact.",
  },
  G_NATIONS: {
    key: "G_NATIONS",
    name: "Gundam Fight Nations",
    universe: "Future Century",
    color: "#facc15",
    description:
      "G-Gundam national champions. Themed combat suits in vibrant national colors — God Gundam, Master Gundam, Shining, Burning Gundam.",
  },
  VAGAN: {
    key: "VAGAN",
    name: "Vagan",
    universe: "Advanced Generation",
    color: "#7e22ce",
    description:
      "The Mars-exiled offshoot of humanity. Reptilian, alien-looking suits with tail-mounted weapons and integrated head cannons.",
  },
  AGE_WOLF: {
    key: "AGE_WOLF",
    name: "Federation Wolf Squad",
    universe: "Advanced Generation",
    color: "#cbd5e1",
    description:
      "Earth Federation Forces high-mobility wolf-style elite suits — G-Bouncer, G-Exes. Sleek visors, DODS Rifle spiral-beam tech.",
  },
  G_SELF: {
    key: "G_SELF",
    name: "G-Self / Amerian Army",
    universe: "Regild Century",
    color: "#bef264",
    description:
      "Reconguista in G aesthetic — soft curves, translucent armor, Photon-tech weapons and reflector packs. G-Self, G-Arcane, Grimoire.",
  },
  UNKNOWN: {
    key: "UNKNOWN",
    name: "Unknown Faction",
    universe: "Unknown",
    color: "#6b7280",
    description: "Faction affiliation unknown — fully randomized roll across all universes.",
  },
};

export const FACTION_KEYS = Object.keys(FACTIONS) as FactionKey[];
