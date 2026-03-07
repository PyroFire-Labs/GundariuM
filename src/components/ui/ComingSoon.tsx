export function ComingSoon({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 gap-4 text-center">
      <p className="text-[var(--foreground)]/20 font-[family-name:var(--font-orbitron)] text-xs tracking-[0.3em] uppercase">
        Under Construction
      </p>
      <h1 className="font-[family-name:var(--font-orbitron)] text-5xl font-black text-[var(--accent)] tracking-wider">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[var(--foreground)]/50 text-sm max-w-xs">{subtitle}</p>
      )}
      <div className="mt-4 px-5 py-2 rounded-full border border-[var(--accent)]/30 text-[var(--accent)]/60 font-[family-name:var(--font-orbitron)] text-xs tracking-widest">
        COMING SOON
      </div>
    </div>
  );
}
