import { createConnector } from "@wagmi/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProvider = any;

async function getFarcasterProvider(): Promise<AnyProvider> {
  const { sdk } = await import("@farcaster/miniapp-sdk");
  return sdk.wallet.ethProvider;
}

export const farcasterConnector = createConnector((config) => ({
  id: "farcaster",
  name: "Farcaster Wallet",
  type: "farcaster" as const,

  async setup() {},

  async connect({ chainId } = {}) {
    const provider = await getFarcasterProvider();
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as readonly `0x${string}`[];

    // Force the wallet bridge onto Base mainnet so iOS wallet balance checks
    // hit the right chain. Without this, some Farcaster wallet routes default
    // to Ethereum mainnet and report "Not Enough ETH" against an empty Eth
    // balance even when Base balance is healthy.
    const targetChainId = chainId ?? 8453;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch {
      // wallet may not support switching — fall through and trust whatever
      // chain it's on
    }

    const currentChainId = await this.getChainId();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { accounts, chainId: currentChainId } as any;
  },

  async disconnect() {},

  async switchChain({ chainId }: { chainId: number }) {
    const chain = config.chains.find((c) => c.id === chainId);
    if (!chain) throw new Error(`Chain ${chainId} not configured`);
    const provider = await getFarcasterProvider();
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      config.emitter.emit("change", { chainId });
    } catch {
      // provider may not support switching
    }
    return chain;
  },

  async getAccounts() {
    const provider = await getFarcasterProvider();
    return (await provider.request({
      method: "eth_accounts",
    })) as readonly `0x${string}`[];
  },

  async getChainId() {
    const provider = await getFarcasterProvider();
    const hex = (await provider.request({ method: "eth_chainId" })) as string;
    return parseInt(hex, 16);
  },

  async getProvider() {
    return getFarcasterProvider();
  },

  async isAuthorized() {
    try {
      const accounts = await this.getAccounts();
      return accounts.length > 0;
    } catch {
      return false;
    }
  },

  onAccountsChanged(accounts) {
    config.emitter.emit("change", { accounts: accounts as `0x${string}`[] });
  },

  onChainChanged(chain) {
    config.emitter.emit("change", { chainId: parseInt(chain, 16) });
  },

  onDisconnect() {
    config.emitter.emit("disconnect");
  },
}));
