"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { FarcasterInit } from "@/components/providers/FarcasterInit";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // reconnectOnMount is handled inside FarcasterInit instead of automatically
  // here — wagmi's default reconnect tries every previously-authorized
  // connector and lets whichever one succeeds first "win" as the active
  // account, which can beat the Farcaster wallet into place if a device has
  // ever also signed in via Base Account. See FarcasterInit for the
  // context-aware reconnect this replaces.
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <FarcasterInit />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
