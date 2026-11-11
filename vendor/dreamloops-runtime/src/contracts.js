import crypto from "node:crypto";

export const CAPSULE_SCHEMA = "dreamnet.synergy_capsule.v1";
export const DREAMLOOP_SCHEMA = "dreamnet.dreamloop.v1";

export const PERMISSION_TIERS = Object.freeze([
  "read_only",
  "local_draft_write",
  "artifact_draft_write",
  "private_branch_write_candidate",
  "live_guarded_action",
  "production_write",
]);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function capsuleContentHash(manifest) {
  const copy = structuredClone(manifest);
  if (copy.provenance) delete copy.provenance.content_hash;
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(copy)).digest("hex")}`;
}
