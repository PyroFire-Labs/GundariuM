import type { TraitSet } from "@/types/nft";

export interface CampaignArc {
  id: number;            // 1-based, matches on-chain arcId
  name: string;
  subtitle: string;
  description: string;
  difficulty: "Rookie" | "Veteran" | "Elite" | "Ace" | "Legend";
  gndmReward: number;    // display only — set on-chain via setArcReward
  enemy: TraitSet;
}

export const CAMPAIGN_ARCS: CampaignArc[] = [
  {
    id: 1,
    name: "Operation V — First Contact",
    subtitle: "Colony Side 7 Defense",
    description: "A Zaku II patrol has spotted your Gunpla. Defeat it before it calls reinforcements.",
    difficulty: "Rookie",
    gndmReward: 5,
    enemy: {
      name: "MS-06F Zaku II",
      series: "Mobile Suit Gundam [Universal Century]",
      faction: "Principality of Zeon",
      rarity: "Common",
      hp: 200,
      pilotName: "Denim",
      armorType: "Standard",
      primaryWeapon: "120mm Machine Gun",
      primaryDamage: 38,
      secondaryWeapon: "Heat Hawk",
      secondaryDamage: 60,
      tertiaryWeapon: "Cracker Grenade",
      tertiaryDamage: 28,
      specialAttack: "Zeon Assault - Coordinated Blitz",
      specialDamage: 110,
    },
  },
  {
    id: 2,
    name: "Red Comet Rising",
    subtitle: "Pursuit at Luna II",
    description: "Char Aznable's custom Zaku cuts through space at five times normal speed. Can you keep up?",
    difficulty: "Veteran",
    gndmReward: 15,
    enemy: {
      name: "MS-06S Zaku II (Char Custom)",
      series: "Mobile Suit Gundam [Universal Century]",
      faction: "Principality of Zeon",
      rarity: "Uncommon",
      hp: 360,
      pilotName: "Char Aznable",
      armorType: "Standard",
      primaryWeapon: "280mm Bazooka",
      primaryDamage: 72,
      secondaryWeapon: "Heat Hawk",
      secondaryDamage: 108,
      tertiaryWeapon: "Rocket Launcher",
      tertiaryDamage: 50,
      specialAttack: "5x Speed Red Comet Rush",
      specialDamage: 216,
    },
  },
  {
    id: 3,
    name: "Nightmare of Solomon",
    subtitle: "Space Fortress Defense",
    description: "The amphibious Z'Gok variant commands the fortress approaches. Its claws have crushed Balls like tin cans.",
    difficulty: "Elite",
    gndmReward: 40,
    enemy: {
      name: "MSM-07S Z'Gok (Char Custom)",
      series: "Mobile Suit Gundam [Universal Century]",
      faction: "Principality of Zeon",
      rarity: "Rare",
      hp: 720,
      pilotName: "Char Aznable",
      armorType: "Gundanium",
      primaryWeapon: "Mega Particle Cannon",
      primaryDamage: 162,
      secondaryWeapon: "Iron Nail Claw",
      secondaryDamage: 243,
      tertiaryWeapon: "Torpedo Launcher",
      tertiaryDamage: 108,
      specialAttack: "Aquatic Assault - Claw Barrage",
      specialDamage: 432,
    },
  },
  {
    id: 4,
    name: "Psycommu Awakening",
    subtitle: "Neo Zeon Intercept",
    description: "The Qubeley's funnels fill the battlefield. Its I-Field deflects beam weapons - choose your loadout wisely.",
    difficulty: "Ace",
    gndmReward: 100,
    enemy: {
      name: "AMX-004 Qubeley",
      series: "Mobile Suit Zeta Gundam [Universal Century]",
      faction: "Axis Zeon",
      rarity: "Ultra Rare",
      hp: 960,
      pilotName: "Haman Karn",
      armorType: "I-Field",
      primaryWeapon: "Funnel All-Range Attack",
      primaryDamage: 240,
      secondaryWeapon: "Beam Saber",
      secondaryDamage: 336,
      tertiaryWeapon: "Vulcan Gun",
      tertiaryDamage: 120,
      specialAttack: "Newtype Psycommu - Full Funnel Spread",
      specialDamage: 576,
    },
  },
  {
    id: 5,
    name: "Final Showdown — Red Comet Returns",
    subtitle: "Axis Drop Intercept",
    description: "Char's final form. The Sazabi stands between you and victory. Everything you have learned leads to this moment.",
    difficulty: "Legend",
    gndmReward: 250,
    enemy: {
      name: "MSN-04 Sazabi",
      series: "Mobile Suit Gundam: Char's Counterattack [Universal Century]",
      faction: "Neo Zeon",
      rarity: "Legendary",
      hp: 1400,
      pilotName: "Char Aznable",
      armorType: "Luna Titanium",
      primaryWeapon: "Beam Shot Rifle",
      primaryDamage: 350,
      secondaryWeapon: "Beam Tomahawk",
      secondaryDamage: 490,
      tertiaryWeapon: "Funnel (Remote)",
      tertiaryDamage: 210,
      specialAttack: "Sazabi All Weapons - Char's Final Gambit",
      specialDamage: 840,
    },
  },
];

export function getArc(arcId: number): CampaignArc | undefined {
  return CAMPAIGN_ARCS.find((a) => a.id === arcId);
}

export const DIFFICULTY_COLOR: Record<CampaignArc["difficulty"], string> = {
  Rookie:  "text-[var(--color-rarity-common)]",
  Veteran: "text-[var(--color-rarity-uncommon)]",
  Elite:   "text-[var(--color-rarity-rare)]",
  Ace:     "text-[var(--color-rarity-ultra)]",
  Legend:  "text-[var(--color-rarity-legendary)]",
};
