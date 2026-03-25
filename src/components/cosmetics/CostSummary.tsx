"use client";

import { useCosmeticsStore } from "@/store/useCosmeticsStore";

interface CostSummaryProps {
  onConfirm: () => void;
  onSkip: () => void;
  confirmLabel?: string;
  skipLabel?: string;
}

export function CostSummary({
  onConfirm,
  onSkip,
  confirmLabel,
  skipLabel = "Skip cosmetics",
}: CostSummaryProps) {
  const totalCost = useCosmeticsStore((s) => s.totalCost);

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-[var(--border)]">
      {totalCost > 0 && (
        <div className="px-3 py-2 rounded bg-[var(--surface-2)] text-center">
          <span
            className="font-mono text-sm font-bold tracking-widest"
            style={{ color: "var(--accent)" }}
          >
            COSMETICS TOTAL: ${totalCost.toFixed(2)} USDC
          </span>
        </div>
      )}

      <button
        onClick={onConfirm}
        className="w-full py-3 rounded font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-widest text-black transition-opacity hover:opacity-90 active:opacity-75"
        style={{ backgroundColor: "var(--accent)" }}
      >
        {totalCost > 0 && confirmLabel ? confirmLabel : "CONTINUE →"}
      </button>

      <button
        onClick={onSkip}
        className="text-center text-xs py-1 transition-opacity hover:opacity-80"
        style={{ color: "var(--foreground)", opacity: 0.5 }}
      >
        {skipLabel}
      </button>
    </div>
  );
}
