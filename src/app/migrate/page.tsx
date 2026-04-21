"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import { base } from "viem/chains";
import { MIGRATION_ABI } from "@/lib/contracts/abis/GNDMtoGUNR";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";

const GNDM_ADDRESS = "0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3" as const;

type Phase = "idle" | "loading" | "approving" | "migrating" | "done" | "error";

interface ProofData {
  cap: string;
  proof: string[];
}

export default function MigratePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [proofData, setProofData] = useState<ProofData | null>(null);

  let contracts: ReturnType<typeof getContracts> | null = null;
  let migrationReady = false;
  try {
    contracts = getContracts(base.id);
    migrationReady = !isPlaceholder(contracts.migration);
  } catch {}

  const migrationAddress = migrationReady ? contracts!.migration : undefined;

  const { data: gndmBalance } = useReadContract({
    address: GNDM_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: alreadyMigrated } = useReadContract({
    address: migrationAddress,
    abi: MIGRATION_ABI,
    functionName: "migrated",
    args: address ? [address] : undefined,
  });

  const { data: gunrAddr } = useReadContract({
    address: migrationAddress,
    abi: MIGRATION_ABI,
    functionName: "gunr",
  });

  const { data: gunrInContract } = useReadContract({
    address: gunrAddr as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: migrationAddress ? [migrationAddress] : undefined,
  });

  const { data: deadline } = useReadContract({
    address: migrationAddress,
    abi: MIGRATION_ABI,
    functionName: "deadline",
  });

  useEffect(() => {
    if (!address) return;
    fetch("/migration-proofs.json")
      .then((r) => r.json())
      .then((data) => {
        const entry = data.proofs?.[address.toLowerCase()];
        if (entry) setProofData(entry);
        else setProofData(null);
      })
      .catch(() => setProofData(null));
  }, [address]);

  const capWei = proofData ? BigInt(proofData.cap) : 0n;
  const migratedWei = (alreadyMigrated as bigint) ?? 0n;
  const remainingCap = capWei > migratedWei ? capWei - migratedWei : 0n;
  const balanceWei = (gndmBalance as bigint) ?? 0n;
  const maxAmount = remainingCap < balanceWei ? remainingCap : balanceWei;

  const deadlineDate = deadline ? new Date(Number(deadline as bigint) * 1000) : null;
  const isExpired = deadlineDate ? deadlineDate.getTime() <= Date.now() : false;

  function daysRemaining(): string {
    if (!deadlineDate) return "—";
    const ms = deadlineDate.getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    return `${d}d ${h}h`;
  }

  function fmt(wei: bigint): string {
    const n = parseFloat(formatUnits(wei, 18));
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  async function handleMigrate() {
    if (!address || !proofData || !migrationAddress || !publicClient) return;
    const amountWei = parseUnits(amount, 18);
    if (amountWei <= 0n) return;

    setPhase("approving");
    setError(null);

    try {
      const approveHash = await writeContractAsync({
        address: GNDM_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [migrationAddress, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setPhase("migrating");
      const migrateHash = await writeContractAsync({
        address: migrationAddress,
        abi: MIGRATION_ABI,
        functionName: "migrate",
        args: [amountWei, BigInt(proofData.cap), proofData.proof as `0x${string}`[]],
      });
      await publicClient.waitForTransactionReceipt({ hash: migrateHash });

      setTxHash(migrateHash);
      setPhase("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Migration failed";
      setError(msg.includes("User rejected") ? "Transaction cancelled" : msg);
      setPhase("error");
    }
  }

  if (phase === "done" && txHash) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center space-y-4">
          <div className="text-5xl">&#x2705;</div>
          <h2 className="font-[family-name:var(--font-orbitron)] text-2xl font-black text-[var(--accent)]">
            MIGRATION COMPLETE
          </h2>
          <p className="text-[var(--foreground)]/70">
            Your GNDM has been swapped 1:1 for GUNR.
          </p>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-[var(--foreground)]/40 hover:text-[var(--accent)] transition-colors break-all"
          >
            {txHash}
          </a>
          <button
            onClick={() => { setPhase("idle"); setTxHash(null); setAmount(""); }}
            className="w-full rounded-lg border border-[var(--border)] py-2 text-sm font-bold text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors"
          >
            Done
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-black tracking-wider text-[var(--accent)]">
            GNDM &rarr; GUNR MIGRATION
          </h1>
          <p className="text-sm text-[var(--foreground)]/60">
            Swap your GNDM for GUNR at 1:1
          </p>
          {deadlineDate && !isExpired && (
            <p className="text-xs text-[var(--foreground)]/40">
              {daysRemaining()} remaining
            </p>
          )}
          {isExpired && (
            <p className="text-xs text-red-400 font-bold">Migration window has closed</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Your GNDM", value: isConnected ? fmt(balanceWei) : "—" },
            { label: "Your Cap", value: isConnected && proofData ? fmt(capWei) : "—" },
            { label: "GUNR Left", value: gunrInContract ? fmt(gunrInContract as bigint) : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <div className="text-[10px] text-[var(--foreground)]/40 uppercase tracking-widest mb-1">{s.label}</div>
              <div className="font-[family-name:var(--font-orbitron)] font-black text-[var(--accent)] text-sm">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
          {isConnected && proofData && migratedWei > 0n && (
            <div className="text-xs text-[var(--foreground)]/40 text-center">
              Already migrated: {fmt(migratedWei)} / {fmt(capWei)}
            </div>
          )}

          {isConnected && !proofData && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
              <p className="text-red-400 text-sm font-bold font-[family-name:var(--font-orbitron)]">
                NOT ON WHITELIST
              </p>
              <p className="text-xs text-red-400/60 mt-1">
                Only verified GNDM holders can migrate. Contact @PyroFireZerox on Farcaster.
              </p>
            </div>
          )}

          {isConnected && proofData && !isExpired && (
            <>
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
                  <button
                    onClick={() => setAmount(formatUnits(maxAmount, 18))}
                    className="text-xs font-bold text-[var(--accent)] hover:text-white transition-colors font-[family-name:var(--font-orbitron)]"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="text-center text-[var(--foreground)]/30 text-lg">&darr;</div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3 text-center">
                <span className="text-lg font-bold text-[var(--accent)]">
                  {amount && parseFloat(amount) > 0 ? `${amount} GUNR` : "—"}
                </span>
                <span className="text-xs text-[var(--foreground)]/30 ml-2">1:1</span>
              </div>

              {phase === "error" && error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <button
                onClick={handleMigrate}
                disabled={
                  phase === "approving" ||
                  phase === "migrating" ||
                  !amount ||
                  parseFloat(amount) <= 0
                }
                className="w-full rounded-lg bg-[var(--accent)] text-black font-bold py-3 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-orbitron)] tracking-wider"
              >
                {phase === "approving" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    APPROVING...
                  </span>
                ) : phase === "migrating" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    MIGRATING...
                  </span>
                ) : (
                  "MIGRATE TO GUNR"
                )}
              </button>
            </>
          )}

          {!isConnected && (
            <p className="text-center text-sm text-[var(--foreground)]/50 py-2">
              Connect your wallet to migrate
            </p>
          )}

          <p className="text-center text-xs text-[var(--foreground)]/30">
            1:1 swap &middot; GNDM in, GUNR out &middot; Base Mainnet
          </p>
        </div>
      </div>
    </main>
  );
}
