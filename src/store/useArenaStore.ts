import { create } from "zustand";
import type { OwnedCard } from "@/lib/contracts/hooks/useCollection";
import type { TurnLog } from "@/lib/battle/simulate";

export type ArenaStep =
  | "lobby"
  | "create-card"    // picking card + stake for creating
  | "creating"       // startPVP tx in flight (unused — handled in component)
  | "waiting"        // waiting for opponent to join
  | "join-browse"    // browsing open sessions
  | "join-card"      // picking card for joining (unused — handled in ArenaJoin)
  | "joining"        // joinPVP confirmed, now resolving
  | "resolving"      // waiting for API
  | "battle"         // showing battle log animation
  | "settling"       // settleBattle tx in flight
  | "victory"
  | "defeat";

export interface ArenaResolveResult {
  winner: "player1" | "player2";
  winnerAddress: `0x${string}`;
  finalHpWinner: number;
  timestamp: number;
  signature: `0x${string}`;
  log: TurnLog[];
  player1Name: string;
  player2Name: string;
}

interface ArenaState {
  step: ArenaStep;
  isCreator: boolean;
  myCard: OwnedCard | null;
  stakeAmount: bigint;
  sessionId: bigint | null;
  resolveResult: ArenaResolveResult | null;
  error: string | null;

  setStep: (step: ArenaStep) => void;
  setCreator: (v: boolean) => void;
  setMyCard: (card: OwnedCard) => void;
  setStakeAmount: (amount: bigint) => void;
  setSessionId: (id: bigint) => void;
  setResolveResult: (r: ArenaResolveResult) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

const INITIAL = {
  step: "lobby" as ArenaStep,
  isCreator: false,
  myCard: null,
  stakeAmount: BigInt(10) * BigInt(1e18),
  sessionId: null,
  resolveResult: null,
  error: null,
};

export const useArenaStore = create<ArenaState>((set) => ({
  ...INITIAL,
  setStep: (step) => set({ step }),
  setCreator: (v) => set({ isCreator: v }),
  setMyCard: (card) => set({ myCard: card }),
  setStakeAmount: (amount) => set({ stakeAmount: amount }),
  setSessionId: (id) => set({ sessionId: id }),
  setResolveResult: (r) => set({ resolveResult: r }),
  setError: (e) => set({ error: e }),
  reset: () => set({ ...INITIAL }),
}));
