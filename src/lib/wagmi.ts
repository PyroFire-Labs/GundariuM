import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected(),
    walletConnect({ projectId, showQrModal: true }),
  ],
  transports: {
    [base.id]:        http("https://mainnet.base.org"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
});
