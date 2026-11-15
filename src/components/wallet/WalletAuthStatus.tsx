"use client";

export function WalletAuthStatus({ error, pending }: { error: string | null; pending?: string | null }) {
  return (
    <>
      {error ? <p role="alert" className="max-w-sm text-sm text-red-400">{error}</p> : null}
      {pending ? <p role="status" aria-live="polite" className="text-sm text-[var(--foreground)]/70">{pending}</p> : null}
    </>
  );
}
