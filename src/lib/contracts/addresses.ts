// Contract addresses by chainId
// Fill in after deploying with Foundry

export const CONTRACT_ADDRESSES: Record<
  number,
  {
    gunplaCard: `0x${string}`;
    gundaniumGame: `0x${string}`;
    prizePool: `0x${string}`;
    gunrStaking: `0x${string}`;
    gunrToken: `0x${string}`;
    migration: `0x${string}`;
  }
> = {
  // Base Sepolia (testnet)
  84532: {
    gunplaCard: "0x7475CeA2680ddaF22B914F45290e22a75e29fF4c",
    gundaniumGame: "0x310767a15fD906C3F702d54B565904dE6Aca6be7",
    prizePool: "0xa5670c2dD9916BE1DB9974977844228Cfc3bA731",
    gunrStaking: "0x4fFFF1428f49Ae73a21AA103C992533BA24E48E7",
    gunrToken: "0x6Add3cF424f9D2927721B13110164a3e019efFa4",
    migration: "0x0000000000000000000000000000000000000000",
  },
  // Base mainnet
  8453: {
    gunplaCard: "0xA7bc3d31A4863b33854F2d73C77BAf31c4f27a6C",
    gundaniumGame: "0x0000000000000000000000000000000000000000",
    prizePool: "0x0000000000000000000000000000000000000000",
    gunrStaking: "0x2F61D7EaC30E44ed33df3a441aDfC69C47Bd5B02",
    gunrToken: "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07",
    migration: "0xefbD485bFbDb9aC766659811151CB2b6e43A7261",
  },
};

/** @deprecated use getContracts(chainId).gunrToken instead */
export const GUNR_TOKEN_ADDRESS =
  "0x825E54c23CCbE0f697854b9A53FB4E6cE3e0DB07" as const;

export function getContracts(chainId: number) {
  const addrs = CONTRACT_ADDRESSES[chainId];
  if (!addrs) throw new Error(`No contracts deployed for chainId ${chainId}`);
  return addrs;
}

export function isPlaceholder(address: `0x${string}`) {
  return address === "0x0000000000000000000000000000000000000000";
}
