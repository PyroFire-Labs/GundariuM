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
import { isTerminalRerollReason } from "@/lib/rerollReasons";
import { TARGET_CHAIN_ID } from "@/lib/targetChain";
import { useMintStore } from "@/store/useMintStore";

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
  // Cleared only when the burn is provably gone — see below.
  //
  // Held in the persisted mint store rather than local useState: this
  // component unmounts on any reload, and the most likely post-burn failure
  // is the shared per-IP rate limit rejecting the paid POST with a 429 —
  // whose natural user response (reload, navigate away) would otherwise
  // strand a real 60,000 GNRM burn permanently.
  const pendingReroll = useMintStore((s) => s.pendingReroll);
  const setPendingReroll = useMintStore((s) => s.setPendingReroll);

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
      //
      // A remembered burn is only resumable by the wallet that paid for it,
      // on the chain it was paid on: the backend requires the `Rerolled`
      // event's `user` to equal the caller and looks the tx up on exactly one
      // configured chain. A mismatch is therefore not-applicable rather than
      // invalid — fall through to a fresh burn for the current wallet/chain
      // and leave the stored entry alone, since the wallet that owns it may
      // reconnect (or NEXT_PUBLIC_CHAIN_ID may point back) and redeem it.
      const resumable =
        pendingReroll &&
        pendingReroll.walletAddress.toLowerCase() ===
          account.address.toLowerCase() &&
        pendingReroll.chainId === chainId
          ? pendingReroll
          : null;

      let rerollHash: `0x${string}` | null = resumable?.hash ?? null;

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
        // re-burns. Stamped with the paying wallet and chain so a later
        // session can tell whether it is allowed to resume from it.
        //
        // Known residual: this is a single slot, so a second wallet's fresh
        // burn overwrites a first wallet's unredeemed one. It takes a wallet
        // switch *while* holding an unredeemed burn, and the first wallet's
        // record is only lost once the second actually pays. If that ever
        // matters, the fix is to key this by `${chainId}:${wallet}` and keep
        // one entry per payer rather than one entry overall.
        setPendingReroll({
          hash: newRerollHash,
          walletAddress: account.address,
          chainId,
        });
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
        const reason = typeof data?.error === "string" ? data.error : undefined;
        // Some verification failures prove this hash can never buy a
        // generation (already consumed, or a real receipt that reverted or
        // carries no matching event for this wallet). Keeping it would make
        // every future click retry a dead payment forever — a permanent
        // dead-end. Forget it so the next click starts a genuinely fresh
        // approve+burn.
        //
        // Everything else — 429 rate limits, transport errors, "couldn't
        // check right now", and even a same-hash "transaction not found"
        // (the server's RPC provider differs from the one the client
        // confirmed against, so a real burn can transiently look absent
        // there) — stays remembered. Those are exactly the cases this field
        // exists to protect: the burn is still redeemable and discarding it
        // would cost the user another 60,000 GNRM.
        if (isTerminalRerollReason(reason)) {
          setPendingReroll(null);
        }
        throw new Error(reason ?? "Reroll generation failed");
      }

      // The server marks the payment consumed *before* it responds, so a 2xx
      // means this burn is spent no matter what happens next. Clear before
      // touching the body: a throw from res.json() (dropped connection,
      // malformed payload) would otherwise leave the client retrying a hash
      // the server has already redeemed, which only ever answers 402.
      setPendingReroll(null);

      const data = await res.json();
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
