"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSignMessage,
  useWriteContract,
} from "wagmi";
import { erc20Abi } from "viem";
import { REROLL_BURNER_ABI } from "@/lib/contracts/abis/RerollBurner";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { createGuardedWrite } from "@/lib/contracts/guardedWrite";
import { buildRerollMessage } from "@/lib/rerollMessage";
import { TARGET_CHAIN_ID } from "@/lib/targetChain";

const FALLBACK_REROLL_COST = 60_000n * 10n ** 18n;

export type RerollPhase =
  | "idle"
  | "approving"
  | "approved"
  | "rerolling"
  | "generating"
  | "done"
  | "error";

export function useReroll() {
  const [phase, setPhase] = useState<RerollPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  // Remembers an already-confirmed reroll() burn tx across calls to
  // executeReroll, so a later failure (signature rejected, Gemini POST
  // failing) can retry the sign+generate step against the SAME tx hash
  // instead of re-running approve+reroll and burning GNRM a second time.
  // Only cleared once /api/generate-kitbash actually succeeds.
  const [pendingRerollHash, setPendingRerollHash] = useState<`0x${string}` | null>(null);

  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const account = useAccount();
  const guardedWrite = createGuardedWrite(account, chainId, writeContractAsync);

  let contracts: ReturnType<typeof getContracts> | null = null;
  try {
    contracts = getContracts(chainId);
  } catch {
    // unsupported chain
  }

  // A wallet on the wrong chain could burn real GNRM in a transaction the
  // backend can never find — verifyRerollPayment only looks at the app's own
  // configured target chain. MintConfirm (the very next screen in this flow)
  // already guards on exactly this; the reroll path needs it too.
  const wrongChain = chainId !== TARGET_CHAIN_ID;

  // Deployment-readiness only. The reads below must stay gated on THIS, not
  // on the public `ready` — the `gnrm` read is what produces `gnrmAddress`,
  // and `ready` now depends on `gnrmAddress`, so gating the read on `ready`
  // would be circular and the address would never load.
  const contractReady = !!contracts && !isPlaceholder(contracts.rerollBurner);

  // Read the payment token address from the deployed contract itself rather
  // than hardcoding it — RerollBurner is initialized with real GNRM on
  // mainnet and a MockERC20 on Sepolia (see Task 6's dry-run deploy), so
  // this one hook works correctly against either without a chain branch.
  const { data: gnrmAddress } = useReadContract({
    address: contracts?.rerollBurner,
    abi: REROLL_BURNER_ABI,
    functionName: "gnrm",
    query: { enabled: contractReady },
  });

  const { data: rerollCostData } = useReadContract({
    address: contracts?.rerollBurner,
    abi: REROLL_BURNER_ABI,
    functionName: "rerollCost",
    query: { enabled: contractReady },
  });
  const rerollCost = rerollCostData ?? FALLBACK_REROLL_COST;

  const { data: allowance } = useReadContract({
    address: gnrmAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      account.address && contracts
        ? [account.address, contracts.rerollBurner]
        : undefined,
    query: { enabled: contractReady && !!account.address && !!gnrmAddress },
  });

  // What consumers gate their button on. Stricter than `contractReady`: it
  // also waits for `gnrmAddress` to load (executeReroll early-returns null
  // with no error without it, which read as a silent no-op click) and blocks
  // a wrong-chain wallet from triggering a real burn.
  const ready = contractReady && !!gnrmAddress && !wrongChain;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function executeReroll(faction: string | null): Promise<any | null> {
    if (!account.address || !contracts || !publicClient || !ready || !gnrmAddress) return null;
    setError(null);

    try {
      // If a previous attempt already confirmed the burn on-chain, resume
      // from there instead of re-running approve+reroll (which would burn
      // GNRM a second time for the same reroll).
      let rerollHash = pendingRerollHash;

      if (!rerollHash) {
        if ((allowance ?? 0n) < rerollCost) {
          setPhase("approving");
          const approveHash = await guardedWrite({
            address: gnrmAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [contracts.rerollBurner, rerollCost],
          });
          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveHash,
          });
          if (approveReceipt.status !== "success") {
            throw new Error("Approval transaction failed");
          }
        }
        setPhase("approved");

        setPhase("rerolling");
        const newRerollHash = await guardedWrite({
          address: contracts.rerollBurner,
          abi: REROLL_BURNER_ABI,
          functionName: "reroll",
        });
        const rerollReceipt = await publicClient.waitForTransactionReceipt({
          hash: newRerollHash,
        });
        if (rerollReceipt.status !== "success") {
          throw new Error("Reroll transaction failed");
        }
        // Persist immediately once the burn is confirmed, before anything
        // else that could fail (signature, Gemini) — so a retry never
        // re-burns.
        setPendingRerollHash(newRerollHash);
        rerollHash = newRerollHash;
      }

      const signature = await signMessageAsync({
        message: buildRerollMessage(rerollHash),
      });

      setPhase("generating");
      const res = await fetch("/api/generate-kitbash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faction,
          walletAddress: account.address,
          rerollTxHash: rerollHash,
          signature,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Reroll generation failed");
      }

      const data = await res.json();
      // Only clear the remembered burn tx once generation actually
      // succeeds — this is the one path where the reroll is fully spent.
      setPendingRerollHash(null);
      setPhase("done");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reroll failed");
      setPhase("error");
      return null;
    }
  }

  function reset() {
    setPhase("idle");
    setError(null);
  }

  return { phase, error, rerollCost, ready, executeReroll, reset };
}
