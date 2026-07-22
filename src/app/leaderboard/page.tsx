import Link from "next/link";
import { getLeaderboardCache } from "@/lib/leaderboardStore";

export const revalidate = 300; // 5 min — cheap since this just reads the cron-refreshed cache

function short(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function LeaderboardPage() {
  const cache = await getLeaderboardCache();
  const entries = cache?.entries ?? [];

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center px-4 py-12 gap-8">
      <div className="text-center space-y-2 max-w-lg">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl md:text-4xl font-bold text-[var(--accent)] tracking-wider">
          LEADERBOARD
        </h1>
        <p className="text-[var(--foreground)]/60 text-sm">
          Ranked by Frame-Runner EXP — daily streaks, check-ins, and cards minted.
        </p>
        {cache && (
          <p className="text-[var(--foreground)]/30 text-xs">
            Updated {new Date(cache.updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {entries.length === 0 && (
        <p className="text-[var(--foreground)]/40 text-sm py-12">
          No rankings yet — check back after the first Daily Check-In or mint lands.
        </p>
      )}

      {entries.length > 0 && (
        <div className="w-full max-w-2xl flex flex-col gap-2">
          {entries.map((entry, i) => (
            <Link
              key={entry.address}
              href={`/dossier/${entry.address}`}
              className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]/50 transition-colors"
            >
              <div
                className={`font-[family-name:var(--font-orbitron)] text-lg font-bold w-8 text-center shrink-0 ${
                  i === 0
                    ? "text-[var(--accent)]"
                    : i === 1
                      ? "text-[var(--foreground)]/70"
                      : i === 2
                        ? "text-orange-400"
                        : "text-[var(--foreground)]/30"
                }`}
              >
                {i + 1}
              </div>
              {entry.pfpUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.pfpUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--border)] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--foreground)] truncate">
                  {entry.runnerName ||
                    (entry.farcasterUsername ? `@${entry.farcasterUsername}` : short(entry.address))}
                </div>
                <div className="text-xs text-[var(--foreground)]/40">
                  {entry.currentStreak}d streak · {entry.totalCheckIns} check-ins · {entry.mintedCount} cards
                </div>
              </div>
              <div className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--accent)] shrink-0">
                {entry.exp.toLocaleString()} XP
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
