"use client";

import { CountdownPage } from "@/components/ui/CountdownTimer";
import { useMintStore } from "@/store/useMintStore";
import { SuitSearch } from "@/components/mint/SuitSearch";
import { PhotoDropzone } from "@/components/mint/PhotoDropzone";
import { GradePicker } from "@/components/mint/GradePicker";
import { TraitReview } from "@/components/mint/TraitReview";
import { MintConfirm } from "@/components/mint/MintConfirm";
import { MintSuccess } from "@/components/mint/MintSuccess";

const MINT_ENABLED = process.env.NEXT_PUBLIC_MINT_ENABLED === "true";

const STEP_LABELS: Record<string, string> = {
  suit_search: "Find your mobile suit",
  grade_select: "Select your kit's grade",
  idle: "Upload your Gunpla photo",
  uploading: "Uploading…",
  analyzing: "AI is identifying your Gunpla…",
  reviewing: "Review & edit your card traits",
  confirming: "Approve & mint on-chain",
  success: "Your card is live!",
};

const PROGRESS_STEPS = ["suit_search", "grade_select", "idle", "reviewing", "confirming", "success"] as const;

function MintFlow() {
  const { step } = useMintStore();

  const currentProgressIndex = (() => {
    if (step === "suit_search") return 0;
    if (step === "grade_select") return 1;
    if (step === "idle" || step === "uploading" || step === "analyzing") return 2;
    if (step === "reviewing") return 3;
    if (step === "confirming") return 4;
    return 5;
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
      {step === "suit_search" && <SuitSearch />}
      {step === "grade_select" && <GradePicker />}
      {step === "idle" && <PhotoDropzone />}
      {step === "uploading" && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--accent)] text-sm font-[family-name:var(--font-orbitron)] tracking-wider">
            UPLOADING...
          </p>
        </div>
      )}
      {(step === "analyzing") && <GradePicker />}
      {step === "reviewing" && <TraitReview />}
      {step === "confirming" && <MintConfirm />}
      {step === "success" && <MintSuccess />}
    </div>
  );
}

export default function MintPage() {
  if (!MINT_ENABLED) {
    return (
      <CountdownPage
        pageTitle="MINT"
        missionLabel="MINTING BEGINS"
        description="Turn your real Gunpla into unique on-chain NFT battle cards."
      />
    );
  }
  return <MintFlow />;
}
