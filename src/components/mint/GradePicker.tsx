"use client";

import { useState } from "react";
import { useMintStore } from "@/store/useMintStore";
import type { KitGrade } from "@/types/nft";

const GRADES: { value: KitGrade; label: string; desc: string; rarity: string }[] = [
  { value: "SD", label: "SD", desc: "Super Deformed — chibi proportions", rarity: "Common" },
  { value: "HG", label: "HG", desc: "High Grade 1/144 — most common kit", rarity: "Common" },
  { value: "RG", label: "RG", desc: "Real Grade 1/144 — inner frame detail", rarity: "Uncommon" },
  { value: "MG", label: "MG", desc: "Master Grade 1/100 — large inner frame", rarity: "Rare" },
  { value: "MG_VERKA", label: "MG Ver.Ka", desc: "Master Grade Ver.Ka — Katoki markings", rarity: "Ultra Rare" },
  { value: "HIRM", label: "Hi-RM", desc: "Hi-Resolution Model 1/100 — resin detail", rarity: "Ultra Rare" },
  { value: "PG", label: "PG", desc: "Perfect Grade 1/60 — maximum complexity", rarity: "Legendary" },
];

const RARITY_COLOR: Record<string, string> = {
  Common: "text-[var(--color-rarity-common)]",
  Uncommon: "text-[var(--color-rarity-uncommon)]",
  Rare: "text-[var(--color-rarity-rare)]",
  "Ultra Rare": "text-[var(--color-rarity-ultra)]",
  Legendary: "text-[var(--color-rarity-legendary)]",
};

export function GradePicker() {
  const { imageFile, imagePreviewUrl, grade: storedGrade, setGrade, setTraits, goTo } = useMintStore();
  const [selected, setSelected] = useState<KitGrade | null>(storedGrade);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!selected || !imageFile) return;

    setGrade(selected);
    setAnalyzing(true);
    setError(null);
    goTo("analyzing");

    const form = new FormData();
    form.append("image", imageFile);
    form.append("grade", selected);

    try {
      const res = await fetch("/api/analyze-gunpla", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTraits(data.traits);
      goTo("reviewing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      goTo("grade_select");
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      {/* Thumbnail */}
      {imagePreviewUrl && (
        <div className="w-24 h-24 rounded-lg overflow-hidden border border-[var(--border)]">
          <img src={imagePreviewUrl} alt="Kit" className="w-full h-full object-cover" />
        </div>
      )}

      <p className="text-[var(--foreground)]/60 text-sm text-center">
        Select the grade of this kit. This determines rarity and stats — you know what you built.
      </p>

      {/* Grade buttons */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {GRADES.map((g) => (
          <button
            key={g.value}
            onClick={() => setSelected(g.value)}
            className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all
              ${
                selected === g.value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40"
              }`}
          >
            <span className="font-[family-name:var(--font-orbitron)] font-bold text-sm text-[var(--foreground)]">
              {g.label}
            </span>
            <span className="text-[var(--foreground)]/50 text-xs leading-snug">{g.desc}</span>
            <span className={`text-xs font-semibold mt-1 ${RARITY_COLOR[g.rarity]}`}>
              {g.rarity}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <button
        onClick={handleAnalyze}
        disabled={!selected || analyzing}
        className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ANALYZE WITH AI →
      </button>

      <button
        onClick={() => goTo("idle")}
        className="text-[var(--foreground)]/40 text-xs hover:text-[var(--foreground)]/60 transition-colors"
      >
        ← Back to photo
      </button>
    </div>
  );
}
