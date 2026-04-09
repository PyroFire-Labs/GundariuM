// Contract addresses by chainId
// Fill in after deploying with Foundry

export const CONTRACT_ADDRESSES: Record<
  number,
  {
    gunplaCard: `0x${string}`;
    gundaniumGame: `0x${string}`;
    prizePool: `0x${string}`;
    gndmStaking: `0x${string}`;
    gndmToken: `0x${string}`;
  }
> = {
  // Base Sepolia (testnet)
  84532: {
    gunplaCard: "0x47d0e0c160169df4bf920e6d4b47ad7de7d84d8f",
    gundaniumGame: "0x27c041d53b4cc4dbc1fdbd80eeba3c3fa4e23754",
    prizePool: "0x5209d87a920e468583042346e23564977416f67a",
    gndmStaking: "0x4fFFF1428f49Ae73a21AA103C992533BA24E48E7",
    gndmToken: "0x6Add3cF424f9D2927721B13110164a3e019efFa4",
  },
  // Base mainnet
  8453: {
    gunplaCard: "0x0000000000000000000000000000000000000000",
    gundaniumGame: "0x0000000000000000000000000000000000000000",
    prizePool: "0x0000000000000000000000000000000000000000",
    gndmStaking: "0x2F61D7EaC30E44ed33df3a441aDfC69C47Bd5B02",
    gndmToken: "0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3",
  },
};

/** @deprecated use getContracts(chainId).gndmToken instead */
export const GNDM_TOKEN_ADDRESS =
  "0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3" as const;

export function getContracts(chainId: number) {
  const addrs = CONTRACT_ADDRESSES[chainId];
  if (!addrs) throw new Error(`No contracts deployed for chainId ${chainId}`);
  return addrs;
}

export function isPlaceholder(address: `0x${string}`) {
  return address === "0x0000000000000000000000000000000000000000";
}
