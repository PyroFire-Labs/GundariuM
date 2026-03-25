import { create } from "zustand";
import { COSMETIC_PRICE, REPAINT_PRICE } from "@/lib/card/cosmetics-data";

interface CosmeticsState {
  selectedFrame: string;
  selectedDecal: string | null;
  colorShift: number;
  tintColor: string | null;
  repaintStyle: number;
  totalCost: number;
  editingTokenId: bigint | null;

  setFrame: (frame: string) => void;
  setDecal: (decal: string | null) => void;
  setColorShift: (shift: number) => void;
  setTintColor: (color: string | null) => void;
  setRepaintStyle: (style: number) => void;
  setEditingTokenId: (tokenId: bigint | null) => void;
  reset: () => void;
}

function calcCost(
  selectedFrame: string,
  selectedDecal: string | null,
  colorShift: number,
  tintColor: string | null,
  repaintStyle: number
): number {
  let cost = 0;
  if (selectedFrame !== "base") cost += COSMETIC_PRICE;
  if (selectedDecal !== null) cost += COSMETIC_PRICE;
  if (colorShift !== 0 || tintColor !== null) cost += COSMETIC_PRICE;
  if (repaintStyle > 0) cost += REPAINT_PRICE;
  return cost;
}

export const useCosmeticsStore = create<CosmeticsState>((set) => ({
  selectedFrame: "base",
  selectedDecal: null,
  colorShift: 0,
  tintColor: null,
  repaintStyle: 0,
  totalCost: 0,
  editingTokenId: null,

  setFrame: (frame) =>
    set((state) => ({
      selectedFrame: frame,
      totalCost: calcCost(frame, state.selectedDecal, state.colorShift, state.tintColor, state.repaintStyle),
    })),

  setDecal: (decal) =>
    set((state) => ({
      selectedDecal: decal,
      totalCost: calcCost(state.selectedFrame, decal, state.colorShift, state.tintColor, state.repaintStyle),
    })),

  setColorShift: (shift) =>
    set((state) => ({
      colorShift: shift,
      totalCost: calcCost(state.selectedFrame, state.selectedDecal, shift, state.tintColor, state.repaintStyle),
    })),

  setTintColor: (color) =>
    set((state) => ({
      tintColor: color,
      totalCost: calcCost(state.selectedFrame, state.selectedDecal, state.colorShift, color, state.repaintStyle),
    })),

  setRepaintStyle: (style) =>
    set((state) => ({
      repaintStyle: style,
      totalCost: calcCost(state.selectedFrame, state.selectedDecal, state.colorShift, state.tintColor, style),
    })),

  setEditingTokenId: (tokenId) => set({ editingTokenId: tokenId }),

  reset: () =>
    set({
      selectedFrame: "base",
      selectedDecal: null,
      colorShift: 0,
      tintColor: null,
      repaintStyle: 0,
      totalCost: 0,
      editingTokenId: null,
    }),
}));
