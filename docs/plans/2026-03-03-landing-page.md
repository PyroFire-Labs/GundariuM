# Landing Page + Navbar Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a responsive navbar with all page links and a full marketing home page (game pitch + token section + buy CTA).

**Architecture:** Rewrite `Navbar.tsx` with React state hamburger toggle for mobile. Rewrite `src/app/page.tsx` as a 5-section scroll page — hero, game loop, feature cards, GNDM token, final CTA. No new npm packages. Middleware and `/buy-gndm` untouched.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, wagmi, Orbitron + Geist fonts, existing `/api/gndm-quote` API route.

---

### Task 1: Responsive Navbar

**Files:**
- Modify: `src/components/nav/Navbar.tsx`

**Step 1: Replace Navbar.tsx with responsive implementation**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/mint", label: "Mint" },
  { href: "/arena", label: "Arena" },
  { href: "/battle", label: "Battle" },
  { href: "/collection", label: "Collection" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          className="font-[family-name:var(--font-orbitron)] text-xl font-black tracking-wider text-[var(--accent)] hover:text-white transition-colors shrink-0"
        >
          GUNDARIU<span className="text-[var(--accent-2)]">M</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-5 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium tracking-wide transition-colors hover:text-[var(--accent)]",
                pathname === link.href
                  ? "text-[var(--accent)]"
                  : "text-[var(--foreground)]/60"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/buy-gndm"
            className={cn(
              "text-sm font-bold tracking-wide transition-colors",
              pathname === "/buy-gndm"
                ? "text-[var(--accent)]"
                : "text-[var(--accent)]/80 hover:text-[var(--accent)]"
            )}
          >
            Buy GNDM 🔥
          </Link>
        </div>

        {/* Desktop wallet + mobile hamburger */}
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <ConnectButton />
          </div>
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className={cn("block h-0.5 w-6 bg-[var(--foreground)] transition-all", menuOpen && "translate-y-2 rotate-45")} />
            <span className={cn("block h-0.5 w-6 bg-[var(--foreground)] transition-all", menuOpen && "opacity-0")} />
            <span className={cn("block h-0.5 w-6 bg-[var(--foreground)] transition-all", menuOpen && "-translate-y-2 -rotate-45")} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "text-sm font-medium py-1 transition-colors hover:text-[var(--accent)]",
                pathname === link.href ? "text-[var(--accent)]" : "text-[var(--foreground)]/70"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/buy-gndm"
            onClick={() => setMenuOpen(false)}
            className="text-sm font-bold text-[var(--accent)] py-1"
          >
            Buy GNDM 🔥
          </Link>
          <div className="pt-2 border-t border-[var(--border)]">
            <ConnectButton />
          </div>
        </div>
      )}
    </nav>
  );
}
```

**Step 2: Type-check**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next && npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/components/nav/Navbar.tsx
git commit -m "feat: responsive navbar with mobile hamburger menu and all page links"
```

---

### Task 2: Home Page — Hero + Game Loop sections

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace page.tsx with hero + game loop sections (keep the rest as TODO placeholder)**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits, parseEther } from "viem";

export default function Home() {
  const [tickerGndm, setTickerGndm] = useState<string | null>(null);

  useEffect(() => {
    const TICKER_SELL = parseEther("0.01").toString();
    const fetchTicker = async () => {
      try {
        const res = await fetch(`/api/gndm-quote?sellAmount=${TICKER_SELL}`);
        const json = await res.json();
        if (json.buyAmount) {
          const n = parseFloat(formatUnits(BigInt(json.buyAmount), 18));
          if (n >= 1_000_000) setTickerGndm(`${(n / 1_000_000).toFixed(2)}M`);
          else if (n >= 1_000) setTickerGndm(`${(n / 1_000).toFixed(1)}K`);
          else setTickerGndm(n.toLocaleString(undefined, { maximumFractionDigits: 0 }));
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
          Base Network · $GNDM · Gunpla NFT TCG
        </div>

        <h1 className="mb-4 font-[family-name:var(--font-orbitron)] text-5xl font-black leading-tight tracking-tight text-white md:text-7xl">
          GUNDARIU<span className="text-[var(--accent-2)]">M</span>
        </h1>

        <p className="mb-2 text-lg text-[var(--foreground)]/60 md:text-xl">
          Digitize your Gunpla. Forge your legend.
        </p>
        <p className="mb-10 max-w-xl text-sm text-[var(--foreground)]/40 md:text-base">
          Photograph your Mobile Suit model kits, mint them as unique NFT trading
          cards on Base, then battle across the Gundam multiverse.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/buy-gndm"
            className="rounded-full bg-[var(--accent)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_24px_var(--accent)]"
          >
            BUY GNDM 🔥
          </Link>
          <a
            href="#game-loop"
            className="rounded-full border border-[var(--accent-2)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-[var(--accent-2)] transition-all hover:bg-[var(--accent-2)] hover:text-white"
          >
            LEARN MORE
          </a>
        </div>
      </section>

      {/* ── 2. GAME LOOP ────────────────────────────────────────────── */}
      <section id="game-loop" className="px-4 py-20 bg-[var(--surface)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)] tracking-wider">
            HOW IT WORKS
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-center">
            {[
              { step: "01", icon: "📸", title: "PHOTOGRAPH", desc: "Snap your Gunpla model kit. AI identifies the Mobile Suit and assigns lore-accurate stats, weapons, and faction." },
              { step: "02", icon: "🤖", title: "AI MINTS", desc: "Your photo becomes a unique NFT trading card on Base. Every card has rarity, armor type, and a full weapon loadout." },
              { step: "03", icon: "⚔️", title: "BATTLE", desc: "Take your card into the arena. Choose 4 weapons per turn. Armor counters matter. Rare suits hit harder and crit more." },
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
                icon: "📸",
                title: "Photo → NFT",
                desc: "AI identifies your Mobile Suit and assigns lore-accurate weapons, stats, and faction from the Gundam universe.",
              },
              {
                icon: "⚔️",
                title: "Turn-Based Combat",
                desc: "Choose from 4 weapons per turn. Armor types counter beam and physical attacks. Rare suits hit harder and crit more.",
              },
              {
                icon: "🏆",
                title: "$GNDM Economy",
                desc: "Stake $GNDM to enter PVP, upgrade your suit, and claim from daily, weekly, and monthly prize pools.",
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

      {/* ── 4. GNDM TOKEN ───────────────────────────────────────────── */}
      <section className="px-4 py-20 bg-[var(--surface)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)] tracking-wider">
            $GNDM TOKEN
          </h2>
          <p className="mb-12 text-center text-sm text-[var(--foreground)]/50">
            The fuel of the GundariuM economy · Live on Base
          </p>

          {/* Live ticker */}
          <div className="mb-10 flex items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-6 py-4 mx-auto max-w-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            <span className="text-sm text-[var(--foreground)]/50 font-mono">0.01 ETH =</span>
            <span className="font-[family-name:var(--font-orbitron)] text-lg font-black text-[var(--accent)]">
              {tickerGndm ? `${tickerGndm} GNDM` : "—"}
            </span>
            <span className="text-xs text-[var(--foreground)]/30 font-mono">OKX DEX</span>
          </div>

          {/* Token utility grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-12">
            {[
              { icon: "⚔️", label: "PVP Entry", desc: "Stake GNDM to enter ranked battles and tournaments" },
              { icon: "🔧", label: "Suit Upgrades", desc: "Spend GNDM to boost stats and unlock special weapons" },
              { icon: "🏆", label: "Prize Pools", desc: "Daily, weekly, and monthly GNDM pools for top commanders" },
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
            Get your $GNDM. Mint your Gunpla. Enter the arena.
          </p>
          <Link
            href="/buy-gndm"
            className="inline-block rounded-full bg-[var(--accent)] px-12 py-4 font-[family-name:var(--font-orbitron)] text-lg font-black tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_40px_var(--accent)]"
          >
            BUY GNDM 🔥
          </Link>
          <p className="mt-6 text-xs text-[var(--foreground)]/30">
            Powered by Base · Routed via 0x · GNDM:{" "}
            <a
              href="https://basescan.org/token/0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent)] transition-colors"
            >
              0xfc70…4ba3
            </a>
          </p>
        </div>
      </section>

    </div>
  );
}
```

**Step 2: Type-check**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next && npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: marketing home page with hero, game loop, feature cards, token section, CTA"
```

---

### Task 3: Deploy to production

**Step 1: Deploy**

```bash
cd /Users/joshuagrubbs/basement-gunpla-next && npx vercel --prod
```

**Step 2: Alias to production domain**

```bash
npx vercel alias <deployment-url> gundarium.vercel.app
```

**Step 3: Verify live**

Open https://gundarium.vercel.app — confirm:
- [ ] Navbar shows all links on desktop
- [ ] Hamburger menu works on mobile
- [ ] Home page scrolls through all 5 sections
- [ ] Live GNDM ticker loads
- [ ] "BUY GNDM" buttons link to `/buy-gndm`
- [ ] Wallet connect still works
