"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { buildLineupMessage } from "@/lib/lineupMessage";

export type SaveLineupPhase = "idle" | "signing" | "saving" | "done" | "error";

export function useSaveLineup() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [phase, setPhase] = useState<SaveLineupPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const saveLineup = async (hero: number, support: number[]): Promise<boolean> => {
    if (!address) {
      setError("Connect your wallet first");
      setPhase("error");
      return false;
    }
    setError(null);
    try {
      setPhase("signing");
      const ts = Date.now();
      const message = buildLineupMessage(address, hero, support, ts);
      const signature = await signMessageAsync({ message });

      setPhase("saving");
      const res = await fetch("/api/dossier/lineup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, hero, support, ts, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setPhase("done");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg.includes("User rejected") ? "Signature cancelled" : msg);
      setPhase("error");
      return false;
    }
  };

  return { saveLineup, phase, error, reset: () => { setPhase("idle"); setError(null); } };
}
