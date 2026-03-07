import type { TraitSet } from "./nft";

export type WeaponSlot = "primary" | "secondary" | "tertiary" | "special";

export type BattleType = "pve" | "pvp";

export type BattleStatus = "pending" | "active" | "complete" | "abandoned";

export interface TurnResult {
  attackerAddress: string;
  defenderAddress: string;
  weaponSlot: WeaponSlot;
  weaponName: string;
  rawDamage: number;
  mitigatedDamage: number;
  finalDamage: number;
  isCrit: boolean;
  attackerHpAfter: number;
  defenderHpAfter: number;
  turnNumber: number;
}

export interface BattleState {
  sessionId: bigint;
  type: BattleType;
  status: BattleStatus;
  player1: {
    address: string;
    cardTokenId: bigint;
    traits: TraitSet;
    currentHp: number;
    specialUsesRemaining: number;
  };
  player2: {
    address: string;
    cardTokenId: bigint;
    traits: TraitSet;
    currentHp: number;
    specialUsesRemaining: number;
  };
  turnLog: TurnResult[];
  currentTurn: number;
  winner: string | null;
  arcId?: number; // PVE only
  gndmStaked: bigint;
}

export interface BattleResult {
  sessionId: bigint;
  winner: string;
  finalHpWinner: number;
  timestamp: number;
}

export interface SubmitMoveRequest {
  sessionId: string;
  playerAddress: string;
  weaponSlot: WeaponSlot;
  signature: string; // EIP-712 move commitment
}

export interface SubmitMoveResponse {
  turnResult: TurnResult;
  battleState: BattleState;
  isComplete: boolean;
  settlementSignature?: string; // EIP-712 sig if battle is done
}
