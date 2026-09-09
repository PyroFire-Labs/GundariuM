import { BATTLE_TRAPPER_VERSION } from "./types";

export const battleTrapperSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://battle-trappers.dreamnet.ink/schema/battle-trapper-v1.json",
  title: "GundariuM Battle Trapper",
  description: "Portable, receipted deterministic PvE battle result with a mandatory paper-only execution boundary.",
  type: "object",
  additionalProperties: false,
  required: [
    "contractVersion",
    "id",
    "title",
    "status",
    "createdAt",
    "updatedAt",
    "battle",
    "policy",
    "receipt",
  ],
  properties: {
    contractVersion: { const: BATTLE_TRAPPER_VERSION },
    id: { type: "string", minLength: 8, maxLength: 120 },
    title: { type: "string", minLength: 1, maxLength: 160 },
    status: { const: "closed" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    battle: {
      type: "object",
      additionalProperties: false,
      required: [
        "battleId",
        "chainId",
        "result",
        "deterministic",
        "proofHash",
      ],
      properties: {
        battleId: { type: "string", minLength: 1, maxLength: 64 },
        chainId: { type: "integer", minimum: 1 },
        result: {
          type: "object",
          additionalProperties: false,
          required: ["winner", "turns", "damageDealt"],
          properties: {
            winner: { enum: ["player", "enemy"] },
            turns: { type: "integer", minimum: 1 },
            damageDealt: { type: "integer", minimum: 0 },
          },
        },
        deterministic: { const: true },
        proofHash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
      },
    },
    policy: {
      type: "object",
      additionalProperties: false,
      required: [
        "executionAuthority",
        "walletAuthority",
        "fundsMoved",
        "humanApprovalRequired",
      ],
      properties: {
        executionAuthority: { const: "none" },
        walletAuthority: { const: false },
        fundsMoved: { const: 0 },
        humanApprovalRequired: { const: false },
      },
    },
    receipt: {
      type: "object",
      additionalProperties: false,
      required: ["algorithm", "hash"],
      properties: {
        algorithm: { const: "sha256" },
        hash: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
    },
  },
} as const;