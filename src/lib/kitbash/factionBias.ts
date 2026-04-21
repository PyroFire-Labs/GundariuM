import type { FactionKey } from "@/lib/constants/factions";

export interface FactionBias {
  /** Allowed head trait names (must exist in TRAIT_TABLES.head). */
  allowedHeads: readonly string[];
  /** Allowed primary weapon trait names. */
  allowedWeapons: readonly string[];
  /** Allowed backpack trait names. */
  allowedBackpacks: readonly string[];
  /** Optional frame-type bias. Omit for no restriction. */
  allowedFrames?: readonly string[];
  /** Optional special bias (e.g. Trans-Am for Celestial Being). */
  allowedSpecial?: readonly string[];
  /** Allowed colorway names. */
  colorways: readonly string[];
  /** Mobile suit name prefixes. */
  namePrefixes: readonly string[];
  /** One-line aesthetic description for the AI prompt. */
  designLanguage: string;
  /** Explicit "do not render" instructions for the AI prompt. */
  forbiddenInfluences: string;
  /** Comma-separated reference suits the model should recognize. */
  referenceSuits: string;
}

/**
 * Per-faction trait pools and prompt context. Sourced from Joshua's
 * canon tables, mapped to the trait names defined in TRAIT_TABLES.
 * Faction names that don't appear here (i.e. UNKNOWN) get the full
 * unfiltered TRAIT_TABLES roll.
 */
export const FACTION_BIAS: Record<Exclude<FactionKey, "UNKNOWN">, FactionBias> = {
  EFSF: {
    allowedHeads: [
      "Classic V-Fin",
      "Visor Type",
      "Antenna Array",
      "Twin Horn",
      "Multi-Sensor",
      "Multi-Sensor Array",
    ],
    allowedWeapons: [
      "Beam Rifle",
      "Beam Saber (dual)",
      "Beam Cannon",
      "Mega Launcher",
      "Bazooka",
      "Machine Gun",
      "Gatling Gun",
      "Beam Magnum",
    ],
    allowedBackpacks: [
      "Standard Thruster Pack",
      "Heavy Arms Rack",
      "Booster Pod",
      "Wing Binders",
      "Flight Unit",
      "Psychoframe Emitter",
      "Movable Frame Thrusters",
    ],
    colorways: ["Federation White & Blue", "Arctic White & Silver"],
    namePrefixes: ["RX", "RGM", "RGZ", "MSZ", "FA", "GP"],
    designLanguage:
      "Earth Federation aesthetic — rounded blocky armor, twin-eye visor heads on Gundams, white/blue/red color schemes. RX-78 Gundam lineage, prototype hero suits and mass-produced GM/Jegan grunts.",
    forbiddenInfluences:
      "NO mono-eye Zaku-derivative silhouettes. NO Heat Hawk axe. NO GN-particle aesthetics or GN Drives. NO funnel weapons. NO Cosmic Era Striker Pack hardpoints.",
    referenceSuits: "RX-78-2 Gundam, GM, Nu Gundam, Unicorn Gundam, Jegan, Jesta",
  },

  ZEON: {
    allowedHeads: [
      "Mono-Eye",
      "Commander Horn",
      "Gas-Mask Intake",
      "Crown Crest",
      "Multi-Sensor",
    ],
    allowedWeapons: [
      "Heat Hawk",
      "Heat Sword",
      "Beam Naginata",
      "Bazooka",
      "Machine Gun",
      "Beam Rifle",
      "Beam Saber (dual)",
    ],
    allowedBackpacks: [
      "Standard Thruster Pack",
      "Booster Pod",
      "Heavy Arms Rack",
      "Psychoframe Emitter",
      "Funnel System",
    ],
    colorways: [
      "Zeon Army Green",
      "Char Red",
      "Desert Tan & Brown",
      "Phantom Midnight Blue",
    ],
    namePrefixes: ["MS", "MSN", "AMX", "YMS"],
    designLanguage:
      "Principality of Zeon aesthetic — organic curved armor, mono-eye sensor heads, gas-mask intakes, spiked shoulder armor. Universal Century antagonist suits with melee-axe combat doctrine.",
    forbiddenInfluences:
      "NO Earth Federation V-fin Gundam heads. NO twin-eye visors. NO GN-particle aesthetics. NO Cosmic Era Striker Packs. NO Wing Binders or winged flight units.",
    referenceSuits: "MS-06 Zaku II, MS-09 Dom, MSN-04 Sazabi, MSN-02 Zeong, AMS-119 Geara Doga",
  },

  TITANS: {
    allowedHeads: [
      "Visor Type",
      "Classic V-Fin",
      "Rabbit-Ear Sensors",
      "Twin Horn",
      "Multi-Sensor",
    ],
    allowedWeapons: [
      "Beam Rifle",
      "Long Blade Rifle",
      "Beam Saber (dual)",
      "Bazooka",
      "Beam Magnum",
      "Beam Cannon",
    ],
    allowedBackpacks: [
      "Shield Booster (Stackable)",
      "Movable Frame Thrusters",
      "Booster Pod",
      "Wing Binders",
      "Standard Thruster Pack",
    ],
    colorways: [
      "Titans Navy Blue",
      "Phantom Midnight Blue",
      "Shadow Black & Gold",
    ],
    namePrefixes: ["RX", "RMS", "ORX", "RX-121"],
    designLanguage:
      "Titans aesthetic — Federation V-fin Gundam silhouette but in dark navy/black with aggressive movable-frame angles. AoZ experimental hardware (Shield Boosters, Hrududu support). Gundam Mk-II / Hazel / Barzam lineage.",
    forbiddenInfluences:
      "NO ZAKU mono-eye head. NO GN-particle aesthetics. NO Wing Gundam blade-antenna. NO Tekkadan exposed-frame look.",
    referenceSuits: "RX-178 Gundam Mk-II, RMS-106 Hizack, RX-121 Hazel Custom, RX-110 Gabthley, ORX-005 Gaplant",
  },

  AEUG: {
    allowedHeads: [
      "Classic V-Fin",
      "Twin Horn",
      "Rick Dias Hockey Mask",
      "Multi-Sensor Array",
    ],
    allowedWeapons: [
      "Beam Rifle",
      "Mega Bazooka Launcher",
      "Beam Saber (dual)",
      "Beam Cannon",
      "Beam Magnum",
    ],
    allowedBackpacks: [
      "Wing Binders",
      "Flight Unit",
      "Standard Thruster Pack",
      "Movable Frame Thrusters",
      "Booster Pod",
    ],
    colorways: [
      "AEUG Dark Blue & Red",
      "Federation White & Blue",
      "Hyaku Shiki Gold",
    ],
    namePrefixes: ["MSZ", "MSA", "MSN"],
    designLanguage:
      "AEUG aesthetic — high-performance UC prototype with classic Gundam silhouette and movable transformation frame. Zeta/ZZ era hero suits, Hyaku Shiki gold accents, Rick Dias hockey-mask rebel aesthetic.",
    forbiddenInfluences:
      "NO mono-eye unless captured Zeon unit. NO GN-particle aesthetics. NO Tekkadan exposed-frame brutality. NO Cosmic Era Striker Packs.",
    referenceSuits: "MSZ-006 Zeta Gundam, MSZ-010 ZZ Gundam, MSN-00100 Hyaku Shiki, RMS-099 Rick Dias",
  },

  NEO_ZEON: {
    allowedHeads: [
      "Mono-Eye",
      "Commander Horn",
      "Crown Crest",
      "Twin Horn",
    ],
    allowedWeapons: [
      "Funnel Bits",
      "Beam Shotrifle",
      "Beam Cannon",
      "Beam Naginata",
      "Beam Magnum",
    ],
    allowedBackpacks: [
      "Funnel System",
      "Funnel Rack",
      "Wing Binders",
      "Heavy Arms Rack",
      "Psychoframe Emitter",
    ],
    colorways: [
      "Neo Zeon Crimson",
      "OZ Royal Purple",
      "Phantom Midnight Blue",
    ],
    namePrefixes: ["AMX", "MSN", "NZ"],
    designLanguage:
      "Neo-Zeon aesthetic — massive ornate Zeon-evolution suits with Psycommu Funnel weapons, Sleeves engravings, royal-crimson and gold trim. Char's Counterattack / Unicorn / Hathaway-era flagship suits.",
    forbiddenInfluences:
      "NO Earth Federation V-fin Gundam heads. NO Cosmic Era hardpoints. NO physical mace weapons. NO Striker Packs.",
    referenceSuits: "MSN-04 Sazabi, AMX-004 Qubeley, NZ-666 Kshatriya, MSN-06S Sinanju",
  },

  MAFTY: {
    allowedHeads: [
      "Classic V-Fin",
      "Mono-Eye",
      "Crown Crest",
      "Multi-Sensor Array",
    ],
    allowedWeapons: [
      "Beam Rifle",
      "Beam Cannon",
      "Funnel Bits",
      "Mega Launcher",
      "Beam Magnum",
    ],
    allowedBackpacks: [
      "Minovsky Flight Craft",
      "Standard Thruster Pack",
      "Wing Binders",
      "Movable Frame Thrusters",
    ],
    colorways: [
      "Mafty Pale Orange & White",
      "Phantom Midnight Blue",
      "Arctic White & Silver",
    ],
    namePrefixes: ["RX", "Me02R", "OMS", "Ξ"],
    designLanguage:
      "Mafty / late-UC aesthetic — massive Minovsky-Flight Craft suits with pointed shoulder/back armor, sleek high-output silhouettes. Hathaway's Flash era pinnacle UC tech.",
    forbiddenInfluences:
      "NO ZAKU silhouettes. NO Tekkadan brutality. NO GN-particle aesthetics. NO Cosmic Era Striker Packs.",
    referenceSuits: "RX-105 Ξ (Xi) Gundam, RX-104FF Penelope, Me02R Messer",
  },

  GQUUUUUUX: {
    allowedHeads: [
      "Classic V-Fin",
      "Mono-Eye",
      "Twin Horn",
      "Multi-Sensor Array",
      "Blade Antenna",
    ],
    allowedWeapons: [
      "Beam Rifle",
      "Beam Saber (dual)",
      "Beam Magnum",
      "Beam Naginata",
      "Heat Hawk",
    ],
    allowedBackpacks: [
      "Movable Frame Thrusters",
      "Wing Binders",
      "Standard Thruster Pack",
      "Funnel System",
      "Psychoframe Emitter",
    ],
    colorways: [
      "Arctic White & Silver",
      "Neo Zeon Crimson",
      "Phantom Midnight Blue",
      "Stealth Black & Purple",
    ],
    namePrefixes: ["MSZ", "RX", "AMX", "GQX", "EVA-MS"],
    designLanguage:
      "GQuuuuuuX aesthetic — Yoshiyuki Sadamoto's biomechanical Evangelion-coded mobile suit redesigns set in an alternate Universal Century timeline (post Zeta/ZZ, pre-Unicorn). The suits feel ALIVE rather than mechanical: asymmetric armor plating, exposed spinal cabling running along the back, organic curves wrapped over hard mecha geometry, monstrous-yet-humanoid proportions (taller, leaner, slightly off-balance). Eyes glow with an unsettling lifelike quality. Restrained palette — bone white with crimson exposed cabling, or muted dark navy with gold accents, or stealth black with purple highlights. Think Evangelion Unit 01 / Unit 00 / Unit 02 design language applied to Universal Century mobile suits, NOT a clean Federation Gundam.",
    forbiddenInfluences:
      "ABSOLUTELY DO NOT render a clean symmetric Federation RX-78 Gundam — these suits are deliberately monstrous and asymmetric. NO standard military mecha symmetry. NO clean Sunrise/Bandai cartoon proportions — these suits should feel slightly wrong, like something from Evangelion. NO Cosmic Era Striker Packs. NO GN-particle aesthetics. NO Post-Disaster Tekkadan brutality. NO clean Wing Gundam blade-antenna heroism.",
    referenceSuits: "GQuuuuuuX (titular machine — sleek but eerily alive), Red Gundam (Char's alt-UC machine — Eva Unit 02 coded crimson silhouette), Sadamoto-redesigned MS-06 Zaku II variants (organic-curve grunt suits with mono-eye that feels like a watching eye, not a sensor). Style reference: Hideaki Anno × Yoshiyuki Sadamoto Evangelion mecha aesthetic applied to UC mobile suit silhouettes. Biomechanical horror, not clean robot fanart.",
  },

  ZAFT: {
    allowedHeads: [
      "Multi-Sensor Array",
      "Mono-Eye",
      "Knight-Crest",
      "Twin Horn",
    ],
    allowedWeapons: [
      "Beam Cannon",
      "Beam Saber (dual)",
      "Beam Rifle",
      "Heat Sword",
      "Ship-Cutting Sword",
    ],
    allowedBackpacks: [
      "Wizard Pack",
      "Wing Binders",
      "DRAGOON System",
      "Standard Thruster Pack",
    ],
    colorways: [
      "ZAFT Maroon & Grey",
      "Slate Blue & Charcoal",
      "Phantom Midnight Blue",
    ],
    namePrefixes: ["ZGMF", "TMF", "AMF"],
    designLanguage:
      "ZAFT aesthetic — Cosmic Era PLANT-built Coordinator suits with Wizard Pack modular hardpoints, sleek aggressive lines, knight-crest commander horns. ZGMF Freedom/Justice/Providence flagship lineage.",
    forbiddenInfluences:
      "NO Universal Century green Zeon palette — ZAFT uses crimson/maroon/slate. NO GN-particle aesthetics. NO Heat Hawk axe (Zeon-specific). NO Striker Packs (Earth Alliance hardware).",
    referenceSuits: "ZGMF-X10A Freedom, ZGMF-X09A Justice, ZGMF-X13A Providence, ZAFT GINN, ZAKU Warrior",
  },

  ALLIANCE: {
    allowedHeads: [
      "Twin Horn",
      "Slit Visor",
      "Antenna Array",
      "Multi-Sensor Array",
      "Visor Type",
    ],
    allowedWeapons: [
      "Beam Rifle",
      "Schwert Gewehr",
      "Agni Hyper Impulse Cannon",
      "Beam Cannon",
      "Gatling Gun",
      "Beam Saber (dual)",
    ],
    allowedBackpacks: [
      "Aile Striker Pack",
      "Sword Striker Pack",
      "Launcher Striker Pack",
      "IWSP",
      "Flight Unit",
      "Heavy Arms Rack",
    ],
    colorways: [
      "Strike White, Blue & Red",
      "Dagger Grey & Navy",
      "Slate Blue & Charcoal",
    ],
    namePrefixes: ["GAT", "TS-MA", "GAT-X"],
    designLanguage:
      "Earth Alliance / OMNI Enforcer aesthetic — Cosmic Era Striker Pack modular weapons platform, angular industrial armor, twin-camera Dagger visors. GAT-X Strike-class hero suits and Strike Dagger mass production.",
    forbiddenInfluences:
      "NO Universal Century RX-78 silhouettes. NO mono-eye heads. NO GN-Drives. NO Heat Hawk. NO Beam Naginata. NO Tekkadan exposed-frame look.",
    referenceSuits: "GAT-X105 Strike Gundam, GAT-X102 Duel, GAT-X103 Buster, 105 Dagger, Strike Dagger",
  },

  ORB: {
    allowedHeads: [
      "Classic V-Fin",
      "Antenna Array",
      "Visor Type",
      "Multi-Sensor Array",
    ],
    allowedWeapons: [
      "Beam Rifle",
      "Beam Saber (dual)",
      "Machine Gun",
      "Gatling Gun",
      "Beam Cannon",
    ],
    allowedBackpacks: [
      "Aile Striker Pack",
      "Power Cylinder",
      "Flight Unit",
      "Wing Binders",
    ],
    colorways: [
      "Astray Red & White",
      "Akatsuki Gold & Black",
      "Desert Tan & Brown",
    ],
    namePrefixes: ["MBF", "MVF", "ORB"],
    designLanguage:
      "Orb / Akatsuki aesthetic — Cosmic Era refined high-mobility suits with slim V-fins, M1 Astray mass-production lineage, royal Akatsuki gold-mirror coating.",
    forbiddenInfluences:
      "NO mono-eye heads. NO Universal Century palette. NO GN-particle aesthetics. NO Heat Hawk or Beam Naginata.",
    referenceSuits: "M1 Astray, ORB-01 Akatsuki, MBF-M1 Murasame",
  },

  ASTRAY: {
    allowedHeads: [
      "Classic V-Fin",
      "Multi-Sensor",
      "Crown Crest",
      "Antenna Array",
    ],
    allowedWeapons: [
      "Gerbera Straight Katana",
      "Beam Rifle",
      "Tactical Arms",
      "Beam Saber (dual)",
      "Heat Sword",
    ],
    allowedBackpacks: [
      "Power Cylinder",
      "Flight Unit",
      "Wing Binders",
      "Standard Thruster Pack",
    ],
    colorways: [
      "Astray Red & White",
      "Astray Blue & White",
      "Akatsuki Gold & Black",
    ],
    namePrefixes: ["MBF", "MBF-P", "ORB"],
    designLanguage:
      "Astray Frame aesthetic — Cosmic Era prototype frames operated by Junk Guild, Serpent Tail, and the Sahaku family. Exposed-circuit V-crest heads, Gerbera Straight katana, Tactical Arms multi-mode weapon platform.",
    forbiddenInfluences:
      "NO mono-eye heads. NO Universal Century silhouettes. NO GN-particle aesthetics. NO Heat Hawk. NO Striker Packs (military Alliance gear).",
    referenceSuits: "Gundam Astray Red Frame, Astray Blue Frame, Astray Gold Frame Amatsu Mina",
  },

  OZ: {
    allowedHeads: [
      "Knight's Visor",
      "Plumed Sensor",
      "Visor Type",
      "Multi-Sensor Array",
    ],
    allowedWeapons: [
      "Dober Gun",
      "Beam Saber (dual)",
      "Heat Shotel",
      "Beam Scythe",
      "Twin Buster Rifle",
      "Beam Rifle",
    ],
    allowedBackpacks: [
      "Active Cloak",
      "Booster Pod",
      "Heavy Arms Rack",
      "Standard Thruster Pack",
    ],
    colorways: [
      "OZ Royal Purple",
      "Akatsuki Gold & Black",
      "Tekkadan Dark Olive",
    ],
    namePrefixes: ["OZ", "MMS", "OZ-13MS", "OZ-00MS"],
    designLanguage:
      "OZ / Organization of the Zodiac aesthetic — After Colony knight-like elegance, Tallgeese plumed-sensor crown, sophisticated heavy armor, Leo grunt mass-production. Aristocratic white/gold or military forest green.",
    forbiddenInfluences:
      "NO mono-eye Zaku silhouettes (THIS IS THE KEY RULE — OZ Leo grunts have a sensor visor, NOT a Zaku mono-eye). NO Tekkadan beast-fin heads. NO GN-particle aesthetics. NO Cosmic Era Striker Packs. NO Universal Century V-fin Gundam silhouette unless Tallgeese.",
    referenceSuits: "OZ-00MS Tallgeese, OZ-06MS Leo, OZ-07AMS Aries, OZ-13MS Epyon, OZ-13MSX2 Mercurius/Vayeate",
  },

  GUNDAM_WING_TEAM: {
    allowedHeads: [
      "Classic V-Fin",
      "Blade Antenna",
      "Twin Horn",
      "Crown Crest",
    ],
    allowedWeapons: [
      "Twin Buster Rifle",
      "Beam Saber (dual)",
      "Beam Scythe",
      "Heat Shotel",
      "Gatling Gun",
      "Beam Cannon",
      "Beam Rifle",
    ],
    allowedBackpacks: [
      "Wing Binders",
      "Heavy Arms Rack",
      "Active Cloak",
      "Booster Pod",
      "Standard Thruster Pack",
    ],
    colorways: [
      "Federation White & Blue",
      "Shadow Black & Gold",
      "Desert Tan & Brown",
      "Astray Red & White",
    ],
    namePrefixes: ["XXXG", "GW"],
    designLanguage:
      "Operation Meteor / Gundam Pilots aesthetic — After Colony heroic blade-antenna Gundams with elaborate themed loadouts. Wing Zero feathered binders, Deathscythe scythe, Heavyarms gattling array, Sandrock dual heat shotels.",
    forbiddenInfluences:
      "NO mono-eye Zaku silhouettes. NO Cosmic Era Striker Packs. NO GN-particle aesthetics. NO Tekkadan exposed-frame look.",
    referenceSuits: "XXXG-00W0 Wing Gundam Zero, XXXG-01D2 Deathscythe Hell, XXXG-01H2 Heavyarms Custom, XXXG-01SR2 Sandrock Custom, XXXG-01S2 Altron",
  },

  CELESTIAL_BEING: {
    allowedHeads: [
      "Classic V-Fin",
      "GN Condenser Head",
      "Visor Type",
      "Twin Horn",
    ],
    allowedWeapons: [
      "GN Sword",
      "GN Sniper Rifle",
      "Beam Saber (dual)",
      "Beam Rifle",
      "Mega Launcher",
    ],
    allowedBackpacks: [
      "GN Drive (Cone)",
      "Trans-Am Booster",
      "Wing Binders",
      "Heavy Arms Rack",
      "Standard Thruster Pack",
    ],
    allowedSpecial: [
      "None",
      "Trans-Am burst (red energy aura)",
      "Battle damage (scratches, dents, scorch marks)",
      "Gold trim accents",
    ],
    colorways: [
      "Celestial Being Gunmetal & White",
      "Solar Orange & White",
      "Stealth Black & Purple",
    ],
    namePrefixes: ["GN", "GNY", "GNT", "CB", "GNR"],
    designLanguage:
      "Celestial Being aesthetic — Anno Domini GN-Drive powered Gundams with cone-shaped GN Drive on chest/back, sleek athletic frames, GN Sword cross-shaped weapons. Trans-Am red glow on activation. Exia/Dynames/00 Raiser lineage.",
    forbiddenInfluences:
      "NO mono-eye Zaku silhouettes. NO Heat Hawk. NO Bazooka or Machine Gun (CB uses GN-particle weapons exclusively). NO Universal Century silhouettes. NO Cosmic Era Striker Packs. THE GN DRIVE CONE IS THE PRIMARY VISUAL IDENTIFIER.",
    referenceSuits: "GN-001 Exia, GN-002 Dynames, GN-003 Kyrios, GN-004 Virtue, GN-0000+GNR-010 00 Raiser",
  },

  HUMAN_REFORM_LEAGUE: {
    allowedHeads: [
      "Mono-Eye",
      "Visor Type",
      "Multi-Sensor Array",
      "Guard Plate",
    ],
    allowedWeapons: [
      "Smoothbore Cannon",
      "Bazooka",
      "Machine Gun",
      "Beam Cannon",
      "Heavy Physical Blade",
    ],
    allowedBackpacks: [
      "Standard Thruster Pack",
      "Booster Pod",
      "Heavy Arms Rack",
    ],
    colorways: ["Desert Tan & Brown", "Tekkadan Dark Olive"],
    namePrefixes: ["MSJ"],
    designLanguage:
      "Human Reform League / Tieren aesthetic — Anno Domini squat heavy-tank suits with mono-lens sensor heads, blocky desert-tan armor, physical-weapon doctrine (200mm smoothbore, carbon blade). Asian-influenced military design.",
    forbiddenInfluences:
      "NO Federation V-fin Gundam silhouettes. NO twin-horn Gundam heads. NO GN Drive (Tieren is non-GN). NO Beam Saber (only high-tier Tieren Taozi has beam). NO Striker Packs. NO Wing Binders.",
    referenceSuits: "MSJ-06II Tieren Ground Type, MSJ-04 Fanton, MSJ-06II-LC Tieren Long-Range Cannon, MSJ-06II-S Tieren Taozi",
  },

  INNOVATION: {
    allowedHeads: [
      "Visor Type",
      "Crown Crest",
      "Twin Horn",
      "Multi-Sensor Array",
      "Antenna Array",
    ],
    allowedWeapons: [
      "Mega Launcher",
      "Beam Saber (dual)",
      "Beam Cannon",
      "Beam Rifle",
      "GN Sword",
    ],
    allowedBackpacks: [
      "GN Drive Tau (Flat)",
      "Funnel System",
      "DRAGOON System",
      "Wing Binders",
      "Standard Thruster Pack",
    ],
    colorways: [
      "OZ Royal Purple",
      "Shadow Black & Gold",
      "Lime Green & Silver",
    ],
    namePrefixes: ["GNZ", "CB", "GNMA"],
    designLanguage:
      "Innovators aesthetic — Anno Domini sleek predatory GN-Drive Tau suits with split faceplates, narrow visors, large beam cannon racks. Reborns Gundam / Gadessa / Garazzo lineage. Often deep purple with silver, or vibrant orange accents.",
    forbiddenInfluences:
      "NO classic Federation V-fin Gundam heads. NO mono-eye. NO Heat Hawk or physical melee weapons. NO Striker Packs. NO Beast-like Fin (Tekkadan-only).",
    referenceSuits: "CB-002 Reborns Gundam, GNZ-005 Garazzo, GNZ-003 Gadessa, GNMA-Y0002 Empruss",
  },

  TEKKADAN: {
    allowedHeads: [
      "Beast-like Fin",
      "Multi-Sensor Array",
      "Guard Plate",
      "Mono-Eye",
    ],
    allowedWeapons: [
      "Pile Bunker",
      "Battle Blade",
      "Smoothbore Cannon",
      "Heavy Physical Blade",
      "Heat Sword",
    ],
    allowedBackpacks: [
      "Ahab Reactor Thrusters",
      "Sub-Arm Rigging",
      "Heavy Arms Rack",
    ],
    colorways: [
      "Celestial Being Gunmetal & White",
      "Rusty Iron & Orange",
      "Tekkadan Dark Olive",
    ],
    namePrefixes: ["ASW-G", "UG", "STH"],
    designLanguage:
      "Tekkadan / Iron-Blooded Orphans aesthetic — Post-Disaster brutal physical-combat frames with exposed Ahab Reactor thrusters, beast-like fin head crowns, mace/pile bunker melee weapons. Barbatos/Gusion/Graze lineage. NO BEAM WEAPONS — physical only.",
    forbiddenInfluences:
      "ABSOLUTELY NO BEAM WEAPONS — no Beam Rifle, no Beam Saber, no Beam Cannon. Tekkadan tech is pre-Calamity War physical combat. NO Wing Binders. NO Funnel weapons. NO Psychoframe. NO GN Drive. NO Striker Packs.",
    referenceSuits: "ASW-G-08 Gundam Barbatos, ASW-G-11 Gundam Gusion, EB-06 Graze, ASW-G-66 Gundam Kimaris",
  },

  GJALLARHORN: {
    allowedHeads: [
      "Knight's Visor",
      "Plumed Sensor",
      "Guard Plate",
    ],
    allowedWeapons: [
      "Battle Blade",
      "Halberd",
      "Beam Cannon",
      "Pile Bunker",
      "Dainsleif Launcher",
    ],
    allowedBackpacks: [
      "Ahab Reactor Thrusters",
      "Wing Binders",
      "Standard Thruster Pack",
    ],
    colorways: [
      "OZ Royal Purple",
      "Gjallarhorn Emerald & Slate",
      "Gjallarhorn Royal Blue",
    ],
    namePrefixes: ["EB", "ASW-G"],
    designLanguage:
      "Gjallarhorn aesthetic — Post-Disaster regal knight military authority. Plumed knight visors, halberds and battle blades, royal purple/emerald livery, Kimaris-style binder thrusters. Wields the apocalyptic Dainsleif railgun.",
    forbiddenInfluences:
      "NO V-fin Gundam heads. NO mono-eye. NO Beam Rifle or Beam Saber (Post-Disaster has no beam-hand-weapons — only Dainsleif and beam cannons). NO Funnel weapons. NO GN Drive. NO Psychoframe.",
    referenceSuits: "EB-06 Graze, ASW-G-66 Gundam Kimaris Vidar, EB-05s Schwalbe Graze, ASW-G-XX Gundam Vidar",
  },

  AD_STELLA: {
    allowedHeads: [
      "Permet Shell Faceplate",
      "Classic V-Fin",
      "Multi-Sensor Array",
      "Curved V-Fin",
    ],
    allowedWeapons: [
      "GUND-Bit Stave",
      "Beam Carbine",
      "Beam Cannon",
      "Heavy Physical Blade",
    ],
    allowedBackpacks: [
      "Flight Unit",
      "Bit On-Form",
      "Wing Binders",
    ],
    colorways: [
      "Permet Teal & White",
      "Slate Blue & Charcoal",
      "Stealth Black & Purple",
    ],
    namePrefixes: ["XGF", "XVX", "FP", "MD"],
    designLanguage:
      "Ad Stella / Witch from Mercury aesthetic — Benerit Group conglomerate suits with glowing Permet-network faceplates, GUND-Bit floating remote stave weapons, sleek industrial frames with folding wing flight units.",
    forbiddenInfluences:
      "NO Universal Century silhouettes. NO mono-eye Zaku heads. NO Heat Hawk. NO GN Drive. NO DRAGOON System. NO Tekkadan exposed-frame look. NO Striker Packs.",
    referenceSuits: "XVX-016 Gundam Aerial, XVX-016RN Gundam Calibarn, FP/A-77 Gundam Pharact, MD-0032G Gundam Lfrith",
  },

  G_NATIONS: {
    allowedHeads: [
      "Crown Crest",
      "Samurai Helmet",
      "Plumed Sensor",
      "Twin Horn",
    ],
    allowedWeapons: [
      "Beam Saber (dual)",
      "Burning Finger",
      "Machine Gun",
      "Beam Cannon",
    ],
    allowedBackpacks: [
      "Core Lander",
      "Multi-Petal Binders",
      "Wing Binders",
    ],
    colorways: [
      "Vibrant Primary (G-Nations)",
      "Hyaku Shiki Gold",
      "Astray Red & White",
    ],
    namePrefixes: ["GF"],
    designLanguage:
      "G-Gundam Nations aesthetic — Future Century thematic national champion suits with culturally themed armor (samurai, knight, animal motifs), vibrant primary colors, melee-combat focus (fighting gloves, burning finger, staff). Core Lander rear-mounted cockpit-car.",
    forbiddenInfluences:
      "NO standard military visor heads. NO long-range sniper weapons. NO GN-particle aesthetics. NO Striker Packs. NO Tekkadan exposed-frame brutality.",
    referenceSuits: "GF13-017NJII God Gundam, GF13-001NHII Master Gundam, GF13-017NJ Shining Gundam, GF13-009NF Gundam Rose, GF13-006NA Gundam Maxter",
  },

  VAGAN: {
    allowedHeads: [
      "Reptilian Crown",
      "Slit Visor",
      "Multi-Sensor Array",
    ],
    allowedWeapons: [
      "Beam Cannon",
      "Beam Saber (dual)",
      "Beam Rifle",
    ],
    allowedBackpacks: [
      "Tail-Blade Thruster",
      "Wing Binders",
      "Flight Unit",
    ],
    colorways: [
      "Tekkadan Dark Olive",
      "Vagan Gold & Purple",
      "Vagan Pale Grey & Pink",
    ],
    namePrefixes: ["ovv", "xvm", "ovm"],
    designLanguage:
      "Vagan aesthetic — Advanced Generation Mars-exiled biological/alien-looking mecha with reptilian crown heads, tail-mounted weapons, integrated head cannons, bat-like flight wings. Asymmetric organic curves.",
    forbiddenInfluences:
      "NO V-fin Gundam heads. NO Visor Type heads. NO solid physical blades. NO Machine Gun. NO Hyper Bazooka. NO Wing Binders (use Bat-style wings). NO Heavy Arms Rack. NO Striker Packs.",
    referenceSuits: "xvm-zgc Ghirarga, ovv-f Gafran, xvm-zbc Zedas, xvm-fzc Gundam Legilis",
  },

  AGE_WOLF: {
    allowedHeads: [
      "Slit Visor",
      "Curved V-Fin",
      "Blade Antenna",
    ],
    allowedWeapons: [
      "DODS Rifle",
      "Beam Saber (dual)",
      "Beam Rifle",
    ],
    allowedBackpacks: [
      "Wing Binders",
      "Booster Pod",
      "Standard Thruster Pack",
    ],
    colorways: [
      "Arctic White & Silver",
      "Phantom Midnight Blue",
    ],
    namePrefixes: ["WMS", "BMS"],
    designLanguage:
      "Federation Wolf Squad aesthetic — Advanced Generation high-mobility wolf-class suits with sleek visors, dog-ear antenna sensors, single blade antennas, clean white-and-silver livery. DODS Rifle spiral-beam signature weapon.",
    forbiddenInfluences:
      "NO mono-eye heads. NO multi-lens. NO Heat Hawk. NO physical mace. NO Heavy Arms Rack. NO Funnel weapons. NO GN Drive.",
    referenceSuits: "G-Bouncer, G-Exes, G-Exes Jackedge",
  },

  G_SELF: {
    allowedHeads: [
      "Curved V-Fin",
      "Multi-Sensor",
      "Classic V-Fin",
    ],
    allowedWeapons: [
      "Photon Beam Rifle",
      "Beam Wire",
      "Beam Saber (dual)",
    ],
    allowedBackpacks: [
      "Reflector Pack",
      "Atmospheric Pack",
      "Flight Unit",
    ],
    colorways: [
      "Pastel Blue & Translucent (G-Self)",
      "Lime Green & Silver",
      "Arctic White & Silver",
    ],
    namePrefixes: ["YG", "MSAM"],
    designLanguage:
      "G-Self / Reconguista in G aesthetic — Regild Century soft-curved suits with translucent armor parts, large photon sensor lenses, Photon-tech weapons (beam wire, beam shield), modular Atmospheric/Space/Reflector packs.",
    forbiddenInfluences:
      "NO blocky military visors. NO mono-eye. NO physical mace or Heat Hawk. NO GN Sword. NO Ahab Reactor (Post-Disaster tech). NO Striker Packs.",
    referenceSuits: "YG-111 Gundam G-Self, MSAM-033 G-Arcane, MSAM-031 Grimoire",
  },
};
