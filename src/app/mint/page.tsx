"use client";

import { useMintStore } from "@/store/useMintStore";
import { PhotoDropzone } from "@/components/mint/PhotoDropzone";
import { TraitReview } from "@/components/mint/TraitReview";
import { MintConfirm } from "@/components/mint/MintConfirm";
import { MintSuccess } from "@/components/mint/MintSuccess";

const STEP_LABELS: Record<string, string> = {
  idle: "Upload your Gunpla photo",
  uploading: "Uploading…",
  analyzing: "AI is analyzing your Gunpla…",
  reviewing: "Review & edit your card traits",
  confirming: "Approve & mint on-chain",
  success: "Your card is live!",
};

const PROGRESS_STEPS = ["idle", "reviewing", "confirming", "success"] as const;

export default function MintPage() {
  const { step } = useMintStore();

  const currentProgressIndex = (() => {
    if (step === "idle" || step === "uploading" || step === "analyzing")
      return 0;
    if (step === "reviewing") return 1;
    if (step === "confirming") return 2;
    return 3;
  })();

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center px-4 py-12 gap-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)]">
          MINT YOUR GUNPLA
        </h1>
        <p className="text-[var(--foreground)]/60 text-sm">
          {STEP_LABELS[step]}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {PROGRESS_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i === currentProgressIndex
                  ? "bg-[var(--accent)] scale-125"
                  : i < currentProgressIndex
                  ? "bg-[var(--accent)]/50"
                  : "bg-[var(--border)]"
              }`}
            />
            {i < PROGRESS_STEPS.length - 1 && (
              <div
                className={`w-10 h-px transition-colors duration-300 ${
                  i < currentProgressIndex
                    ? "bg-[var(--accent)]/50"
                    : "bg-[var(--border)]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {(step === "idle" || step === "uploading" || step === "analyzing") && (
        <PhotoDropzone />
      )}
      {step === "reviewing" && <TraitReview />}
      {step === "confirming" && <MintConfirm />}
      {step === "success" && <MintSuccess />}
    </div>
  );
}
