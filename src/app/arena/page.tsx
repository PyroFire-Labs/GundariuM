"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Swords, Sparkles, Zap, Shield, Dices, Trophy } from "lucide-react";

type Card = {
  id: number;
  image: string;
  name: string;
  series: string;
  faction: string;
  rarity: string;
  hp: number;
  armorType: string;
  primaryWeapon: string;
  primaryDamage: number;
  secondaryWeapon: string;
  secondaryDamage: number;
  tertiaryWeapon: string;
  tertiaryDamage: number;
  specialAttack: string;
  specialDamage: number;
};

type WeaponSlot = "primary" | "secondary" | "tertiary" | "special";

type LogEntry = {
  attacker: "player" | "enemy";
  attackerName: string;
  weapon: string;
  damage: number;
  isCrit: boolean;
  turnNumber: number;
};

type Phase = "loading" | "ready" | "player-pick" | "player-resolving" | "enemy-resolving" | "complete";

const SPECIAL_CHARGE_MAX = 3;
const MAX_TURNS = 30;
const PLAYER_CRIT_CHANCE = 0.10;
const ENEMY_CRIT_CHANCE = 0.05;
const CRIT_MULTIPLIER = 1.6;

function armorMultiplier(slot: WeaponSlot, armor: string): number {
  switch (armor) {
    case "I-Field":
      return slot === "secondary" ? 1.0 : 0.45;
    case "Phase Shift":
      return slot === "secondary" ? 0.15 : 1.0;
    case "Gundanium":
      return 0.80;
    case "GN Particle":
      return slot === "secondary" ? 1.0 : 0.65;
    case "Luna Titanium":
      return slot === "secondary" ? 0.60 : 1.0;
    default:
      return 1.0;
  }
}

function getWeapon(card: Card, slot: WeaponSlot) {
  switch (slot) {
    case "primary":
      return { name: card.primaryWeapon, damage: card.primaryDamage, label: "PRIMARY" };
    case "secondary":
      return { name: card.secondaryWeapon, damage: card.secondaryDamage, label: "SECONDARY" };
    case "tertiary":
      return { name: card.tertiaryWeapon, damage: card.tertiaryDamage, label: "TERTIARY" };
    case "special":
      return { name: card.specialAttack, damage: card.specialDamage, label: "SPECIAL" };
  }
}

function rollAttack(attacker: Card, slot: WeaponSlot, defender: Card, critChance: number) {
  const weapon = getWeapon(attacker, slot);
  const mult = armorMultiplier(slot, defender.armorType);
  const isCrit = Math.random() < critChance;
  const critMult = isCrit ? CRIT_MULTIPLIER : 1;
  const damage = Math.max(1, Math.round(weapon.damage * mult * critMult));
  return { damage, isCrit, weaponName: weapon.name };
}

interface BattleState {
  player: Card | null;
  enemy: Card | null;
  playerHp: number;
  enemyHp: number;
  playerCharge: number;
  log: LogEntry[];
  turn: number;
  winner: "player" | "enemy" | null;
  phase: Phase;
  shake: "player" | "enemy" | null;
  flash: "player" | "enemy" | null;
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
  phase: "loading",
  shake: null,
  flash: null,
};

export default function ArenaPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [b, setB] = useState<BattleState>(INITIAL);

  // Mirror state in a ref so timeouts can always read the latest values.
  // (We only mutate state through setB; this ref is read-only-after-render.)
  const bRef = useRef<BattleState>(INITIAL);
  bRef.current = b;

  useEffect(() => {
    fetch("/gallery/cards.json")
      .then((r) => r.json())
      .then((data: Card[]) => setCards(data));
  }, []);

  const pickRandomBattle = useCallback(() => {
    if (cards.length < 2) return;
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setB({
      ...INITIAL,
      player: shuffled[0],
      enemy: shuffled[1],
      playerHp: shuffled[0].hp,
      enemyHp: shuffled[1].hp,
      phase: "ready",
    });
  }, [cards]);

  useEffect(() => {
    if (cards.length >= 2 && b.phase === "loading") {
      pickRandomBattle();
    }
  }, [cards, b.phase, pickRandomBattle]);

  // Phase-driven side effects. State updaters stay PURE; all setTimeout calls live here.
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
          // Enemy attacks — random weapon (NEVER special, even if conceptually charged)
          if (!cur.player || !cur.enemy) return;
          const slots: WeaponSlot[] = ["primary", "secondary", "tertiary"];
          const slot = slots[Math.floor(Math.random() * slots.length)];
          const attack = rollAttack(cur.enemy, slot, cur.player, ENEMY_CRIT_CHANCE);
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

  const startBattle = () => {
    setB((prev) => ({ ...prev, phase: "player-pick", turn: 1 }));
  };

  const playerAttack = (slot: WeaponSlot) => {
    const cur = bRef.current;
    if (cur.phase !== "player-pick" || !cur.player || !cur.enemy) return;
    if (slot === "special" && cur.playerCharge < SPECIAL_CHARGE_MAX) return;

    const attack = rollAttack(cur.player, slot, cur.enemy, PLAYER_CRIT_CHANCE);
    const newEnemyHp = Math.max(0, cur.enemyHp - attack.damage);
    const newCharge = slot === "special" ? 0 : Math.min(SPECIAL_CHARGE_MAX, cur.playerCharge + 1);

    setB((prev) => ({
      ...prev,
      enemyHp: newEnemyHp,
      playerCharge: newCharge,
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

  if (!b.player || !b.enemy || b.phase === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-[var(--foreground)]/50 font-[family-name:var(--font-orbitron)] text-sm tracking-widest">
          LOADING ARENA...
        </p>
      </main>
    );
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
              Demo Battle · Sepolia Mints · Turn-Based
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
            />
          </div>

          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 min-h-[120px] max-h-[180px] overflow-y-auto">
            {b.log.length === 0 ? (
              <p className="text-center text-sm text-[var(--foreground)]/40 italic">
                {b.phase === "ready"
                  ? "Two random Gundar-Frames have entered the arena. Press BEGIN BATTLE to start."
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
                onClick={pickRandomBattle}
                className="ml-3 rounded-full border border-white/30 bg-[var(--background)]/40 px-6 py-3 font-[family-name:var(--font-orbitron)] text-xs font-bold tracking-wider text-white/80 transition-all hover:bg-white/10"
              >
                <Dices size={14} className="inline mr-2" /> RESHUFFLE
              </button>
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
              onAgain={pickRandomBattle}
            />
          )}
        </div>
      </main>
    </>
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
}: {
  card: Card;
  hp: number;
  hpPct: number;
  charge: number;
  showCharge: boolean;
  side: "player" | "enemy";
  shake: boolean;
  flash: boolean;
  winner: "player" | "enemy" | null;
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
        <Image
          src={card.image}
          alt={card.name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-cover"
        />
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
          {card.faction.replace(/_/g, " ")} · {card.armorType}
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
  card: Card;
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
  onAgain,
}: {
  winner: "player" | "enemy";
  playerName: string;
  enemyName: string;
  onAgain: () => void;
}) {
  const playerWon = winner === "player";
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
    </div>
  );
}
