import { create } from "zustand";
import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";
import type { TurnLog } from "@/lib/battle/simulate";

export type BattleStep =
  | "arc-select"
  | "card-select"
  | "starting"     // waiting for startPVE tx
  | "resolving"    // waiting for server simulation
  | "battle"       // showing battle log animation
  | "settling"     // waiting for settleBattle tx
  | "claiming"     // waiting for claimPVEReward tx
  | "victory"
  | "defeat";

export interface ResolveResult {
  winner: "player" | "enemy";
  winnerAddress: `0x${string}`;
  finalHpWinner: number;
  timestamp: number;
  signature: `0x${string}`;
  log: TurnLog[];
  enemyName: string;
}

interface BattleState {
  step: BattleStep;
  selectedArcId: number | null;
  selectedCard: OwnedCard | null;
  sessionId: bigint | null;
  resolveResult: ResolveResult | null;
  error: string | null;

  setArc: (arcId: number) => void;
  setCard: (card: OwnedCard) => void;
  setStep: (step: BattleStep) => void;
  setSessionId: (id: bigint) => void;
  setResolveResult: (r: ResolveResult) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

const INITIAL: Omit<BattleState, keyof { setArc: unknown; setCard: unknown; setStep: unknown; setSessionId: unknown; setResolveResult: unknown; setError: unknown; reset: unknown }> = {
  step: "arc-select",
  selectedArcId: null,
  selectedCard: null,
  sessionId: null,
  resolveResult: null,
  error: null,
};

export const useBattleStore = create<BattleState>((set) => ({
  ...INITIAL,
  setArc: (arcId) => set({ selectedArcId: arcId, step: "card-select" }),
  setCard: (card) => set({ selectedCard: card }),
  setStep: (step) => set({ step }),
  setSessionId: (id) => set({ sessionId: id }),
  setResolveResult: (r) => set({ resolveResult: r }),
  setError: (e) => set({ error: e }),
  reset: () => set({ ...INITIAL }),
}));
