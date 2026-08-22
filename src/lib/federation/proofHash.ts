import { createHash } from "node:crypto";

/**
 * Deterministic JSON stringification (sorted object keys) so the same
 * logical value always hashes to the same string regardless of property
 * insertion order. Same approach dreamnet-git-grid's own `stableJson` uses
 * for its content hashes — matched deliberately, not reinvented.
 */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Hashes exactly the inputs a verifier needs to independently replay a
 * battle and confirm the reported result — not the result alone, which
 * would be trivially fakeable. Server-side only; this is what makes
 * `deterministic: true` a checkable claim instead of a self-assertion.
 */
export function computeProofHash(replayInputs: unknown): string {
  return `sha256:${createHash("sha256").update(stableJson(replayInputs)).digest("hex")}`;
}
