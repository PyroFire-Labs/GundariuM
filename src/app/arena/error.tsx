"use client";

import { useEffect } from "react";
import Link from "next/link";

// The Arena has no error boundary today, so any render-time throw (a bad
// animation clip lookup, a null fighter mid-battle, etc.) falls through to
// Next's generic "Application error: a client-side exception has occurred"
// screen with zero detail — that's what's been crashing battles. This
// boundary catches it at the /arena segment and surfaces the real message
// on screen so the next occurrence is diagnosable instead of a black box.
export default function ArenaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[arena] client-side exception:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-[family-name:var(--font-orbitron)] text-lg font-black tracking-wider text-white mb-3">
          ARENA CRASHED
        </h1>
        <p className="text-sm text-[var(--foreground)]/60 mb-2">
          Something threw during battle. Screenshot this and send it over:
        </p>
        <p className="text-xs font-mono text-orange-300 break-words bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 mb-6 text-left">
          {error.message || "(no message)"}
          {error.digest && <span className="block mt-1 text-[var(--foreground)]/40">digest: {error.digest}</span>}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-full bg-[var(--accent)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-black transition-all hover:scale-105"
          >
            TRY AGAIN
          </button>
          <Link
            href="/mint"
            className="rounded-full border border-white/30 bg-[var(--background)]/40 px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-white/80 transition-all hover:bg-white/10"
          >
            LEAVE ARENA
          </Link>
        </div>
      </div>
    </main>
  );
}
