"use client";

import { useMintStore } from "@/store/useMintStore";
import { CardFrame } from "@/components/card/CardFrame";

export function CardPreview() {
  const { traits, imagePreviewUrl, goTo } = useMintStore();

  if (!traits || !imagePreviewUrl) {
    return null;
  }

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-6">
      {/* Card preview with frame */}
      <CardFrame
        imageUrl={imagePreviewUrl}
        traits={traits}
      />

      {/* Info text */}
      <p className="text-[var(--foreground)]/50 text-xs text-center max-w-xs">
        This is how your GundariuM card will appear. The HUD frame is included free with every mint.
      </p>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-2 w-full max-w-sm">
        <button
          onClick={() => goTo("cosmetics_select")}
          className="w-full py-3 bg-[var(--accent-2)] text-white font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          ADD COSMETICS
        </button>
        <button
          onClick={() => goTo("confirming")}
          className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          MINT AS-IS →
        </button>
        <button
          onClick={() => goTo("reviewing")}
          className="w-full py-2 text-[var(--foreground)]/40 text-sm hover:text-[var(--foreground)]/60 transition-colors"
        >
          ← Back to traits
        </button>
      </div>
    </div>
  );
}
