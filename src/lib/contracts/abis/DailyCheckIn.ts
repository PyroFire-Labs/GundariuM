export const DAILY_CHECKIN_ABI = [
  // ─── User Actions ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "checkIn",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Views ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "getStreak",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "current", type: "uint256" },
      { name: "longest", type: "uint256" },
      { name: "total", type: "uint256" },
      { name: "lastDay", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
      { name: "streak", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },

  // ─── Errors ───────────────────────────────────────────────────────────────
  {
    type: "error",
    name: "AlreadyCheckedInToday",
    inputs: [],
  },
] as const;
