import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { farcasterConnector } from "@/lib/farcasterConnector";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    farcasterConnector,
    injected(),
    walletConnect({ projectId, showQrModal: true }),
  ],
  transports: {
    [base.id]:        http("https://mainnet.base.org"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
});
