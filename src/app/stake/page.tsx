"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useStaking, TIERS } from "@/lib/contracts/hooks/useStaking";

const QUICK_AMOUNTS = ["1000000", "5000000", "25000000", "100000000"];
const QUICK_LABELS  = ["1M", "5M", "25M", "100M"];

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function StakePage() {
  const { isConnected } = useAccount();
  const { balance, staked, totalStaked, tier, phase, error, contractReady, stake, unstake, reset } = useStaking();
  const [tab, setTab] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");

  const currentTierIndex = tier ? TIERS.findIndex(t => t.name === tier) : -1;
  const nextTier = TIERS[currentTierIndex + 1] ?? null;

  const isPending = phase === "approving" || phase === "staking" || phase === "unstaking";

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    reset();
    if (tab === "stake") await stake(amount);
    else await unstake(amount);
  };

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-black tracking-wider text-[var(--accent)]">
            STAKE GNDM
          </h1>
          <p className="text-sm text-[var(--foreground)]/50">
            Lock your tokens. Unlock the battlefield.
          </p>
        </div>

        {/* Contract not deployed banner */}
        {!contractReady && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
            <p className="text-yellow-400 font-bold text-sm font-[family-name:var(--font-orbitron)] tracking-wider">
              STAKING CONTRACT COMING SOON
            </p>
            <p className="text-xs text-yellow-400/60 mt-1">
              The staking contract is being deployed. Check back shortly.
            </p>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "GNDM Balance", value: isConnected ? fmt(balance) : "—" },
            { label: "Staked",       value: isConnected ? fmt(staked)  : "—" },
            { label: "Your Tier",    value: tier ?? "None" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
              <div className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-1">{s.label}</div>
              <div className="font-[family-name:var(--font-orbitron)] font-black text-[var(--accent)] text-lg">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tier ladder */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <h2 className="font-[family-name:var(--font-orbitron)] text-sm font-black text-[var(--foreground)]/60 tracking-widest uppercase">
            Tier Progress
          </h2>
          <div className="space-y-3">
            {TIERS.map((t, i) => {
              const unlocked = currentTierIndex >= i;
              const isCurrent = currentTierIndex === i;
              return (
                <div
                  key={t.name}
                  className={`rounded-lg border p-4 flex items-center justify-between gap-4 transition-all ${
                    isCurrent
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : unlocked
                      ? "border-[var(--accent)]/30 bg-[var(--accent)]/5 opacity-70"
                      : "border-[var(--border)] opacity-40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{unlocked ? "✅" : "🔒"}</span>
                    <div>
                      <div className="font-[family-name:var(--font-orbitron)] text-sm font-black text-[var(--foreground)]">
                        {t.name}
                        {isCurrent && (
                          <span className="ml-2 text-xs text-[var(--accent)]">← YOU</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--foreground)]/40">
                        {fmt(t.min)} GNDM minimum
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--foreground)]/60 space-y-0.5">
                    {t.unlocks.map(u => <div key={u}>{u}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
          {nextTier && isConnected && (
            <p className="text-xs text-center text-[var(--foreground)]/40 pt-1">
              Stake <span className="text-[var(--accent)] font-bold">{fmt(nextTier.min - staked)} more GNDM</span> to reach {nextTier.name}
            </p>
          )}
        </div>

        {/* Stake / Unstake panel */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
          {/* Tabs */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(["stake", "unstake"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setAmount(""); reset(); }}
                className={`flex-1 py-2 text-sm font-bold font-[family-name:var(--font-orbitron)] tracking-wider transition-all ${
                  tab === t
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest">
              Amount (GNDM)
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-lg font-bold text-[var(--foreground)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm font-bold text-[var(--foreground)]/50">GNDM</span>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((a, i) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={`flex-1 rounded-md py-1 text-xs font-bold transition-all ${
                    amount === a
                      ? "bg-[var(--accent)] text-black"
                      : "border border-[var(--border)] text-[var(--foreground)]/50 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  }`}
                >
                  {QUICK_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          {/* Projected tier */}
          {tab === "stake" && amount && parseFloat(amount) > 0 && (
            <div className="rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 px-4 py-2 text-xs text-center text-[var(--foreground)]/60">
              After staking:{" "}
              <span className="text-[var(--accent)] font-bold">
                {(() => {
                  const projected = staked + parseFloat(amount);
                  for (let i = TIERS.length - 1; i >= 0; i--) {
                    if (projected >= TIERS[i].min) return TIERS[i].name;
                  }
                  return "No tier yet";
                })()}
              </span>
            </div>
          )}

          {/* Error */}
          {phase === "error" && error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Success */}
          {phase === "done" && (
            <p className="text-green-400 text-sm text-center font-bold">
              {tab === "stake" ? "Staked successfully! ✅" : "Unstaked successfully! ✅"}
            </p>
          )}

          {/* Action button */}
          {!isConnected ? (
            <p className="text-center text-sm text-[var(--foreground)]/50 py-2">
              Connect your wallet to stake
            </p>
          ) : !contractReady ? (
            <button
              disabled
              className="w-full rounded-lg bg-[var(--border)] text-[var(--foreground)]/30 font-bold py-3 cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
            >
              CONTRACT NOT DEPLOYED
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isPending || !amount || parseFloat(amount) <= 0}
              className="w-full rounded-lg bg-[var(--accent)] text-black font-bold py-3 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
            >
              {phase === "approving" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  APPROVING…
                </span>
              ) : phase === "staking" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  STAKING…
                </span>
              ) : phase === "unstaking" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  UNSTAKING…
                </span>
              ) : tab === "stake" ? "STAKE GNDM 🔒" : "UNSTAKE GNDM"}
            </button>
          )}

          {/* Footer */}
          <div className="flex justify-between text-xs text-[var(--foreground)]/30">
            <span>Total staked: {fmt(totalStaked)} GNDM</span>
            <span>Base Mainnet</span>
          </div>
        </div>

      </div>
    </main>
  );
}
