"use client";

import { useState } from "react";
import { useMintStore } from "@/store/useMintStore";
import type { TraitSet, Rarity, ArmorType } from "@/types/nft";

const RARITIES: Rarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Ultra Rare",
  "Legendary",
];

const ARMOR_TYPES: ArmorType[] = [
  "Standard",
  "Gundanium",
  "Phase Shift",
  "I-Field",
  "GN Particle",
  "Luna Titanium",
];

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

const RARITY_TEXT: Record<Rarity, string> = {
  Common: "text-[var(--color-rarity-common)]",
  Uncommon: "text-[var(--color-rarity-uncommon)]",
  Rare: "text-[var(--color-rarity-rare)]",
  "Ultra Rare": "text-[var(--color-rarity-ultra)]",
  Legendary: "text-[var(--color-rarity-legendary)]",
};

export function TraitReview() {
  const { traits, imagePreviewUrl, setTraits, goTo } = useMintStore();
  const [local, setLocal] = useState<TraitSet>({ ...traits! });

  function update<K extends keyof TraitSet>(key: K, value: TraitSet[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  const handleContinue = () => {
    setTraits(local);
    goTo("confirming");
  };

  const confidence = local.confidence ?? 1;

  return (
    <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left: image + confidence */}
      <div className="flex flex-col gap-4">
        <div
          className={`rounded-xl border-2 overflow-hidden beam-scan ${RARITY_CLASS[local.rarity]}`}
        >
          {imagePreviewUrl && (
            <img
              src={imagePreviewUrl}
              alt={local.name}
              className="w-full object-cover"
            />
          )}
        </div>

        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
          <p className="text-xs text-[var(--foreground)]/50 uppercase tracking-wider">
            AI Confidence
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className="text-[var(--accent)] font-mono text-sm">
              {Math.round(confidence * 100)}%
            </span>
          </div>
          {confidence < 0.7 && (
            <p className="text-yellow-400 text-xs">
              Low confidence — review all traits carefully before minting.
            </p>
          )}
          <p className={`text-sm font-bold ${RARITY_TEXT[local.rarity]}`}>
            {local.rarity}
          </p>
        </div>
      </div>

      {/* Right: editable form */}
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[75vh] pr-1">
        <Field
          label="Suit Name"
          value={local.name}
          onChange={(v) => update("name", v)}
        />
        <Field
          label="Series"
          value={local.series}
          onChange={(v) => update("series", v)}
        />
        <Field
          label="Faction"
          value={local.faction}
          onChange={(v) => update("faction", v)}
        />
        <Field
          label="Pilot"
          value={local.pilotName}
          onChange={(v) => update("pilotName", v)}
        />

        <SelectField
          label="Rarity"
          value={local.rarity}
          options={RARITIES}
          onChange={(v) => update("rarity", v as Rarity)}
        />
        <SelectField
          label="Armor Type"
          value={local.armorType}
          options={ARMOR_TYPES}
          onChange={(v) => update("armorType", v as ArmorType)}
        />

        <NumField
          label="HP"
          value={local.hp}
          onChange={(v) => update("hp", v)}
        />

        <WeaponRow
          label="Primary"
          weapon={local.primaryWeapon}
          damage={local.primaryDamage}
          onWeapon={(v) => update("primaryWeapon", v)}
          onDamage={(v) => update("primaryDamage", v)}
        />
        <WeaponRow
          label="Secondary"
          weapon={local.secondaryWeapon}
          damage={local.secondaryDamage}
          onWeapon={(v) => update("secondaryWeapon", v)}
          onDamage={(v) => update("secondaryDamage", v)}
        />
        <WeaponRow
          label="Tertiary"
          weapon={local.tertiaryWeapon}
          damage={local.tertiaryDamage}
          onWeapon={(v) => update("tertiaryWeapon", v)}
          onDamage={(v) => update("tertiaryDamage", v)}
        />
        <WeaponRow
          label="Special"
          weapon={local.specialAttack}
          damage={local.specialDamage}
          onWeapon={(v) => update("specialAttack", v)}
          onDamage={(v) => update("specialDamage", v)}
        />

        <button
          onClick={handleContinue}
          className="mt-2 w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          CONFIRM TRAITS →
        </button>
        <button
          onClick={() => goTo("idle")}
          className="w-full py-2 text-[var(--foreground)]/40 text-sm hover:text-[var(--foreground)]/60 transition-colors"
        >
          Re-analyze photo
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--foreground)]/50 uppercase tracking-wider">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--foreground)]/50 uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--foreground)]/50 uppercase tracking-wider">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  );
}

function WeaponRow({
  label,
  weapon,
  damage,
  onWeapon,
  onDamage,
}: {
  label: string;
  weapon: string;
  damage: number;
  onWeapon: (v: string) => void;
  onDamage: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--foreground)]/50 uppercase tracking-wider">
        {label} Weapon
      </label>
      <div className="flex gap-2">
        <input
          value={weapon}
          onChange={(e) => onWeapon(e.target.value)}
          className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
        />
        <input
          type="number"
          value={damage}
          onChange={(e) => onDamage(Number(e.target.value))}
          placeholder="DMG"
          className="w-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
    </div>
  );
}
