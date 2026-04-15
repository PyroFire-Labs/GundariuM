"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/stake", label: "Stake" },
  { href: "/migrate", label: "Migrate" },
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
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)] md:bg-[var(--surface)]/80 md:backdrop-blur-md">
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
            href="/buy-gunr"
            className={cn(
              "text-sm font-bold tracking-wide transition-colors",
              pathname === "/buy-gunr"
                ? "text-[var(--accent)]"
                : "text-[var(--accent)]/80 hover:text-[var(--accent)]"
            )}
          >
            Buy GUNR 🔥
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
            href="/buy-gunr"
            onClick={() => setMenuOpen(false)}
            className="text-sm font-bold text-[var(--accent)] py-1"
          >
            Buy GUNR 🔥
          </Link>
          <div className="pt-2 border-t border-[var(--border)]">
            <ConnectButton />
          </div>
        </div>
      )}
    </nav>
  );
}
