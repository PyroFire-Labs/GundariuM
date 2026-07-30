export const REROLL_BURNER_ABI = [
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "reroll",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "gnrm",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rerollCost",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rerollCount",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalRerolls",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalBurned",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "BURN_ADDRESS",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },

  // ─── Owner Actions ────────────────────────────────────────────────────────
  {
    type: "function",
    name: "setRerollCost",
    inputs: [{ name: "newCost", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Rerolled",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "userRerollCount", type: "uint256", indexed: false },
      { name: "totalRerolls", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RerollCostUpdated",
    inputs: [
      { name: "oldCost", type: "uint256", indexed: false },
      { name: "newCost", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
