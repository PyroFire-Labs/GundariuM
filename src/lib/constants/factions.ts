export type FactionKey =
  | "EFSF"
  | "ZEON"
  | "ZAFT"
  | "ALLIANCE"
  | "OZ"
  | "GUNDAM_WING_TEAM"
  | "CELESTIAL_BEING"
  | "HUMAN_REFORM_LEAGUE"
  | "INNOVATION"
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
  ZAFT: {
    key: "ZAFT",
    name: "Zodiac Alliance of Freedom Treaty",
    universe: "Cosmic Era",
    color: "#16a34a",
    description:
      "The military force of the PLANTs, comprised entirely of Coordinators fighting for independence from the naturals of Earth.",
  },
  ALLIANCE: {
    key: "ALLIANCE",
    name: "Earth Alliance",
    universe: "Cosmic Era",
    color: "#1d4ed8",
    description:
      "The Atlantic Federation-led coalition of Earth nations opposing ZAFT, equipped with stolen Gundam technology.",
  },
  OZ: {
    key: "OZ",
    name: "Organization of the Zodiac",
    universe: "After Colony",
    color: "#7c3aed",
    description:
      "The clandestine mobile suit corps within the United Earth Sphere Alliance, later seizing world control.",
  },
  GUNDAM_WING_TEAM: {
    key: "GUNDAM_WING_TEAM",
    name: "Operation Meteor",
    universe: "After Colony",
    color: "#e5e7eb",
    description:
      "The five young pilots sent from the space colonies to Earth to battle OZ and fight for peace.",
  },
  CELESTIAL_BEING: {
    key: "CELESTIAL_BEING",
    name: "Celestial Being",
    universe: "Anno Domini",
    color: "#f59e0b",
    description:
      "A private armed organization dedicated to eradicating war through armed intervention using GN-powered Gundams.",
  },
  HUMAN_REFORM_LEAGUE: {
    key: "HUMAN_REFORM_LEAGUE",
    name: "Human Reform League",
    universe: "Anno Domini",
    color: "#0891b2",
    description:
      "One of three major power blocs of Anno Domini Earth, centered in Asia and pursuing genetic enhancement.",
  },
  INNOVATION: {
    key: "INNOVATION",
    name: "Innovators",
    universe: "Anno Domini",
    color: "#a855f7",
    description:
      "The secretive group of Innovades serving Ribbons Almark, pulling strings behind the world's governments.",
  },
  UNKNOWN: {
    key: "UNKNOWN",
    name: "Unknown Faction",
    universe: "Unknown",
    color: "#6b7280",
    description: "Faction affiliation unknown.",
  },
};

export const FACTION_KEYS = Object.keys(FACTIONS) as FactionKey[];
