import { createHash } from "node:crypto";

/**
 * Deterministic JSON canonicalization (sorted keys, undefined values
 * filtered) so the same logical value always hashes to the same string
 * regardless of property insertion order. Matches the canonicalize()
 * used by dreamnet-trading-trappers/src/contract.ts, DreamNet Public
 * Core's canonicalJson, and the Warper Keeper worker's own
 * canonicalJson — all three filter undefined and sort keys. This was
 * previously `stableJson` which did NOT filter undefined, causing hash
 * mismatches against every other DreamNet component.
 */
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

/**
 * Hashes exactly the inputs a verifier needs to independently replay a
 * battle and confirm the reported result — not the result alone, which
 * would be trivially fakeable. Server-side only; this is what makes
 * `deterministic: true` a checkable claim instead of a self-assertion.
 */
export function computeProofHash(replayInputs: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalize(replayInputs)).digest("hex")}`;
}
