export const GNDM_STAKING_ABI = [
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "stake",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unstake",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRewards",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "stakedBalance",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalStaked",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "earned",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lockUntil",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rewardEligibleAt",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Staked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "lockUntil", type: "uint256", indexed: false },
      { name: "rewardEligibleAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Unstaked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardForfeited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },

  // ─── Errors ───────────────────────────────────────────────────────────────
  { type: "error", name: "StillLocked",     inputs: [{ name: "unlockTime", type: "uint256" }] },
  { type: "error", name: "NotEligibleYet",  inputs: [{ name: "eligibleAt", type: "uint256" }] },
  { type: "error", name: "NoPendingRewards", inputs: [] },
  { type: "error", name: "NoStakeToUnstake", inputs: [] },
  { type: "error", name: "Unauthorized",    inputs: [] },
  { type: "error", name: "ZeroAmount",      inputs: [] },
  { type: "error", name: "ZeroAddress",     inputs: [] },
] as const;
