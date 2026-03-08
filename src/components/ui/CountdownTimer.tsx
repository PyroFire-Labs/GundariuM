"use client";

import { useEffect, useState } from "react";

// May 10, 2026 12:00 PM CDT (UTC-5) = 17:00 UTC
const LAUNCH_DATE = new Date("2026-05-10T17:00:00.000Z");

function getTimeLeft() {
  const diff = LAUNCH_DATE.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 864e5),
    hours: Math.floor((diff % 864e5) / 36e5),
    minutes: Math.floor((diff % 36e5) / 6e4),
    seconds: Math.floor((diff % 6e4) / 1e3),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function DigitBlock({ value, label, compact }: { value: string; label: string; compact?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative px-4 py-3 md:px-5 md:py-4">
        {/* Bandai-style corner brackets */}
        <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-blue-500" />
        <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-blue-500" />
        <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-blue-500" />
        <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-blue-500" />
        <div
          className={`font-[family-name:var(--font-orbitron)] font-black text-white tabular-nums ${
            compact ? "text-4xl md:text-5xl" : "text-5xl md:text-7xl"
          }`}
        >
          {value}
        </div>
      </div>
      <div className="font-[family-name:var(--font-orbitron)] text-[9px] font-bold italic tracking-[0.3em] text-blue-400 uppercase">
        {label}
      </div>
    </div>
  );
}

function Colon({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 animate-pulse ${compact ? "mb-5" : "mb-7"}`}>
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/70" />
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/70" />
    </div>
  );
}

// ─── Full-page variant (replaces ComingSoon) ───────────────────────────────
export function CountdownPage({
  pageTitle,
  missionLabel,
  description,
}: {
  pageTitle: string;
  missionLabel: string;
  description?: string;
}) {
  const [time, setTime] = useState(getTimeLeft());
  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 gap-8 text-center">

      {/* Classification tag */}
      <div className="flex items-center gap-3">
        <div className="h-px w-8 bg-blue-500/50" />
        <div className="border border-blue-500/60 px-3 py-1 font-[family-name:var(--font-orbitron)] text-[10px] font-bold italic tracking-[0.25em] text-blue-400 uppercase">
          LAUNCH SEQUENCE
        </div>
        <div className="h-px w-8 bg-blue-500/50" />
      </div>

      {/* Page title */}
      <div>
        <h1 className="font-[family-name:var(--font-orbitron)] text-5xl font-black tracking-wider text-white md:text-6xl">
          {pageTitle}
        </h1>
        <p className="mt-2 font-[family-name:var(--font-orbitron)] text-xs font-bold italic tracking-[0.3em] text-blue-400 uppercase">
          {missionLabel}
        </p>
      </div>

      {/* Digit blocks */}
      <div className="flex items-center gap-3 md:gap-5">
        <DigitBlock value={pad(time.days)} label="DAYS" />
        <Colon />
        <DigitBlock value={pad(time.hours)} label="HRS" />
        <Colon />
        <DigitBlock value={pad(time.minutes)} label="MIN" />
        <Colon />
        <DigitBlock value={pad(time.seconds)} label="SEC" />
      </div>

      {/* Date/time */}
      <div className="flex flex-col items-center gap-1">
        <div className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-widest text-white/70">
          MAY 10, 2026 · 12:00 PM CST
        </div>
        {description && (
          <p className="mt-1 max-w-xs text-sm text-white/40">{description}</p>
        )}
      </div>

      {/* Bottom slash decoration */}
      <div className="flex items-center gap-2 opacity-30">
        <div className="h-px w-12 bg-blue-500" />
        <div className="font-[family-name:var(--font-orbitron)] text-[9px] italic tracking-widest text-blue-400">
          GUNDARIUM · BASE NETWORK
        </div>
        <div className="h-px w-12 bg-blue-500" />
      </div>

    </div>
  );
}

// ─── Banner variant (for Home page top + bottom) ───────────────────────────
export function CountdownBanner() {
  const [time, setTime] = useState(getTimeLeft());
  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="border-y border-blue-500/20 bg-blue-950/20 px-4 py-8">
      <div className="mx-auto max-w-4xl flex flex-col items-center gap-5">

        {/* Top label */}
        <div className="flex items-center gap-3">
          <div className="h-px w-6 bg-blue-500/50" />
          <div className="border border-blue-500/50 px-3 py-0.5 font-[family-name:var(--font-orbitron)] text-[9px] font-bold italic tracking-[0.3em] text-blue-400 uppercase">
            MS UNIT · FULL GAME LAUNCH
          </div>
          <div className="h-px w-6 bg-blue-500/50" />
        </div>

        {/* Digit blocks */}
        <div className="flex items-center gap-3 md:gap-4">
          <DigitBlock value={pad(time.days)} label="DAYS" compact />
          <Colon compact />
          <DigitBlock value={pad(time.hours)} label="HRS" compact />
          <Colon compact />
          <DigitBlock value={pad(time.minutes)} label="MIN" compact />
          <Colon compact />
          <DigitBlock value={pad(time.seconds)} label="SEC" compact />
        </div>

        {/* Date + description */}
        <div className="text-center space-y-1">
          <div className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-widest text-white/70">
            MAY 10, 2026 · 12:00 PM CST
          </div>
          <p className="text-xs text-white/40">
            Mint · Campaign Arc 1 · Arena · Leaderboard — all go live simultaneously
          </p>
        </div>

      </div>
    </section>
  );
}
