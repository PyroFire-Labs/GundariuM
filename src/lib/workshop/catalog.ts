export interface GalleryCard {
  id: number;
  image: string;
  name: string;
  series: string;
  faction: string;
  rarity: string;
  hp: number;
  armorType: string;
  primaryWeapon: string;
  primaryDamage: number;
  secondaryWeapon: string;
  secondaryDamage: number;
  tertiaryWeapon: string;
  tertiaryDamage: number;
  specialAttack: string;
  specialDamage: number;
}

export type WorkshopAssemblyId =
  | "head-optics"
  | "reactor-armor"
  | "arms-shields"
  | "leg-drives"
  | "flight-pack"
  | "primary-weapon";

export interface WorkshopAssembly {
  id: WorkshopAssemblyId;
  index: string;
  title: string;
  detail: string;
  status: "SIMULATED";
}

export interface WorkshopStat {
  label: "SIM HP" | "POWER" | "MASS U";
  value: number;
}

export interface WorkshopFrame extends GalleryCard {
  assemblies: readonly WorkshopAssembly[];
  stats: readonly WorkshopStat[];
}

function display(value: string, fallback: string): string {
  return value.trim() || fallback;
}

/**
 * Converts static gallery data into the workshop's display-only frame model.
 * POWER is the four listed move powers summed; MASS U is a stable visual
 * indicator derived from HP (`round(61 + HP / 100)`), not a combat stat.
 */
export function buildWorkshopFrame(card: GalleryCard): WorkshopFrame {
  const faction = display(card.faction, "Unspecified faction");
  const series = display(card.series, "Unspecified series");
  const tertiaryWeapon = display(card.tertiaryWeapon, "Unspecified flight system");
  const assemblies: readonly WorkshopAssembly[] = [
    { id: "head-optics", index: "01", title: "Head & optics", detail: `${faction} sensor suite`, status: "SIMULATED" },
    { id: "reactor-armor", index: "02", title: "Reactor & armor", detail: `${display(card.armorType, "Standard")} armor / ${card.name} core`, status: "SIMULATED" },
    { id: "arms-shields", index: "03", title: "Arms & shields", detail: `${display(card.secondaryWeapon, "Unspecified secondary system")} support assembly`, status: "SIMULATED" },
    { id: "leg-drives", index: "04", title: "Leg drives", detail: `${series} mobility package`, status: "SIMULATED" },
    { id: "flight-pack", index: "05", title: "Flight pack", detail: `${tertiaryWeapon} systems array`, status: "SIMULATED" },
    { id: "primary-weapon", index: "06", title: "Primary weapon", detail: `${display(card.primaryWeapon, "Unspecified primary weapon")} / ${card.primaryDamage} power`, status: "SIMULATED" },
  ];
  const power = card.primaryDamage + card.secondaryDamage + card.tertiaryDamage + card.specialDamage;
  const mass = Math.round(61 + card.hp / 100);

  return {
    ...card,
    assemblies,
    stats: [
      { label: "SIM HP", value: card.hp },
      { label: "POWER", value: power },
      { label: "MASS U", value: mass },
    ],
  };
}
