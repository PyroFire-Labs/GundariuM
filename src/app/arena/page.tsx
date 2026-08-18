"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Swords, Sparkles, Zap, Shield, Dices, Trophy, Wallet } from "lucide-react";
import { ShareButtons } from "@/components/ui/ShareButtons";
import { useArenaBattleShareVerification } from "@/lib/contracts/hooks/useArenaBattleShareVerification";
import { useCollection, type OwnedCard } from "@/lib/contracts/hooks/useCollection";
import { useNpcRoster } from "@/lib/contracts/hooks/useNpcRoster";
import { useModelStatus, type ModelStatusValue } from "@/lib/hooks/useModelStatus";
import { BattleModel3DViewer, type BattleModel3DHandle, type BattleMoveClip } from "@/components/battle/BattleModel3DViewer";
import {
  mulberry32,
  getWeapon,
  rollAttack,
  MAX_TURNS,
  PLAYER_CRIT_CHANCE,
  ENEMY_CRIT_CHANCE,
  type WeaponSlot,
  type BattleCard,
} from "@/lib/battle/deterministicSim";

type Fighter = BattleCard & { tokenId: bigint };

const MOVE_CLIPS: Record<WeaponSlot, BattleMoveClip> = {
  primary: "primary_attack",
  secondary: "secondary_attack",
  tertiary: "tertiary_attack",
  special: "special_attack",
};

function toFighter(owned: OwnedCard): Fighter {
  return { ...owned.traits, tokenId: owned.tokenId };
}

type LogEntry = {
  attacker: "player" | "enemy";
  attackerName: string;
  weapon: string;
  damage: number;
  isCrit: boolean;
  turnNumber: number;
};

type Phase = "picking" | "ready" | "player-pick" | "player-resolving" | "enemy-resolving" | "complete";

const SPECIAL_CHARGE_MAX = 3;

interface BattleState {
  player: Fighter | null;
  enemy: Fighter | null;
  playerHp: number;
  enemyHp: number;
  playerCharge: number;
  log: LogEntry[];
  turn: number;
  winner: "player" | "enemy" | null;
  phase: Phase;
  shake: "player" | "enemy" | null;
  flash: "player" | "enemy" | null;
  seed: number;
  moves: WeaponSlot[];
}

const INITIAL: BattleState = {
  player: null,
  enemy: null,
  playerHp: 0,
  enemyHp: 0,
  playerCharge: 0,
  log: [],
  turn: 0,
  winner: null,
  phase: "picking",
  shake: null,
  flash: null,
  seed: 0,
  moves: [],
};

export default function ArenaPage() {
  const { isConnected } = useAccount();
  const { cards: ownedCards, isLoading: collectionLoading } = useCollection();
  const { cards: npcCards, isLoading: npcLoading, isConfigured: npcConfigured } = useNpcRoster();

  const [playerCardIndex, setPlayerCardIndex] = useState(0);
  const [b, setB] = useState<BattleState>(INITIAL);

  const bRef = useRef<BattleState>(INITIAL);
  useEffect(() => {
    bRef.current = b;
  }, [b]);
  const rngRef = useRef<() => number>(mulberry32(0));

  const playerViewerRef = useRef<BattleModel3DHandle>(null);
  const enemyViewerRef = useRef<BattleModel3DHandle>(null);

  const selectedOwned = ownedCards[playerCardIndex] ?? null;
  const playerModelStatus = useModelStatus(selectedOwned?.tokenId ?? null);

  const startBattleWith = useCallback(
    (playerOwned: OwnedCard, enemyOwned: OwnedCard) => {
      const seed = Math.floor(Math.random() * 0xffffffff);
      rngRef.current = mulberry32(seed);
      const player = toFighter(playerOwned);
      const enemy = toFighter(enemyOwned);
      setB({
        ...INITIAL,
        player,
        enemy,
        playerHp: player.hp,
        enemyHp: enemy.hp,
        phase: "ready",
        seed,
      });
    },
    []
  );

  const pickRandomEnemy = useCallback(() => {
    if (!selectedOwned || npcCards.length === 0) return;
    const enemy = npcCards[Math.floor(Math.random() * npcCards.length)];
    startBattleWith(selectedOwned, enemy);
  }, [selectedOwned, npcCards, startBattleWith]);

  useEffect(() => {
    if (b.phase === "picking" && selectedOwned && npcCards.length > 0 && playerModelStatus.status === "ready") {
      // Same shape as the pre-existing setState-in-effect pattern in
      // useRunnerProfile.ts / useSiweSession.ts — a genuine "sync local
      // state once an external readiness condition is met" case, not
      // something derivable during render (pickRandomEnemy also mutates
      // rngRef, a non-React ref). phase flips away from "picking" on the
      // same tick this fires, so it can't cascade past one extra render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      pickRandomEnemy();
    }
  }, [b.phase, selectedOwned, npcCards, playerModelStatus.status, pickRandomEnemy]);

  // Phase-driven side effects — timing + animation triggers.
  useEffect(() => {
    if (b.phase === "player-resolving") {
      const tFlash = setTimeout(() => {
        setB((prev) => (prev.phase === "player-resolving" ? { ...prev, shake: null, flash: null } : prev));
      }, 500);
      const tNext = setTimeout(() => {
        const cur = bRef.current;
        if (cur.phase !== "player-resolving") return;
        if (cur.enemyHp <= 0) {
          setB((prev) => ({ ...prev, winner: "player", phase: "complete" }));
        } else {
          if (!cur.player || !cur.enemy) return;
          const slots: WeaponSlot[] = ["primary", "secondary", "tertiary"];
          const slot = slots[Math.floor(rngRef.current() * slots.length)];
          enemyViewerRef.current?.playMove(MOVE_CLIPS[slot]);
          const attack = rollAttack(cur.enemy, slot, cur.player, ENEMY_CRIT_CHANCE, rngRef.current);
          const newPlayerHp = Math.max(0, cur.playerHp - attack.damage);
          setB((prev) => ({
            ...prev,
            playerHp: newPlayerHp,
            log: [
              ...prev.log,
              {
                attacker: "enemy",
                attackerName: cur.enemy!.name,
                weapon: attack.weaponName,
                damage: attack.damage,
                isCrit: attack.isCrit,
                turnNumber: prev.turn,
              },
            ],
            phase: "enemy-resolving",
            shake: attack.isCrit ? "player" : null,
            flash: "player",
          }));
        }
      }, 1100);
      return () => {
        clearTimeout(tFlash);
        clearTimeout(tNext);
      };
    }

    if (b.phase === "enemy-resolving") {
      const tFlash = setTimeout(() => {
        setB((prev) => (prev.phase === "enemy-resolving" ? { ...prev, shake: null, flash: null } : prev));
      }, 500);
      const tNext = setTimeout(() => {
        const cur = bRef.current;
        if (cur.phase !== "enemy-resolving") return;
        if (cur.playerHp <= 0) {
          setB((prev) => ({ ...prev, winner: "enemy", phase: "complete" }));
        } else if (cur.turn >= MAX_TURNS) {
          if (!cur.player || !cur.enemy) return;
          const pPct = cur.playerHp / cur.player.hp;
          const ePct = cur.enemyHp / cur.enemy.hp;
          setB((prev) => ({ ...prev, winner: pPct >= ePct ? "player" : "enemy", phase: "complete" }));
        } else {
          setB((prev) => ({ ...prev, turn: prev.turn + 1, phase: "player-pick" }));
        }
      }, 1100);
      return () => {
        clearTimeout(tFlash);
        clearTimeout(tNext);
      };
    }
  }, [b.phase]);

  const submittedSeedRef = useRef<number | null>(null);
  useEffect(() => {
    if (b.phase !== "complete" || !b.winner || !b.player || !b.enemy) return;
    if (submittedSeedRef.current === b.seed) return;
    submittedSeedRef.current = b.seed;

    fetch("/api/federation/submit-battle-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: b.seed, moves: b.moves, player: b.player, enemy: b.enemy }),
    }).catch(() => {});
  }, [b.phase, b.winner, b.player, b.enemy, b.seed, b.moves]);

  const startBattle = () => {
    setB((prev) => ({ ...prev, phase: "player-pick", turn: 1 }));
  };

  const playerAttack = (slot: WeaponSlot) => {
    const cur = bRef.current;
    if (cur.phase !== "player-pick" || !cur.player || !cur.enemy) return;
    if (slot === "special" && cur.playerCharge < SPECIAL_CHARGE_MAX) return;

    playerViewerRef.current?.playMove(MOVE_CLIPS[slot]);
    const attack = rollAttack(cur.player, slot, cur.enemy, PLAYER_CRIT_CHANCE, rngRef.current);
    const newEnemyHp = Math.max(0, cur.enemyHp - attack.damage);
    const newCharge = slot === "special" ? 0 : Math.min(SPECIAL_CHARGE_MAX, cur.playerCharge + 1);

    setB((prev) => ({
      ...prev,
      enemyHp: newEnemyHp,
      playerCharge: newCharge,
      moves: [...prev.moves, slot],
      log: [
        ...prev.log,
        {
          attacker: "player",
          attackerName: cur.player!.name,
          weapon: attack.weaponName,
          damage: attack.damage,
          isCrit: attack.isCrit,
          turnNumber: prev.turn,
        },
      ],
      phase: "player-resolving",
      shake: attack.isCrit ? "enemy" : null,
      flash: "enemy",
    }));
  };

  const cycleOwnedCard = () => {
    if (ownedCards.length === 0) return;
    setPlayerCardIndex((i) => (i + 1) % ownedCards.length);
  };

  // ── Gates, in order: wallet -> owns a card -> NPC roster configured -> model ready ──

  if (!isConnected) {
    return (
      <GateScreen icon={<Wallet size={40} className="text-[var(--accent)]" />} title="CONNECT YOUR WALLET">
        Connect the wallet holding your Gundar-Frame to enter the Arena.
      </GateScreen>
    );
  }

  if (collectionLoading) {
    return <LoadingScreen label="READING YOUR COLLECTION..." />;
  }

  if (ownedCards.length === 0) {
    return (
      <GateScreen icon={<Swords size={40} className="text-[var(--accent)]" />} title="NO GUNDAR-FRAME FOUND">
        You need at least one minted Gundar-Frame to enter the Arena.
        <div className="mt-6">
          <Link
            href="/mint"
            className="inline-block rounded-full bg-[var(--accent)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-black transition-all hover:scale-105"
          >
            MINT ONE NOW
          </Link>
        </div>
      </GateScreen>
    );
  }

  if (!npcConfigured || (npcLoading && npcCards.length === 0)) {
    return (
      <GateScreen icon={<Shield size={40} className="text-[var(--accent)]" />} title="ARENA OPPONENTS LOADING">
        {npcConfigured ? "Reading the opponent roster..." : "No opponent roster is configured yet."}
      </GateScreen>
    );
  }

  if (playerModelStatus.status !== "ready") {
    return (
      <ModelWaitScreen
        status={playerModelStatus.status}
        cardName={selectedOwned?.traits.name ?? "your Gundar-Frame"}
        onSwitch={ownedCards.length > 1 ? cycleOwnedCard : undefined}
      />
    );
  }

  if (!b.player || !b.enemy || b.phase === "picking") {
    return <LoadingScreen label="ENTERING ARENA..." />;
  }

  const playerHpPct = (b.playerHp / b.player.hp) * 100;
  const enemyHpPct = (b.enemyHp / b.enemy.hp) * 100;

  return (
    <>
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        @keyframes flash {
          0% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.0); }
          50% { box-shadow: 0 0 32px 8px rgba(0, 212, 255, 0.5); }
          100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.0); }
        }
        .battle-shake { animation: shake 0.3s ease-in-out; }
        .battle-flash { animation: flash 0.6s ease-out; }
      `}</style>

      <main className="min-h-screen px-4 py-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 text-center">
            <div className="font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-[0.3em] text-[var(--accent)]/60 uppercase">
              PVE Arena · Your Gundar-Frame · 3D Turn-Based
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl font-black tracking-wider text-white md:text-3xl">
              ARENA
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-6 mb-6">
            <CardPanel
              card={b.player}
              hp={b.playerHp}
              hpPct={playerHpPct}
              charge={b.playerCharge}
              showCharge={true}
              side="player"
              shake={b.shake === "player"}
              flash={b.flash === "player"}
              winner={b.winner}
              viewerRef={playerViewerRef}
            />
            <CardPanel
              card={b.enemy}
              hp={b.enemyHp}
              hpPct={enemyHpPct}
              charge={0}
              showCharge={false}
              side="enemy"
              shake={b.shake === "enemy"}
              flash={b.flash === "enemy"}
              winner={b.winner}
              viewerRef={enemyViewerRef}
            />
          </div>

          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 min-h-[120px] max-h-[180px] overflow-y-auto">
            {b.log.length === 0 ? (
              <p className="text-center text-sm text-[var(--foreground)]/40 italic">
                {b.phase === "ready"
                  ? "Your Gundar-Frame has entered the arena. Press BEGIN BATTLE to start."
                  : "Battle log will appear here."}
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {b.log.slice(-6).map((entry, i) => (
                  <div key={`${entry.turnNumber}-${entry.attacker}-${i}`} className="flex items-baseline gap-2">
                    <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-bold text-[var(--foreground)]/40 tracking-widest shrink-0">
                      T{entry.turnNumber.toString().padStart(2, "0")}
                    </span>
                    <span className={`font-bold ${entry.attacker === "player" ? "text-[var(--accent)]" : "text-[var(--accent-2)]"}`}>
                      {entry.attackerName}
                    </span>
                    <span className="text-[var(--foreground)]/70">used</span>
                    <span className="text-white font-medium">{entry.weapon}</span>
                    <span className="text-[var(--foreground)]/40">·</span>
                    <span className={`font-[family-name:var(--font-orbitron)] font-black ${entry.isCrit ? "text-amber-300" : "text-white"}`}>
                      {entry.damage}
                    </span>
                    {entry.isCrit && (
                      <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-black text-amber-300 tracking-widest">
                        CRIT
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {b.phase === "ready" && (
            <div className="text-center">
              <button
                onClick={startBattle}
                className="rounded-full bg-[var(--accent)] px-12 py-4 font-[family-name:var(--font-orbitron)] text-base font-black tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_24px_var(--accent)]"
              >
                BEGIN BATTLE
              </button>
              <button
                onClick={pickRandomEnemy}
                className="ml-3 rounded-full border border-white/30 bg-[var(--background)]/40 px-6 py-3 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-white/80 transition-all hover:bg-white/10"
              >
                <Dices size={14} className="inline mr-2" /> NEW OPPONENT
              </button>
              {ownedCards.length > 1 && (
                <button
                  onClick={cycleOwnedCard}
                  className="ml-3 rounded-full border border-white/30 bg-[var(--background)]/40 px-6 py-3 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-white/80 transition-all hover:bg-white/10"
                >
                  SWITCH MY FRAME
                </button>
              )}
            </div>
          )}

          {(b.phase === "player-pick" || b.phase === "player-resolving" || b.phase === "enemy-resolving") && b.player && (
            <WeaponPicker
              card={b.player}
              charge={b.playerCharge}
              disabled={b.phase !== "player-pick"}
              onPick={playerAttack}
            />
          )}

          {b.phase === "complete" && b.winner && (
            <BattleOutcome
              winner={b.winner}
              playerName={b.player.name}
              enemyName={b.enemy.name}
              playerHpPct={playerHpPct}
              onAgain={pickRandomEnemy}
            />
          )}
        </div>
      </main>
    </>
  );
}

function GateScreen({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-4 flex justify-center">{icon}</div>
        <h1 className="font-[family-name:var(--font-orbitron)] text-lg font-black tracking-wider text-white mb-3">
          {title}
        </h1>
        <p className="text-sm text-[var(--foreground)]/60">{children}</p>
      </div>
    </main>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-[var(--foreground)]/50 font-[family-name:var(--font-orbitron)] text-sm tracking-widest">
        {label}
      </p>
    </main>
  );
}

function ModelWaitScreen({
  status,
  cardName,
  onSwitch,
}: {
  status: ModelStatusValue;
  cardName: string;
  onSwitch?: () => void;
}) {
  const message =
    status === "failed"
      ? "3D generation failed for this Gundar-Frame. Try switching to a different one."
      : "Every Gundar-Frame gets a real 3D model forged shortly after mint. This usually takes under a minute — the Arena needs it ready before you can fight.";
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-4 flex justify-center">
          <span className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)]/40" />
            <Swords size={28} className="relative text-[var(--accent)]" />
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-orbitron)] text-lg font-black tracking-wider text-white mb-3">
          FORGING {cardName.toUpperCase()}
        </h1>
        <p className="text-sm text-[var(--foreground)]/60">{message}</p>
        {onSwitch && (
          <button
            onClick={onSwitch}
            className="mt-6 rounded-full border border-white/30 bg-[var(--background)]/40 px-6 py-3 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-white/80 transition-all hover:bg-white/10"
          >
            TRY A DIFFERENT FRAME
          </button>
        )}
      </div>
    </main>
  );
}

function CardPanel({
  card,
  hp,
  hpPct,
  charge,
  showCharge,
  side,
  shake,
  flash,
  winner,
  viewerRef,
}: {
  card: Fighter;
  hp: number;
  hpPct: number;
  charge: number;
  showCharge: boolean;
  side: "player" | "enemy";
  shake: boolean;
  flash: boolean;
  winner: "player" | "enemy" | null;
  viewerRef: React.RefObject<BattleModel3DHandle | null>;
}) {
  const isWinner = winner === side;
  const isLoser = winner !== null && winner !== side;
  const sideAccent = side === "player" ? "text-[var(--accent)]" : "text-[var(--accent-2)]";
  const sideBg = side === "player" ? "bg-[var(--accent)]" : "bg-[var(--accent-2)]";

  let hpBarColor = "bg-[var(--accent)]";
  if (hpPct < 35) hpBarColor = "bg-orange-400";
  else if (hpPct < 65) hpBarColor = "bg-amber-300";

  return (
    <div
      className={`relative rounded-xl border bg-[var(--surface)] overflow-hidden transition-all ${
        shake ? "battle-shake" : ""
      } ${flash ? "battle-flash" : ""} ${
        isWinner
          ? "border-[var(--accent)] shadow-[0_0_32px_rgba(0,212,255,0.4)]"
          : isLoser
          ? "border-[var(--border)] opacity-50 grayscale"
          : "border-[var(--border)]"
      }`}
    >
      <div className="aspect-square relative overflow-hidden bg-[var(--background)]">
        <BattleModel3DViewer ref={viewerRef} tokenId={card.tokenId} name={card.name} className="w-full h-full" />
        <div className="absolute top-2 left-2 rounded px-2 py-1 backdrop-blur-sm border bg-[var(--background)]/70 border-[var(--border)]">
          <span className={`font-[family-name:var(--font-orbitron)] text-[9px] font-bold tracking-widest ${sideAccent}`}>
            {side === "player" ? "YOU" : "ENEMY"}
          </span>
        </div>
        {isWinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/50">
            <Trophy size={56} className="text-[var(--accent)]" />
          </div>
        )}
      </div>
      <div className="p-3 md:p-4">
        <div className="font-[family-name:var(--font-orbitron)] text-[9px] font-bold tracking-widest text-[var(--foreground)]/50 uppercase mb-1">
          {card.armorType}
        </div>
        <div className="font-[family-name:var(--font-orbitron)] text-sm font-black text-white truncate mb-2">
          {card.name}
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-[var(--foreground)]/60">HP</span>
            <span className="text-white font-bold">{hp} / {card.hp}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--background)] overflow-hidden">
            <div
              className={`h-full ${hpBarColor} transition-all duration-500 ease-out`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
        {showCharge ? (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-[var(--foreground)]/60">SPECIAL</span>
            <div className="flex gap-1 flex-1">
              {[...Array(SPECIAL_CHARGE_MAX)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < charge ? sideBg : "bg-[var(--background)]"
                  }`}
                />
              ))}
            </div>
            <span className="text-white font-bold">{charge}/{SPECIAL_CHARGE_MAX}</span>
          </div>
        ) : (
          <div className="h-[14px]" /> // spacer to keep card heights aligned
        )}
      </div>
    </div>
  );
}

function WeaponPicker({
  card,
  charge,
  disabled,
  onPick,
}: {
  card: Fighter;
  charge: number;
  disabled: boolean;
  onPick: (slot: WeaponSlot) => void;
}) {
  const specialReady = charge >= SPECIAL_CHARGE_MAX;
  const slots: { slot: WeaponSlot; Icon: typeof Swords; locked?: boolean }[] = [
    { slot: "primary", Icon: Zap },
    { slot: "secondary", Icon: Swords },
    { slot: "tertiary", Icon: Shield },
    { slot: "special", Icon: Sparkles, locked: !specialReady },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {slots.map(({ slot, Icon, locked }) => {
        const w = getWeapon(card, slot);
        const isDisabled = disabled || locked;
        const isSpecial = slot === "special";
        return (
          <button
            key={slot}
            onClick={() => onPick(slot)}
            disabled={isDisabled}
            className={`group rounded-xl border p-4 text-left transition-all ${
              isDisabled
                ? "border-[var(--border)] bg-[var(--surface)]/50 opacity-50 cursor-not-allowed"
                : isSpecial
                ? "border-[var(--accent)]/60 bg-[var(--accent)]/10 hover:bg-[var(--accent)] hover:text-black hover:scale-[1.02]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60 hover:bg-[var(--surface-2)]"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <Icon
                size={20}
                strokeWidth={1.75}
                className={`${
                  isSpecial && !locked
                    ? "text-[var(--accent)] group-hover:text-black"
                    : "text-[var(--accent)]"
                }`}
              />
              <span className="font-[family-name:var(--font-orbitron)] text-[9px] font-bold tracking-widest text-[var(--foreground)]/50">
                {w.label}
              </span>
            </div>
            <div className="font-[family-name:var(--font-orbitron)] text-xs font-black text-white truncate mb-1">
              {w.name}
            </div>
            <div className="font-mono text-[10px] text-[var(--foreground)]/60">
              {w.damage} DMG
              {locked && <span className="ml-2 text-amber-300">CHARGING</span>}
              {isSpecial && !locked && <span className="ml-2 text-[var(--accent)]">READY</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BattleOutcome({
  winner,
  playerName,
  enemyName,
  playerHpPct,
  onAgain,
}: {
  winner: "player" | "enemy";
  playerName: string;
  enemyName: string;
  playerHpPct: number;
  onAgain: () => void;
}) {
  const playerWon = winner === "player";
  const battleShareVerification = useArenaBattleShareVerification({
    playerName,
    enemyName,
    won: playerWon,
    hpPct: playerHpPct,
  });
  return (
    <div className="text-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 md:p-10">
      <div className={`mb-3 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-[0.3em] uppercase ${playerWon ? "text-[var(--accent)]" : "text-orange-300"}`}>
        {playerWon ? "Victory" : "Defeat"}
      </div>
      <h2 className="font-[family-name:var(--font-orbitron)] text-3xl font-black text-white tracking-wider mb-2 md:text-4xl">
        {playerWon ? playerName : enemyName} WINS
      </h2>
      <p className="text-sm text-[var(--foreground)]/50 mb-8">
        {playerWon
          ? "You routed your opponent. The arena recognizes your frame."
          : "Your frame fell. The opponent stands. Adjust the rotation, try again."}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onAgain}
          className="rounded-full bg-[var(--accent)] px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_24px_var(--accent)]"
        >
          BATTLE AGAIN
        </button>
        <Link
          href="/mint"
          className="rounded-full border border-[var(--accent-2)] bg-[var(--background)]/40 px-8 py-3 font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider text-[var(--accent-2)] backdrop-blur-sm transition-all hover:bg-[var(--accent-2)] hover:text-white"
        >
          MINT YOUR OWN
        </Link>
      </div>
      <div className="mt-4">
        <ShareButtons
          battle={{ playerName, enemyName, hpPct: playerHpPct, won: playerWon }}
          verified={battleShareVerification}
        />
      </div>
    </div>
  );
}
