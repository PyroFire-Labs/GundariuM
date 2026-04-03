export default function StakePage() {
  return (
    <main className="min-h-screen px-4 py-12 flex items-center justify-center">
      <div className="mx-auto max-w-lg text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full border-2 border-yellow-500/40 bg-yellow-500/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-black tracking-wider text-[var(--accent)]">
          STAKING CLOSED
        </h1>

        <p className="text-[var(--foreground)]/60 text-sm leading-relaxed max-w-md mx-auto">
          The GNDM staking contract is currently closed for maintenance.
          We&apos;re upgrading the system and will be back online soon.
        </p>

        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-6 py-4">
          <p className="font-[family-name:var(--font-orbitron)] text-xs font-bold text-yellow-400 tracking-widest uppercase">
            MAINTENANCE IN PROGRESS
          </p>
          <p className="text-xs text-[var(--foreground)]/40 mt-2">
            Existing stakes are safe. No action is required on your part.
          </p>
        </div>
      </div>
    </main>
  );
}
