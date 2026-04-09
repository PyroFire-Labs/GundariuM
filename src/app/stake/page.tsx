"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { useStaking, getTier, TIERS } from "@/lib/contracts/hooks/useStaking";

const PCT_OPTIONS = [
  { label: "25%",  pct: 0.25 },
  { label: "50%",  pct: 0.50 },
  { label: "75%",  pct: 0.75 },
  { label: "MAX",  pct: 1.00 },
] as const;

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtCountdown(future: Date): string {
  const ms = future.getTime() - Date.now();
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function isPast(date: Date | null): boolean {
  return !!date && date.getTime() <= Date.now();
}

export default function StakePage() {
  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const {
    balance, staked, totalStaked, earned,
    lockUntil, rewardEligibleAt, tier,
    phase, error, contractReady,
    stake, unstake, claimRewards, reset,
  } = useStaking();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");

  const isUnlocked = isPast(lockUntil);
  const isEligible = isPast(rewardEligibleAt);
  const hasStake   = staked > 0;
  const hasRewards = earned > 0;

  const isPending = ["approving", "staking", "unstaking", "claiming"].includes(phase);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    reset();
    await stake(stakeAmount);
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    reset();
    await unstake(unstakeAmount);
  };

  const handleClaim = async () => {
    reset();
    await claimRewards();
  };

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-black tracking-wider text-[var(--accent)]">
            GNDM STAKING
          </h1>
          <p className="text-sm text-[var(--foreground)]/50">
            Stake GNDM to earn rewards and unlock tier perks
          </p>
        </div>

        {/* Wrong network banner */}
        {isConnected && !contractReady && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-yellow-400 font-bold text-sm font-[family-name:var(--font-orbitron)] tracking-wider">
                WRONG NETWORK
              </p>
              <p className="text-xs text-yellow-400/60 mt-1">
                Switch to Base to stake
              </p>
            </div>
            <button
              onClick={() => switchChainAsync({ chainId: base.id })}
              className="shrink-0 rounded-lg bg-yellow-500 text-black font-bold text-xs px-4 py-2 hover:brightness-110 transition-all font-[family-name:var(--font-orbitron)] tracking-wider"
            >
              SWITCH
            </button>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Your Balance", value: isConnected ? fmt(balance) : "—" },
            { label: "Your Staked", value: isConnected ? fmt(staked) : "—" },
            { label: "Total Staked", value: isConnected ? fmt(totalStaked) : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
              <div className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-1">{s.label}</div>
              <div className="font-[family-name:var(--font-orbitron)] font-black text-[var(--accent)] text-lg">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tier display */}
        {isConnected && contractReady && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-2">Your Tier</div>
            <div className="flex items-center gap-3">
              <div className="font-[family-name:var(--font-orbitron)] font-black text-lg text-[var(--accent)]">
                {tier ?? "Unranked"}
              </div>
              {tier && (
                <div className="text-xs text-[var(--foreground)]/50">
                  {TIERS.find(t => t.name === tier)?.unlocks.join(" · ")}
                </div>
              )}
            </div>
            {/* Next tier hint */}
            {(() => {
              const currentIdx = tier ? TIERS.findIndex(t => t.name === tier) : -1;
              const next = TIERS[currentIdx + 1];
              if (!next) return null;
              const needed = next.min - staked;
              return (
                <div className="text-xs text-[var(--foreground)]/30 mt-2">
                  Stake {fmt(needed)} more to reach {next.name}
                </div>
              );
            })()}
          </div>
        )}

        {/* Lock / Eligibility status */}
        {isConnected && contractReady && hasStake && (
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border p-4 text-center ${
              isUnlocked
                ? "border-green-500/30 bg-green-500/5"
                : "border-red-500/30 bg-red-500/5"
            }`}>
              <div className="text-xs uppercase tracking-widest mb-1 font-bold" style={{
                color: isUnlocked ? "rgb(134 239 172)" : "rgb(252 165 165)",
                opacity: 0.7,
              }}>
                {isUnlocked ? "UNLOCKED" : "LOCKED"}
              </div>
              <div className="font-[family-name:var(--font-orbitron)] font-black text-sm" style={{
                color: isUnlocked ? "rgb(134 239 172)" : "rgb(252 165 165)",
              }}>
                {isUnlocked
                  ? "Ready to unstake"
                  : lockUntil ? fmtCountdown(lockUntil) : "—"}
              </div>
            </div>
            <div className={`rounded-xl border p-4 text-center ${
              isEligible
                ? "border-green-500/30 bg-green-500/5"
                : "border-[var(--accent)]/20 bg-[var(--accent)]/5"
            }`}>
              <div className="text-xs uppercase tracking-widest mb-1 font-bold" style={{
                color: isEligible ? "rgb(134 239 172)" : "var(--accent)",
                opacity: 0.7,
              }}>
                {isEligible ? "ELIGIBLE" : "REWARD DELAY"}
              </div>
              <div className="font-[family-name:var(--font-orbitron)] font-black text-sm" style={{
                color: isEligible ? "rgb(134 239 172)" : "var(--accent)",
              }}>
                {isEligible
                  ? "Rewards claimable"
                  : rewardEligibleAt ? fmtCountdown(rewardEligibleAt) : "—"}
              </div>
            </div>
          </div>
        )}

        {/* Claim rewards panel */}
        {isConnected && contractReady && isEligible && hasRewards && (
          <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-[family-name:var(--font-orbitron)] text-sm font-black text-[var(--accent)] tracking-wider">
                  STAKING REWARDS
                </div>
                <div className="text-xs text-[var(--foreground)]/50 mt-0.5">
                  7-day eligibility window passed
                </div>
              </div>
              <div className="text-right">
                <div className="font-[family-name:var(--font-orbitron)] font-black text-2xl text-[var(--accent)]">
                  {fmt(earned)}
                </div>
                <div className="text-xs text-[var(--foreground)]/40">GNDM earned</div>
              </div>
            </div>

            {phase === "done" && (
              <p className="text-green-400 text-sm text-center font-bold">Claimed successfully!</p>
            )}

            <button
              onClick={handleClaim}
              disabled={isPending}
              className="w-full rounded-lg bg-[var(--accent)] text-black font-bold py-3 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
            >
              {phase === "claiming" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  CLAIMING...
                </span>
              ) : `CLAIM ${fmt(earned)} GNDM`}
            </button>
          </div>
        )}

        {/* Stake / Unstake tabbed panel */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 bg-[var(--background)] rounded-lg p-1">
            {(["stake", "unstake"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); reset(); }}
                className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-widest transition-all font-[family-name:var(--font-orbitron)] ${
                  activeTab === tab
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "stake" ? (
            <>
              {/* Stake amount input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest">
                  Amount (GNDM)
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent text-lg font-bold text-[var(--foreground)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm font-bold text-[var(--foreground)]/50">GNDM</span>
                </div>
                <div className="flex gap-2">
                  {PCT_OPTIONS.map((opt) => {
                    const pctAmount = Math.floor(balance * opt.pct).toString();
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setStakeAmount(pctAmount)}
                        disabled={balance <= 0}
                        className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                          stakeAmount === pctAmount && balance > 0
                            ? "bg-[var(--accent)] text-black"
                            : "border border-[var(--border)] text-[var(--foreground)]/50 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed"
                        } ${opt.label === "MAX" ? "font-[family-name:var(--font-orbitron)] tracking-wider" : ""}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stake info */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-xs text-[var(--foreground)]/40 space-y-1">
                <p>24-hour lock after staking (re-staking resets the clock)</p>
                <p>7-day wait before rewards are claimable</p>
              </div>

              {/* Error / Success */}
              {phase === "error" && error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}
              {phase === "done" && (
                <p className="text-green-400 text-sm text-center font-bold">Staked successfully!</p>
              )}

              {/* Stake button */}
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
                  onClick={handleStake}
                  disabled={isPending || !stakeAmount || parseFloat(stakeAmount) <= 0}
                  className="w-full rounded-lg bg-[var(--accent)] text-black font-bold py-3 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
                >
                  {phase === "approving" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      APPROVING...
                    </span>
                  ) : phase === "staking" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      STAKING...
                    </span>
                  ) : "STAKE GNDM"}
                </button>
              )}
            </>
          ) : (
            <>
              {/* Lock warning */}
              {hasStake && !isUnlocked && lockUntil && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400 text-center">
                  Tokens locked for <strong>{fmtCountdown(lockUntil)}</strong>
                </div>
              )}

              {/* Unstake amount input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--foreground)]/50 uppercase tracking-widest">
                  Amount (GNDM)
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent text-lg font-bold text-[var(--foreground)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm font-bold text-[var(--foreground)]/50">GNDM</span>
                </div>
                <div className="flex gap-2">
                  {PCT_OPTIONS.map((opt) => {
                    const pctAmount = Math.floor(staked * opt.pct).toString();
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setUnstakeAmount(pctAmount)}
                        disabled={staked <= 0}
                        className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                          unstakeAmount === pctAmount && staked > 0
                            ? "bg-[var(--accent)] text-black"
                            : "border border-[var(--border)] text-[var(--foreground)]/50 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed"
                        } ${opt.label === "MAX" ? "font-[family-name:var(--font-orbitron)] tracking-wider" : ""}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error / Success */}
              {phase === "error" && error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}
              {phase === "done" && (
                <p className="text-green-400 text-sm text-center font-bold">Unstaked successfully!</p>
              )}

              {/* Unstake button */}
              {!isConnected ? (
                <p className="text-center text-sm text-[var(--foreground)]/50 py-2">
                  Connect your wallet to unstake
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
                  onClick={handleUnstake}
                  disabled={isPending || !unstakeAmount || parseFloat(unstakeAmount) <= 0}
                  className="w-full rounded-lg bg-red-500 text-white font-bold py-3 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
                >
                  {phase === "unstaking" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      UNSTAKING...
                    </span>
                  ) : "UNSTAKE GNDM"}
                </button>
              )}
            </>
          )}

          {/* Footer */}
          <div className="text-xs text-[var(--foreground)]/30 text-center">
            Base Mainnet
          </div>
        </div>

      </div>
    </main>
  );
}
