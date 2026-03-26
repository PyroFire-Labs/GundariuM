"use client";

import { useCosmeticsStore } from "@/store/useCosmeticsStore";
import { FRAME_SKINS, DECALS, REPAINT_STYLES } from "@/lib/card/cosmetics-data";
import type { CosmeticOverrides } from "@/components/card/CardFrame";

/**
 * Reads the cosmetics store and returns CosmeticOverrides for CardFrame.
 * Returns undefined if no cosmetics are selected (all defaults).
 */
export function useCosmeticOverrides(): CosmeticOverrides | undefined {
  const { selectedFrame, selectedDecal, colorShift, tintColor, repaintStyle } =
    useCosmeticsStore();

  const hasAny =
    selectedFrame !== "base" ||
    selectedDecal !== null ||
    colorShift !== 0 ||
    tintColor !== null ||
    repaintStyle > 0;

  if (!hasAny) return undefined;

  const frameSkin = FRAME_SKINS.find((f) => f.id === selectedFrame);
  const decal = selectedDecal ? DECALS.find((d) => d.id === selectedDecal) : null;
  const repaint = repaintStyle > 0 ? REPAINT_STYLES.find((r) => r.id === repaintStyle) : null;

  return {
    frameColor: selectedFrame !== "base" ? frameSkin?.preview : undefined,
    colorShift: colorShift !== 0 ? colorShift : undefined,
    tintColor: tintColor ?? undefined,
    decalName: decal?.name,
    repaintName: repaint?.name,
  };
}
