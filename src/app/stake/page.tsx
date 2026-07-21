"use client";

import { openInMiniAppOrBrowser } from "@/lib/openInMiniAppOrBrowser";

const STREME_GNRM_URL = "https://streme.fun/token/0x271b01cc11032a4e23f0200f8f57eb45176ab491";

export default function StakePage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 gap-4 text-center">
      <p className="text-[var(--foreground)]/20 font-[family-name:var(--font-orbitron)] text-xs tracking-[0.3em] uppercase">
        Live on Base
      </p>
      <h1 className="font-[family-name:var(--font-orbitron)] text-5xl font-black text-[var(--accent)] tracking-wider">
        GNRM STAKING
      </h1>
      <p className="text-[var(--foreground)]/50 text-sm max-w-xs">
        Stake GNRM to earn rewards on Streme.fun.
      </p>
      <button
        onClick={() => openInMiniAppOrBrowser(STREME_GNRM_URL)}
        className="mt-4 rounded-full bg-[var(--accent)] px-6 py-2 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-widest text-black transition-all hover:scale-105"
      >
        STAKE ON STREME
      </button>
    </div>
  );
}
