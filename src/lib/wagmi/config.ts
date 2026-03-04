import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

const cdpKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

const CDP_RPC = (network: string) =>
  cdpKey
    ? `https://api.developer.coinbase.com/rpc/v1/${network}/${cdpKey}`
    : undefined;

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected(),
    walletConnect({ projectId: wcProjectId }),
    coinbaseWallet({
      appName: "GundariuM",
      preference: "eoaOnly",
    }),
  ],
  ssr: true,
  transports: {
    [base.id]: http(CDP_RPC("base")),
    [baseSepolia.id]: http(CDP_RPC("base-sepolia")),
  },
});
