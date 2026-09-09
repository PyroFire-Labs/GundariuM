// ─── Canonicalization (matches trading-trappers' canonicalize) ─────

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export async function sha256(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(
    typeof value === "string" ? value : canonicalize(value),
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Types ──────────────────────────────────────────────────────────

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

// ─── Build ──────────────────────────────────────────────────────────

export async function buildBattleTrapper(draft: BattleTrapperDraft): Promise<BattleTrapper> {
  const now = new Date().toISOString();
  const createdAt = draft.createdAt ?? now;

  const id = `gundarium-battle:${draft.chainId}:${draft.battleId}`;

  const withoutReceipt: Omit<BattleTrapper, "receipt"> = {
    contractVersion: BATTLE_TRAPPER_VERSION,
    id,
    title: `PvE Arena Battle ${draft.battleId}`,
    status: "closed",
    createdAt,
    updatedAt: now,
    battle: {
      battleId: draft.battleId,
      chainId: draft.chainId,
      result: draft.result,
      deterministic: true,
      proofHash: draft.proofHash,
    },
    policy: {
      executionAuthority: "none",
      walletAuthority: false,
      fundsMoved: 0,
      humanApprovalRequired: false,
    },
  };

  return {
    ...withoutReceipt,
    receipt: {
      algorithm: "sha256",
      hash: await sha256(withoutReceipt),
    },
  };
}

// ─── Validate ────────────────────────────────────────────────────────

export async function validateBattleTrapper(value: unknown): Promise<ValidationResult> {
  const errors: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, errors: ["trapper must be an object"] };
  }

  const trapper = value as Partial<BattleTrapper>;

  if (trapper.contractVersion !== BATTLE_TRAPPER_VERSION) {
    errors.push(`contractVersion must equal ${BATTLE_TRAPPER_VERSION}`);
  }
  if (!trapper.id?.trim()) errors.push("id is required");
  if (!trapper.title?.trim()) errors.push("title is required");
  if (trapper.status !== "closed") errors.push("status must be closed");

  if (!trapper.battle || typeof trapper.battle !== "object") {
    errors.push("battle is required");
  } else {
    const b = trapper.battle;
    if (!b.battleId?.trim()) errors.push("battle.battleId is required");
    if (typeof b.chainId !== "number") errors.push("battle.chainId must be a number");
    if (!b.result || typeof b.result !== "object") {
      errors.push("battle.result is required");
    } else {
      if (!["player", "enemy"].includes(b.result.winner)) {
        errors.push("battle.result.winner must be 'player' or 'enemy'");
      }
      if (typeof b.result.turns !== "number") {
        errors.push("battle.result.turns must be a number");
      }
      if (typeof b.result.damageDealt !== "number") {
        errors.push("battle.result.damageDealt must be a number");
      }
    }
    if (b.deterministic !== true) {
      errors.push("battle.deterministic must be true");
    }
    if (!b.proofHash?.startsWith("sha256:")) {
      errors.push("battle.proofHash must be a sha256: hash");
    }
  }

  if (!trapper.policy || typeof trapper.policy !== "object") {
    errors.push("policy is required");
  } else {
    if (trapper.policy.executionAuthority !== "none") {
      errors.push("policy.executionAuthority must be 'none'");
    }
    if (trapper.policy.walletAuthority !== false) {
      errors.push("policy.walletAuthority must be false");
    }
    if (trapper.policy.fundsMoved !== 0) {
      errors.push("policy.fundsMoved must be 0");
    }
  }

  if (
    !trapper.receipt ||
    trapper.receipt.algorithm !== "sha256" ||
    !/^[a-f0-9]{64}$/.test(trapper.receipt.hash)
  ) {
    errors.push("receipt must contain a lowercase SHA-256 hash");
  } else {
    // Verify receipt hash integrity — hash is over the trapper minus its receipt field
    const { receipt: _receipt, ...withoutReceipt } = trapper as BattleTrapper;
    void _receipt;
    const expectedHash = await sha256(withoutReceipt);
    if (trapper.receipt!.hash !== expectedHash) {
      errors.push("receipt hash mismatch");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Convert to Warper Keeper bundle ────────────────────────────────

export async function toWarperKeeperBundle(
  trapper: BattleTrapper,
  keeperId = "gundarium",
): Promise<WarperKeeperBundle> {
  const validation = await validateBattleTrapper(trapper);
  if (!validation.valid) {
    throw new Error(`invalid battle trapper: ${validation.errors.join("; ")}`);
  }

  const now = new Date().toISOString();

  const receiptPayload = {
    contractVersion: BATTLE_TRAPPER_VERSION,
    battleTrapperId: trapper.id,
    battleTrapperHash: trapper.receipt.hash,
    mode: "paper",
    executionAuthority: "none",
    transformedAt: now,
  };

  const receiptHash = await sha256(receiptPayload);

  const sources: WarperKeeperBundle["sources"] = [
    {
      id: `source:battle-result:${trapper.id}`,
      keeperId,
      kind: "note",
      title: "Battle Result",
      summary: `${trapper.battle.result.winner} won in ${trapper.battle.result.turns} turns (${trapper.battle.result.damageDealt} damage dealt). Deterministic proof: ${trapper.battle.proofHash}`,
      createdAt: trapper.createdAt,
    },
  ];

  return {
    contractVersion: WARPER_KEEPER_VERSION,
    trapper: {
      id: trapper.id,
      title: trapper.title,
      objective: "Verify the deterministic PvE battle result and its proof hash.",
      riskLevel: "low",
      status: trapper.status,
      createdAt: trapper.createdAt,
      closedAt: trapper.updatedAt,
    },
    sources,
    receipt: {
      id: `receipt:${receiptHash.slice(0, 24)}`,
      trapperId: trapper.id,
      hash: receiptHash,
      payload: receiptPayload,
      createdAt: now,
    },
    exportedAt: now,
    schemaVersion: 1,
    privacyClassification: "public",
    capabilities: ["data:analyze", "proof:generate"],
    permissions: {
      maxContextItems: 50,
      maxSourceBytes: 1_048_576,
      allowedDomains: [],
      maxExecutionSeconds: 300,
    },
  };
}

export const canonicalJson = canonicalize;