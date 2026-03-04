// Token addresses on Base mainnet (chainId 8453)
export const TOKENS = {
  GNDM: "0xFc7008F9157257a17a9Fb3c602b1CD56C27A4ba3" as const,
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
} as const;

// Token addresses on Base Sepolia testnet (chainId 84532)
export const TOKENS_TESTNET = {
  GNDM: "0xFc7008F9157257a17a9Fb3c602b1CD56C27A4ba3" as const, // placeholder until testnet deploy
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const, // USDC on Base Sepolia
} as const;

export const MINT_PRICE_USDC = 5_000_000n; // $5 USDC (6 decimals)
export const COSMETIC_PRICE_USDC = 10_000_000n; // $10 USDC (6 decimals)
