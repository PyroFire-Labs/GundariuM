// Contract addresses by chainId
// Fill in after deploying with Foundry

export const CONTRACT_ADDRESSES: Record<
  number,
  {
    gunplaCard: `0x${string}`;
    gundaniumGame: `0x${string}`;
    prizePool: `0x${string}`;
    migration: `0x${string}`;
    dailyCheckIn: `0x${string}`;
    dossierShareLog: `0x${string}`;
    arenaBattleLog: `0x${string}`;
    rerollBurner: `0x${string}`;
  }
> = {
  // Base Sepolia (testnet)
  84532: {
    gunplaCard: "0x7475CeA2680ddaF22B914F45290e22a75e29fF4c",
    gundaniumGame: "0x310767a15fD906C3F702d54B565904dE6Aca6be7",
    prizePool: "0xa5670c2dD9916BE1DB9974977844228Cfc3bA731",
    migration: "0x0000000000000000000000000000000000000000",
    dailyCheckIn: "0x4a444d13Cb7f23E7F91C88BE5F858DCDe8706a67",
    dossierShareLog: "0xe390deDAe1ebE0ffEA23919Bf85CE7a709dA2653",
    arenaBattleLog: "0x6028332FbEeb246C989BF3fFaAcA06CF5B519D98",
    rerollBurner: "0xDBE165C1D33F4BDD4Ae1C2b0D49933E460fEFe06",
  },
  // Base mainnet
  8453: {
    gunplaCard: "0xA7bc3d31A4863b33854F2d73C77BAf31c4f27a6C",
    gundaniumGame: "0x0000000000000000000000000000000000000000",
    prizePool: "0x0000000000000000000000000000000000000000",
    migration: "0x8CCbd8EEA766d564fC0AD09D2cB99e4cD4107230",
    dailyCheckIn: "0xCA600477594Ddc414210204af03c6DF37e05d9D8",
    dossierShareLog: "0x92dEFc58Ef3c79fbd7A3C3e04aDC189742291B57",
    arenaBattleLog: "0x64a2fc1A13CA269C6188f94a8CB8dfaE313ceE8B",
    rerollBurner: "0xBdDb60d0842cC7DC946f13dd59c96b58F4cCF43e",
  },
};

export function getContracts(chainId: number) {
  const addrs = CONTRACT_ADDRESSES[chainId];
  if (!addrs) throw new Error(`No contracts deployed for chainId ${chainId}`);
  return addrs;
}

export function isPlaceholder(address: `0x${string}`) {
  return address === "0x0000000000000000000000000000000000000000";
}
