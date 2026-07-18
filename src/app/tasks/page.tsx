"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useDailyCheckIn } from "@/lib/contracts/hooks/useDailyCheckIn";
import { useGnrmPurchaseCheck } from "@/lib/contracts/hooks/useGnrmPurchaseCheck";
import { useMintedTodayCheck } from "@/lib/contracts/hooks/useMintedTodayCheck";
import { useStakedTodayCheck } from "@/lib/contracts/hooks/useStakedTodayCheck";
import { useCollection } from "@/lib/contracts/hooks/useCollection";
import { ShareButtons } from "@/components/ui/ShareButtons";

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf0XmuUIJ9IC4CymaSdLv761No_U9o5GOMTK71bmdyyC3R9zA/viewform";

function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function useCountdownToNextUtcDay(active: boolean): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const ms = nextUtcMidnight().getTime() - Date.now();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setLabel(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  return label;
}

export default function TasksPage() {
  const { address, isConnected } = useAccount();
  const {
    currentStreak,
    totalCheckIns,
    perfectWeek,
    checkedInToday,
    phase,
    checkIn,
    contractReady,
    error: checkInError,
  } = useDailyCheckIn();
  const { count: mintedCount } = useCollection();
  const { phase: gnrmPhase, check: checkGnrmBuy, error: gnrmError } = useGnrmPurchaseCheck();
  const { phase: mintPhase, check: checkMintedToday, error: mintError } = useMintedTodayCheck();
  const { phase: stakePhase, check: checkStakedToday, error: stakeError } = useStakedTodayCheck();

  const gnrmVerified = gnrmPhase === "verified";
  const mintedToday = mintPhase === "verified";
  const stakedToday = stakePhase === "verified";
  const countdown = useCountdownToNextUtcDay(checkedInToday);
  const exp =
    currentStreak * 10 +
    totalCheckIns * 5 +
    mintedCount * 25 +
    (stakedToday ? 50 : 0) +
    (gnrmVerified ? 12 : 0) +
    (perfectWeek ? 200 : 0);

  if (!isConnected) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-[var(--foreground)]/50 font-[family-name:var(--font-orbitron)] text-sm tracking-widest">
          CONNECT YOUR WALLET TO VIEW DAILY TASKS
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <div className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-[0.3em] text-[var(--accent)]/60 uppercase">
            Frame-Runner
          </div>
          <h1 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl font-black tracking-wider text-white md:text-3xl">
            DAILY TASKS
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-center">
            <div className="text-[10px] font-[family-name:var(--font-orbitron)] tracking-widest text-[var(--foreground)]/50 uppercase">
              Total EXP
            </div>
            <div className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)]">
              {exp.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-[family-name:var(--font-orbitron)] tracking-widest text-[var(--foreground)]/50 uppercase">
              Daily Streak
            </div>
            <div className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)]">
              {currentStreak}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <TaskRow
            title="Check In"
            expLabel="+10 EXP"
            done={checkedInToday}
            countdown={checkedInToday ? countdown : undefined}
            actionLabel={contractReady ? (phase === "checking-in" ? "Checking In..." : "Check In") : "Unavailable"}
            onAction={checkIn}
            disabled={!contractReady || phase === "checking-in"}
            error={checkInError}
          />
          <TaskRow
            title="Buy GNRM"
            subtitle="Buy 30,000+ GNRM today"
            expLabel="+12 EXP"
            done={gnrmVerified}
            actionLabel={
              gnrmPhase === "checking" ? "Checking..." : gnrmPhase === "not-met" ? "Not Met — Recheck" : "Check"
            }
            onAction={checkGnrmBuy}
            disabled={gnrmPhase === "checking"}
            error={gnrmError}
          />
          <TaskRow
            title="Run Demo + Submit Form"
            expLabel="+15 EXP"
            linkHref={GOOGLE_FORM_URL}
            linkLabel="Open Form"
          />
          <TaskRow
            title="Mint a Gundar-Frame"
            subtitle="Mint today to complete this task"
            expLabel="+25 EXP"
            done={mintedToday}
            linkHref={mintedCount === 0 ? "/mint" : undefined}
            linkLabel="Mint Now"
            actionLabel={
              mintPhase === "checking" ? "Checking..." : mintPhase === "not-met" ? "Not Met — Recheck" : "Check"
            }
            onAction={checkMintedToday}
            disabled={mintPhase === "checking"}
            error={mintError}
          />
          <TaskRow
            title="Stake Token"
            subtitle="Stake GNRM today"
            expLabel="+50 EXP"
            done={stakedToday}
            actionLabel={
              stakePhase === "checking" ? "Checking..." : stakePhase === "not-met" ? "Not Met — Recheck" : "Check"
            }
            onAction={checkStakedToday}
            disabled={stakePhase === "checking"}
            error={stakeError}
          />
          <DossierTaskRow address={address} streak={currentStreak} exp={exp} />
        </div>
      </div>
    </main>
  );
}

function TaskRow({
  title,
  subtitle,
  expLabel,
  done,
  countdown,
  actionLabel,
  onAction,
  disabled,
  linkHref,
  linkLabel,
  placeholder,
  error,
}: {
  title: string;
  subtitle?: string;
  expLabel: string;
  done?: boolean;
  countdown?: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  linkHref?: string;
  linkLabel?: string;
  placeholder?: boolean;
  error?: string | null;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-4 ${
        placeholder ? "border-[var(--border)] bg-[var(--surface)]/50 opacity-50" : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div>
        <div className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-white">{title}</div>
        {subtitle && <div className="text-[10px] text-[var(--foreground)]/50">{subtitle}</div>}
        <div className="font-mono text-[10px] text-[var(--accent)]">{expLabel}</div>
        {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
      </div>
      {placeholder ? (
        <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-widest text-[var(--foreground)]/40 uppercase">
          Coming Soon
        </span>
      ) : done && countdown ? (
        <span className="font-mono text-xs text-[var(--foreground)]/60 border border-[var(--border)] rounded-full px-3 py-1">
          {countdown}
        </span>
      ) : done ? (
        <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-widest text-[var(--accent)] uppercase">
          Done
        </span>
      ) : linkHref ? (
        <Link
          href={linkHref}
          target={linkHref.startsWith("http") ? "_blank" : undefined}
          rel={linkHref.startsWith("http") ? "noopener noreferrer" : undefined}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-wider text-black transition-all hover:scale-105"
        >
          {linkLabel}
        </Link>
      ) : (
        <button
          onClick={onAction}
          disabled={disabled}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-[family-name:var(--font-orbitron)] text-[10px] font-bold tracking-wider text-black transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function DossierTaskRow({ address, streak, exp }: { address: `0x${string}` | undefined; streak: number; exp: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <div className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-white">Share Your Dossier</div>
        <div className="font-mono text-[10px] text-[var(--accent)]">+8 EXP</div>
      </div>
      {address && <ShareButtons dossier={{ address, streak, exp }} />}
    </div>
  );
}
