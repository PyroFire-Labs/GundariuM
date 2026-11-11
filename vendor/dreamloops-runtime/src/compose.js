import { capsuleContentHash } from "./contracts.js";
import { validateCapsule } from "./validate.js";

function mergeValue(left, right) {
  if (Array.isArray(left) && Array.isArray(right)) return [...new Set([...left, ...right])];
  if (left && right && typeof left === "object" && typeof right === "object") {
    const merged = structuredClone(left);
    for (const [key, value] of Object.entries(right)) merged[key] = key in merged ? mergeValue(merged[key], value) : structuredClone(value);
    return merged;
  }
  return structuredClone(right);
}

export function composeCapsules(base, overlays = [], options = {}) {
  validateCapsule(base);
  overlays.forEach((overlay) => validateCapsule(overlay));

  const blocked = new Set([base, ...overlays].flatMap((capsule) => capsule.permissions.blocked));
  const allowed = new Set([base, ...overlays].flatMap((capsule) => capsule.permissions.allowed));
  for (const permission of blocked) allowed.delete(permission);

  const result = {
    schema: base.schema,
    capsule_id: options.capsuleId || [base, ...overlays].map((capsule) => capsule.capsule_id).join("+"),
    name: options.name || [base, ...overlays].map((capsule) => capsule.name).join(" + "),
    version: options.version || base.version,
    capsule_type: "composed_profile",
    status: options.status || "draft",
    purpose: options.purpose || `Composed from ${[base, ...overlays].map((capsule) => capsule.capsule_id).join(", ")}`,
    payload: [base, ...overlays].reduce((payload, capsule) => mergeValue(payload, capsule.payload), {}),
    permissions: { allowed: [...allowed].sort(), blocked: [...blocked].sort() },
    resource_limits: {
      max_wall_time_ms: Math.min(...[base, ...overlays].map((capsule) => capsule.resource_limits.max_wall_time_ms)),
      max_steps: Math.min(...[base, ...overlays].map((capsule) => capsule.resource_limits.max_steps)),
      max_retries_per_step: Math.min(...[base, ...overlays].map((capsule) => capsule.resource_limits.max_retries_per_step)),
    },
    activation: { mode: "manual_review", rollback_version: base.activation.rollback_version },
    provenance: {
      parents: [base, ...overlays].map((capsule) => ({
        capsule_id: capsule.capsule_id,
        version: capsule.version,
        content_hash: capsule.provenance.content_hash,
      })),
      content_hash: "sha256:" + "0".repeat(64),
    },
  };
  result.provenance.content_hash = capsuleContentHash(result);
  return validateCapsule(result);
}
