"use client";

import { useState } from "react";
import { useMintStore } from "@/store/useMintStore";
import { FACTIONS, FACTION_KEYS } from "@/lib/constants/factions";
import type { FactionKey } from "@/lib/constants/factions";

export function MintLanding() {
  const { setFaction, setGenerationResult, goTo, setError } = useMintStore();
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleMint() {
    setGenerating(true);
    setFaction(selectedFaction);
    goTo("generating");

    try {
      const res = await fetch("/api/generate-kitbash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faction: selectedFaction }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }

      const data = await res.json();
      setGenerationResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      goTo("idle");
    } finally {
      setGenerating(false);
    }
  }

  const factionKeys = FACTION_KEYS.filter((k) => k !== "UNKNOWN");

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Faction selector */}
      <div className="w-full max-w-xl">
        <h3 className="text-sm font-[family-name:var(--font-orbitron)] text-[var(--foreground)]/60 mb-3 text-center">
          CHOOSE FACTION (OPTIONAL)
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedFaction(null)}
            className={`px-3 py-2 rounded-lg text-xs font-[family-name:var(--font-orbitron)] border transition-all ${
              selectedFaction === null
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--foreground)]/40 hover:border-[var(--foreground)]/20"
            }`}
          >
            RANDOM
          </button>
          {factionKeys.map((key) => {
            const f = FACTIONS[key as FactionKey];
            return (
              <button
                key={key}
                onClick={() => setSelectedFaction(key)}
                className={`px-3 py-2 rounded-lg text-xs font-[family-name:var(--font-orbitron)] border transition-all ${
                  selectedFaction === key
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--foreground)]/40 hover:border-[var(--foreground)]/20"
                }`}
                title={f.description}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: f.color }}
                />
                {f.name.length > 20 ? key : f.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mint button */}
      <button
        onClick={handleMint}
        disabled={generating}
        className="px-8 py-4 bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] font-bold text-lg rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? "GENERATING..." : "MINT YOUR GUNPLA"}
      </button>

      <p className="text-xs text-[var(--foreground)]/40 text-center max-w-sm">
        A unique AI-generated kitbash Mobile Suit will be created just for you.
        Traits are randomly rolled with weighted rarity.
      </p>

      <p className="text-[10px] text-[var(--foreground)]/30 text-center max-w-sm">
        By pressing &quot;MINT YOUR GUNPLA&quot; you agree to our{" "}
        <a href="/terms" className="underline hover:text-[var(--foreground)]/50 transition-colors">
          Terms of Use
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-[var(--foreground)]/50 transition-colors">
          Privacy Notice
        </a>
        .
      </p>
    </div>
  );
}
