"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/wallet/ConnectButton";

/**
 * /dossier with no address — redirects to the connected wallet's own
 * dossier. Nav links here since NAV_LINKS is a static href array with no
 * way to know the connected address ahead of time.
 */
export default function MyDossierPage() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isConnected && address) {
      router.replace(`/dossier/${address}`);
    }
  }, [mounted, isConnected, address, router]);

  if (mounted && isConnected) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-[var(--accent)] tracking-wide">
        FRAME-RUNNER DOSSIER
      </h1>
      <p className="text-[var(--foreground)]/60 text-sm max-w-sm">
        Connect your wallet to view your dossier — daily streak, check-ins, and your starting lineup.
      </p>
      {mounted && <ConnectButton />}
    </div>
  );
}
