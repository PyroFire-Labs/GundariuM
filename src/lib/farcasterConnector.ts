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
    const currentChainId = await this.getChainId();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { accounts, chainId: chainId ?? currentChainId } as any;
  },

  async disconnect() {},

  async switchChain({ chainId }: { chainId: number }) {
    // Farcaster wallet does not support programmatic chain switching.
    // It is always on Base mainnet (8453). Return the current chain.
    const chain = config.chains.find((c) => c.id === chainId);
    if (!chain) throw new Error(`Chain ${chainId} not configured`);
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
