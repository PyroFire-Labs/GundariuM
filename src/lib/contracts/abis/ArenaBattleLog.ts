export const ARENA_BATTLE_LOG_ABI = [
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
    name: "confirmBattleShare",
    inputs: [
      { name: "playerName", type: "string" },
      { name: "enemyName", type: "string" },
      { name: "won", type: "bool" },
      { name: "hpPct", type: "uint16" },
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
    name: "BattleShareConfirmed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "day", type: "uint256", indexed: false },
      { name: "playerName", type: "string", indexed: false },
      { name: "enemyName", type: "string", indexed: false },
      { name: "won", type: "bool", indexed: false },
      { name: "hpPct", type: "uint16", indexed: false },
    ],
    anonymous: false,
  },

  // ─── Errors ───────────────────────────────────────────────────────────────
  { type: "error", name: "AlreadySharedToday", inputs: [] },
  { type: "error", name: "NoIntentForToday", inputs: [] },
  { type: "error", name: "AlreadyConfirmedToday", inputs: [] },
] as const;
