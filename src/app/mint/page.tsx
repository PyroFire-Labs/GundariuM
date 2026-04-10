"use client";

import { CountdownPage } from "@/components/ui/CountdownTimer";
import { useMintStore } from "@/store/useMintStore";
import { MintLanding } from "@/components/mint/MintLanding";
import { GenerationReveal } from "@/components/mint/GenerationReveal";
import { MintConfirm } from "@/components/mint/MintConfirm";
import { MintSuccess } from "@/components/mint/MintSuccess";

const MINT_ENABLED = process.env.NEXT_PUBLIC_MINT_ENABLED === "true";

const STEP_LABELS: Record<string, string> = {
  idle: "Mint a unique kitbash Mobile Suit",
  generating: "AI is forging your Mobile Suit...",
  reveal: "Your Gunpla has been forged",
  confirming: "Approve & mint on-chain",
  success: "Your card is live!",
};

const PROGRESS_STEPS = [
  "idle",
  "generating",
  "reveal",
  "confirming",
  "success",
] as const;

function MintFlow() {
  const { step, error } = useMintStore();

  const currentProgressIndex = PROGRESS_STEPS.indexOf(
    step as (typeof PROGRESS_STEPS)[number]
  );
  const progressIdx = currentProgressIndex >= 0 ? currentProgressIndex : 0;

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
                i === progressIdx
                  ? "bg-[var(--accent)] scale-125"
                  : i < progressIdx
                  ? "bg-[var(--accent)]/50"
                  : "bg-[var(--border)]"
              }`}
            />
            {i < PROGRESS_STEPS.length - 1 && (
              <div
                className={`w-10 h-px transition-colors duration-300 ${
                  i < progressIdx
                    ? "bg-[var(--accent)]/50"
                    : "bg-[var(--border)]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <p className="text-red-400 text-sm text-center px-2">{error}</p>
      )}

      {/* Step content */}
      {step === "idle" && <MintLanding />}
      {step === "generating" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-sm text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)]">
            FORGING YOUR MOBILE SUIT...
          </p>
        </div>
      )}
      {step === "reveal" && <GenerationReveal />}
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
        description="Forge unique AI-generated kitbash Mobile Suits as on-chain NFT battle cards."
      />
    );
  }
  return <MintFlow />;
}
