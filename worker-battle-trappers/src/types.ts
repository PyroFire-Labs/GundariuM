export const BATTLE_TRAPPER_VERSION = "gundarium-battle-trapper/1" as const;
export const WARPER_KEEPER_VERSION = "warper-keeper-trapper/1" as const;

export interface BattleResult {
  winner: "player" | "enemy";
  turns: number;
  damageDealt: number;
}

export interface BattleTrapperDraft {
  battleId: string;
  chainId: number;
  result: BattleResult;
  proofHash: string;
  replayInputs: {
    seed: number;
    moves: string[];
    player: Record<string, unknown>;
    enemy: Record<string, unknown>;
  };
  createdAt?: string;
}

export interface BattleTrapper {
  contractVersion: typeof BATTLE_TRAPPER_VERSION;
  id: string;
  title: string;
  status: "closed";
  createdAt: string;
  updatedAt: string;
  battle: {
    battleId: string;
    chainId: number;
    result: BattleResult;
    deterministic: true;
    proofHash: string;
  };
  policy: {
    executionAuthority: "none";
    walletAuthority: false;
    fundsMoved: 0;
    humanApprovalRequired: false;
  };
  receipt: {
    algorithm: "sha256";
    hash: string;
  };
}

export interface WarperKeeperBundle {
  contractVersion: typeof WARPER_KEEPER_VERSION;
  trapper: {
    id: string;
    title: string;
    objective: string;
    riskLevel: "low" | "medium" | "high";
    status: "open" | "closed";
    createdAt: string;
    closedAt: string | null;
  };
  sources: Array<{
    id: string;
    keeperId: string;
    kind: "note" | "link" | "repository" | "file";
    title: string;
    summary: string;
    contentExcerpt?: string;
    createdAt: string;
  }>;
  receipt: {
    id: string;
    trapperId: string;
    hash: string;
    payload: Record<string, unknown>;
    createdAt: string;
  };
  exportedAt: string;
  schemaVersion: 1;
  privacyClassification: "public" | "private";
  capabilities: string[];
  permissions: {
    maxContextItems: number;
    maxSourceBytes: number;
    allowedDomains: string[];
    maxExecutionSeconds: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}