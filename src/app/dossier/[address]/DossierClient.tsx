"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { CollectionCard } from "@/components/collection/CollectionCard";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { useCollection, type OwnedCard } from "@/lib/contracts/hooks/useCollection";
import { useDailyCheckInStats } from "@/lib/contracts/hooks/useDailyCheckInStats";
import { useSaveLineup } from "@/lib/contracts/hooks/useSaveLineup";
import { markDossierSharedToday } from "@/lib/dossierShareTask";
import { ipfsToHttp } from "@/lib/ipfs";
import type { RunnerProfile } from "@/types/runner";

const MAX_SUPPORT = 4;

function short(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function DossierClient({ address }: { address: `0x${string}` }) {
  const { address: connectedAddress } = useAccount();
  const isOwner = connectedAddress?.toLowerCase() === address.toLowerCase();

  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfileLoading(true);
    fetch(`/api/runner-profile/${address}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const stats = useDailyCheckInStats(address);
  const { cards, isLoading: cardsLoading, count } = useCollection(address);

  const [editing, setEditing] = useState(false);
  const [draftHero, setDraftHero] = useState<number | null>(null);
  const [draftSupport, setDraftSupport] = useState<number[]>([]);
  const { saveLineup, phase: savePhase, error: saveError, reset: resetSave } = useSaveLineup();

  // Seed the draft from the saved lineup once it's loaded, but only before
  // the owner has started editing — don't clobber in-progress picks if the
  // profile refetches mid-edit.
  useEffect(() => {
    if (!editing && profile?.lineup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftHero(profile.lineup.hero);
      setDraftSupport(profile.lineup.support);
    }
  }, [profile, editing]);

  const displayName =
    profile?.runnerName ||
    (profile?.farcasterUsername ? `@${profile.farcasterUsername}` : null) ||
    short(address);

  const heroTokenId = editing ? draftHero : profile?.lineup?.hero ?? null;

  const heroCard = useMemo(
    () => cards.find((c) => Number(c.tokenId) === heroTokenId) ?? null,
    [cards, heroTokenId]
  );
  const supportCards = useMemo(() => {
    const supportTokenIds = editing ? draftSupport : profile?.lineup?.support ?? [];
    return supportTokenIds
      .map((id) => cards.find((c) => Number(c.tokenId) === id))
      .filter((c): c is OwnedCard => !!c);
  }, [cards, editing, draftSupport, profile?.lineup?.support]);

  const toggleSupport = (tokenId: number) => {
    setDraftSupport((prev) =>
      prev.includes(tokenId)
        ? prev.filter((id) => id !== tokenId)
        : prev.length < MAX_SUPPORT
          ? [...prev, tokenId]
          : prev
    );
  };

  const hasChanges =
    draftHero !== (profile?.lineup?.hero ?? null) ||
    JSON.stringify(draftSupport) !== JSON.stringify(profile?.lineup?.support ?? []);

  const handleSave = async () => {
    if (draftHero === null) return;
    const ok = await saveLineup(draftHero, draftSupport);
    if (ok) {
      setProfile((prev) =>
        prev ? { ...prev, lineup: { hero: draftHero, support: draftSupport } } : prev
      );
      setEditing(false);
    }
  };

  // Stable, cumulative EXP subset — same components the redesigned share
  // image uses. Deliberately omits /tasks' today-only flags (staked today,
  // bought GNRM today, submitted the form today), which aren't meaningful
  // when viewing an arbitrary address and aren't cheaply verifiable here.
  const exp =
    stats.currentStreak * 10 +
    stats.totalCheckIns * 5 +
    count * 25 +
    (stats.perfectWeek ? 200 : 0);

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center px-4 py-12 gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        {profile?.pfpUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.pfpUrl} alt="" className="w-16 h-16 rounded-full border-2 border-[var(--accent)]/50" />
        )}
        <h1 className="font-[family-name:var(--font-orbitron)] text-2xl md:text-3xl font-bold text-[var(--accent)] tracking-wide">
          {profileLoading ? "Loading..." : displayName}
        </h1>
        <p className="text-[var(--foreground)]/40 text-xs font-mono">{short(address)}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 w-full">
        <StatBox label="Daily Streak" value={stats.currentStreak} />
        <StatBox label="Longest" value={stats.longestStreak} />
        <StatBox label="Check-Ins" value={stats.totalCheckIns} />
        <StatBox label="Cards" value={count} />
        <StatBox
          label="This Week"
          value={`${Math.min(stats.checkInsThisWeek, 7)}/7`}
          highlight={stats.perfectWeek}
        />
      </div>

      {/* Starting lineup */}
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-orbitron)] text-sm tracking-[0.2em] text-[var(--foreground)]/60">
            STARTING LINEUP
          </h2>
          {isOwner && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-[family-name:var(--font-orbitron)] text-[var(--accent)] hover:brightness-110"
            >
              EDIT
            </button>
          )}
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-4 items-start justify-center">
            <LineupSlot card={heroCard} label="HERO" empty={!heroTokenId} large />
            {Array.from({ length: MAX_SUPPORT }).map((_, i) => (
              <LineupSlot
                key={i}
                card={supportCards[i] ?? null}
                label={`SUPPORT ${i + 1}`}
                empty={!supportCards[i]}
              />
            ))}
            {!heroTokenId && (
              <p className="text-sm text-[var(--foreground)]/40 self-center">
                {isOwner ? "No lineup set yet — click EDIT to choose one." : "This Runner hasn't set a lineup yet."}
              </p>
            )}
          </div>
        )}

        {editing && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--foreground)]/50">
              Click a card to set your hero. Click up to {MAX_SUPPORT} more to fill your support squad — they deploy in the order picked if your hero falls.
            </p>

            {cardsLoading && (
              <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/50">
                <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                Loading your collection...
              </div>
            )}

            {!cardsLoading && cards.length === 0 && (
              <p className="text-sm text-[var(--foreground)]/50">You don&apos;t own any Gundar-Frames yet.</p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {cards.map((card) => {
                const id = Number(card.tokenId);
                const isHero = draftHero === id;
                const supportIndex = draftSupport.indexOf(id);
                const isSupport = supportIndex !== -1;
                return (
                  <div key={id} className="flex flex-col gap-2">
                    <div
                      className={`rounded-lg border-2 transition-all ${
                        isHero
                          ? "border-[var(--accent)]"
                          : isSupport
                            ? "border-[var(--accent-2)]"
                            : "border-transparent"
                      }`}
                    >
                      <CollectionCard card={card} ownerAddress={address} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDraftHero(id)}
                        disabled={isHero}
                        className="flex-1 text-[10px] font-[family-name:var(--font-orbitron)] py-1.5 rounded border border-[var(--border)] text-[var(--foreground)]/60 hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-default"
                      >
                        {isHero ? "HERO ✓" : "SET HERO"}
                      </button>
                      <button
                        onClick={() => toggleSupport(id)}
                        disabled={isHero || (!isSupport && draftSupport.length >= MAX_SUPPORT)}
                        className="flex-1 text-[10px] font-[family-name:var(--font-orbitron)] py-1.5 rounded border border-[var(--border)] text-[var(--foreground)]/60 hover:border-[var(--accent-2)] disabled:opacity-40 disabled:cursor-default"
                      >
                        {isSupport ? `SQUAD #${supportIndex + 1} ✕` : "ADD TO SQUAD"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {saveError && <p className="text-red-400 text-sm">{saveError}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={draftHero === null || !hasChanges || savePhase === "signing" || savePhase === "saving"}
                className="px-6 py-2.5 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savePhase === "signing" ? "SIGN IN WALLET..." : savePhase === "saving" ? "SAVING..." : "SAVE LINEUP"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  resetSave();
                  setDraftHero(profile?.lineup?.hero ?? null);
                  setDraftSupport(profile?.lineup?.support ?? []);
                }}
                className="px-6 py-2.5 border border-[var(--border)] text-[var(--foreground)]/60 text-sm rounded-lg hover:border-[var(--foreground)]/30 transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>

      {isOwner && !editing && (
        <ShareButtons
          dossier={{ address, streak: stats.currentStreak, exp }}
          onShare={markDossierSharedToday}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${highlight ? "border-[var(--accent)]" : "border-[var(--border)]"}`}>
      <div className="text-[10px] tracking-[0.15em] text-[var(--foreground)]/40 font-[family-name:var(--font-orbitron)] mb-1">
        {label.toUpperCase()}
      </div>
      <div className="text-xl font-bold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function LineupSlot({
  card,
  label,
  empty,
  large,
}: {
  card: OwnedCard | null;
  label: string;
  empty: boolean;
  large?: boolean;
}) {
  const size = large ? "w-40 h-40" : "w-24 h-24";
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!card) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImageUrl(null);
      return;
    }
    let cancelled = false;
    fetch(ipfsToHttp(card.tokenUri))
      .then((r) => r.json())
      .then((meta) => {
        if (!cancelled && meta?.image) setImageUrl(ipfsToHttp(meta.image));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [card]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`${size} rounded-lg border ${empty ? "border-dashed border-[var(--border)]" : "border-[var(--accent)]/50"} bg-[var(--surface)] flex items-center justify-center overflow-hidden`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[var(--foreground)]/20 text-[10px]">EMPTY</span>
        )}
      </div>
      <span className="text-[9px] tracking-[0.15em] text-[var(--foreground)]/40 font-[family-name:var(--font-orbitron)]">
        {label}
      </span>
    </div>
  );
}
