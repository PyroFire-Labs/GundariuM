"use client";

import { useAccount, useChainId, useReadContract } from "wagmi";
import { useArenaStore } from "@/store/useArenaStore";
import { GUNDANIUM_GAME_ABI } from "@/lib/contracts/abis/GundaniumGame";
import { ERC20_ABI } from "@/lib/contracts/abis/ERC20";
import { getContracts } from "@/lib/contracts/addresses";

const GNDM_ADDRESS = process.env.NEXT_PUBLIC_GNDM_ADDRESS as `0x${string}`;

function formatGndm(amount: bigint): string {
  return (Number(amount) / 1e18).toLocaleString();
}

export function ArenaBrowse() {
  const { setStep, setCreator } = useArenaStore();
  const { address } = useAccount();
  const chainId = useChainId();

  let contracts: ReturnType<typeof getContracts> | null = null;
  try { contracts = getContracts(chainId); } catch { /* unsupported */ }

  const { data: pvpMinStake } = useReadContract({
    address: contracts?.gundaniumGame,
    abi: GUNDANIUM_GAME_ABI,
    functionName: "pvpMinStake",
    query: { enabled: !!contracts },
  });

  const { data: pvpFeePercent } = useReadContract({
    address: contracts?.gundaniumGame,
    abi: GUNDANIUM_GAME_ABI,
    functionName: "pvpFeePercent",
    query: { enabled: !!contracts },
  });

  const { data: gndmBalance } = useReadContract({
    address: GNDM_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!GNDM_ADDRESS },
  });

  const { data: queueIds } = useReadContract({
    address: contracts?.gundaniumGame,
    abi: GUNDANIUM_GAME_ABI,
    functionName: "getPVPQueue",
    query: { enabled: !!contracts, refetchInterval: 10_000 },
  });

  const openCount = queueIds?.length ?? 0;

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Stats bar */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-[var(--foreground)]/40">MIN STAKE</p>
          <p className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--accent)]">
            {pvpMinStake ? formatGndm(pvpMinStake) : "—"} GNDM
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--foreground)]/40">PROTOCOL FEE</p>
          <p className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--foreground)]">
            {pvpFeePercent ? `${pvpFeePercent}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--foreground)]/40">OPEN MATCHES</p>
          <p className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--accent-2)]">
            {openCount}
          </p>
        </div>
      </div>

      {/* GNDM balance */}
      {address && (
        <div className="text-center text-xs text-[var(--foreground)]/50">
          Your GNDM balance:{" "}
          <span className="text-[var(--accent)] font-bold">
            {gndmBalance !== undefined ? `${formatGndm(gndmBalance)} GNDM` : "loading..."}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          onClick={() => { setCreator(true); setStep("create-card"); }}
          className="w-full py-4 rounded-xl bg-[var(--accent)] text-black font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:brightness-110 transition-all"
        >
          CREATE MATCH
        </button>
        <button
          onClick={() => { setCreator(false); setStep("join-browse"); }}
          className="w-full py-4 rounded-xl border-2 border-[var(--accent-2)] text-[var(--accent-2)] font-[family-name:var(--font-orbitron)] text-sm font-bold tracking-wider hover:bg-[var(--accent-2)]/10 transition-all"
        >
          JOIN MATCH {openCount > 0 && `(${openCount} open)`}
        </button>
      </div>

      <p className="text-center text-xs text-[var(--foreground)]/30">
        Winner takes 90% of both stakes. 10% protocol fee.
      </p>
    </div>
  );
}
