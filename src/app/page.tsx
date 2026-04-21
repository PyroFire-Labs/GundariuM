"use client";

import Link from "next/link";
import { CountdownBanner } from "@/components/ui/CountdownTimer";
import { useEffect, useState } from "react";
import { formatUnits, parseEther } from "viem";

export default function Home() {
  const [tickerGunr, setTickerGunr] = useState<string | null>(null);

  useEffect(() => {
    const TICKER_SELL = parseEther("0.01").toString();
    const fetchTicker = async () => {
      try {
        const res = await fetch(`/api/gunr-quote?sellAmount=${TICKER_SELL}`);
        const json = await res.json();
        if (json.buyAmount) {
          const n = parseFloat(formatUnits(BigInt(json.buyAmount), 18));
          if (n >= 1_000_000) setTickerGunr(`${(n / 1_000_000).toFixed(2)}M`);
          else if (n >= 1_000) setTickerGunr(`${(n / 1_000).toFixed(1)}K`);
          else setTickerGunr(n.toLocaleString(undefined, { maximumFractionDigits: 0 }));
        }
      } catch { /* non-critical */ }
    };
    fetchTicker();
    const id = setInterval(fetchTicker, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col">

      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <section className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-[0.3em] text-[var(--accent)]/60 uppercase">
          Base Network · $GUNR · Gunpla NFT TCG
        </div>

        <h1 className="mb-4 font-[family-name:var(--font-orbitron)] text-5xl font-black leading-tight tracking-tight text-white md:text-7xl">
          GUNDARIU<span className="text-[var(--accent-2)]">M</span>
        </h1>

        <p className="mb-2 text-lg text-[var(--foreground)]/60 md:text-xl">
          Roll your traits. Generate your legend.
        </p>
        <p className="mb-10 max-w-xl text-sm text-[var(--foreground)]/40 md:text-base">
          AI-generated kitbash Gundar-Frames minted as unique NFT battle cards on
          Base. Roll traits, forge your deck, dominate the arena.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/buy-gunr"
            className="rounded-full bg-[var(--accent)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_24px_var(--accent)]"
          >
            BUY GUNR 🔥
          </Link>
          <a
            href="#game-loop"
            className="rounded-full border border-[var(--accent-2)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-[var(--accent-2)] transition-all hover:bg-[var(--accent-2)] hover:text-white"
          >
            LEARN MORE
          </a>
        </div>
      </section>

      {/* ── LAUNCH COUNTDOWN (top) ──────────────────────────────────── */}
      <CountdownBanner />

      {/* ── 2. GAME LOOP ────────────────────────────────────────────── */}
      <section id="game-loop" className="px-4 py-20 bg-[var(--surface)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)] tracking-wider">
            HOW IT WORKS
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-center">
            {[
              { step: "01", icon: "🎲", title: "ROLL YOUR TRAITS", desc: "Pick a faction and roll unique kitbash traits — frame, weapons, colorway, and more. ~69 million possible combinations." },
              { step: "02", icon: "🤖", title: "AI GENERATES", desc: "Gemini AI renders a unique Mobile Suit from your traits — no two cards are the same." },
              { step: "03", icon: "⚔️", title: "MINT & BATTLE", desc: "Mint your card as an NFT on Base and build your battle team." },
            ].map((item, i) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute left-full top-10 w-full h-0.5 bg-gradient-to-r from-[var(--accent)]/40 to-transparent z-10" />
                )}
                <div className="mb-4 text-5xl">{item.icon}</div>
                <div className="mb-1 font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--accent)]/40 tracking-widest">
                  STEP {item.step}
                </div>
                <h3 className="mb-2 font-[family-name:var(--font-orbitron)] text-sm font-black text-[var(--accent)] tracking-wider">
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--foreground)]/60 max-w-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. FEATURE CARDS ────────────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center font-[family-name:var(--font-orbitron)] text-2xl font-black text-white tracking-wider">
            THE BATTLEFIELD AWAITS
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: "🎲",
                title: "AI-Generated Cards",
                desc: "Every card is a unique kitbashed Mobile Suit generated by AI from your trait roll. ~69 million possible combinations.",
              },
              {
                icon: "⚔️",
                title: "Turn-Based Combat",
                desc: "Choose from 4 weapons per turn. Armor types counter beam and physical attacks. Rare suits hit harder and crit more.",
              },
              {
                icon: "🏆",
                title: "$GUNR Economy",
                desc: "Stake $GUNR to enter PVP, upgrade your suit, and claim from daily, weekly, and monthly prize pools.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-left transition-all hover:border-[var(--accent)]/40 hover:shadow-[0_0_20px_var(--accent)]/10"
              >
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="mb-2 font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--accent)]">
                  {f.title}
                </h3>
                <p className="text-sm text-[var(--foreground)]/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. GUNR TOKEN ───────────────────────────────────────────── */}
      <section className="px-4 py-20 bg-[var(--surface)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)] tracking-wider">
            $GUNR TOKEN
          </h2>
          <p className="mb-12 text-center text-sm text-[var(--foreground)]/50">
            The fuel of the GundariuM economy · Live on Base
          </p>

          {/* Live ticker */}
          <div className="mb-10 flex items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-6 py-4 mx-auto max-w-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            <span className="text-sm text-[var(--foreground)]/50 font-mono">0.01 ETH =</span>
            <span className="font-[family-name:var(--font-orbitron)] text-lg font-black text-[var(--accent)]">
              {tickerGunr ? `${tickerGunr} GUNR` : "—"}
            </span>
            <span className="text-xs text-[var(--foreground)]/30 font-mono">OKX DEX</span>
          </div>

          {/* Token utility grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-12">
            {[
              { icon: "⚔️", label: "PVP Entry", desc: "Stake GUNR to enter ranked battles and tournaments" },
              { icon: "🔧", label: "Suit Upgrades", desc: "Spend GUNR to boost stats and unlock special weapons" },
              { icon: "🏆", label: "Prize Pools", desc: "Daily, weekly, and monthly GUNR pools for top commanders" },
            ].map((u) => (
              <div key={u.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5 text-center">
                <div className="text-2xl mb-2">{u.icon}</div>
                <div className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-[var(--accent)] mb-1 tracking-wider">{u.label}</div>
                <p className="text-xs text-[var(--foreground)]/50">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. FINAL CTA ─────────────────────────────────────────────── */}
      <section className="px-4 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 font-[family-name:var(--font-orbitron)] text-3xl font-black text-white md:text-5xl">
            Ready to fight?
          </h2>
          <p className="mb-10 text-[var(--foreground)]/50">
            Get your $GUNR. Mint your Gunpla. Enter the arena.
          </p>
          <Link
            href="/buy-gunr"
            className="inline-block rounded-full bg-[var(--accent)] px-12 py-4 font-[family-name:var(--font-orbitron)] text-lg font-black tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_var(--accent)]"
          >
            BUY GUNR 🔥
          </Link>
          <p className="mt-6 text-xs text-[var(--foreground)]/30">
            Powered by Base · Routed via 0x · GUNR:{" "}
            <a
              href="https://basescan.org/token/0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent)] transition-colors"
            >
              0x825E…DB07
            </a>
          </p>
        </div>
      </section>

      {/* ── LAUNCH COUNTDOWN (bottom) ───────────────────────────────── */}
      <CountdownBanner />

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-[var(--foreground)]/40">
            PyroFire Labs · 2026
          </div>
          <div className="flex gap-6">
            <a
              href="/GundariuMwhitepaper.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-[var(--accent-2)] transition-colors hover:text-[var(--accent)]"
            >
              WHITEPAPER
            </a>
            <Link
              href="/terms"
              className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-[var(--accent-2)] transition-colors hover:text-[var(--accent)]"
            >
              TERMS
            </Link>
            <Link
              href="/privacy"
              className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-[var(--accent-2)] transition-colors hover:text-[var(--accent)]"
            >
              PRIVACY
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
