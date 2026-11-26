export function LaunchPlaceholder() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#05080f] px-6 py-16 text-center text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,212,255,0.16),transparent_36%),radial-gradient(circle_at_18%_80%,rgba(124,58,237,0.15),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-5 border border-cyan-300/10 sm:inset-8" />

      <section className="relative max-w-3xl">
        <p className="mb-8 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-[0.35em] text-cyan-300/75 uppercase sm:text-sm">
          Development in progress
        </p>
        <h1 className="font-[family-name:var(--font-orbitron)] text-5xl font-black tracking-tight text-white sm:text-7xl">
          GUNDARIU<span className="text-cyan-300">M</span>
        </h1>
        <div className="mx-auto my-9 h-px w-24 bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        <p className="text-lg leading-relaxed text-slate-300 sm:text-2xl">
          Jim 2.0, the integrated 3-D world environment, will be launching sometime before January 1, 2027.
        </p>
        <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">
          GundariuM is temporarily offline while the full experience is completed.
        </p>
      </section>
    </main>
  );
}
