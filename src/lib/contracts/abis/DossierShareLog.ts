export const DOSSIER_SHARE_LOG_ABI = [
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "intentToShare",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "confirmShare",
    inputs: [
      { name: "streak", type: "uint256" },
      { name: "exp", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "hasSharedToday",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "ShareIntentLogged",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ShareConfirmed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
      { name: "streak", type: "uint256", indexed: false },
      { name: "exp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },

  // ─── Errors ───────────────────────────────────────────────────────────────
  { type: "error", name: "AlreadySharedToday", inputs: [] },
  { type: "error", name: "NoIntentForToday", inputs: [] },
  { type: "error", name: "AlreadyConfirmedToday", inputs: [] },
] as const;
