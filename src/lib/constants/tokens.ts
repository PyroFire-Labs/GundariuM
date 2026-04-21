// Token addresses on Base mainnet (chainId 8453)
export const TOKENS = {
  GUNR: "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07" as const,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
} as const;

// Token addresses on Base Sepolia testnet (chainId 84532)
export const TOKENS_TESTNET = {
  GUNR: "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07" as const, // placeholder until testnet deploy
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const, // USDC on Base Sepolia
} as const;

export const MINT_PRICE_USDC = 5_000_000n; // $5 USDC (6 decimals)
export const COSMETIC_PRICE_USDC = 10_000_000n; // $10 USDC (6 decimals)
