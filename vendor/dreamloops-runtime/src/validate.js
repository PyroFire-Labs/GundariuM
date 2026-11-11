import { CAPSULE_SCHEMA, DREAMLOOP_SCHEMA, PERMISSION_TIERS, capsuleContentHash } from "./contracts.js";

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} must be non-empty text`);
  return value;
}

function list(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function positiveInteger(value, name, maximum) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

export function validateCapsule(manifest, { verifyHash = true } = {}) {
  object(manifest, "capsule");
  if (manifest.schema !== CAPSULE_SCHEMA) throw new Error(`unsupported capsule schema: ${manifest.schema}`);
  text(manifest.capsule_id, "capsule.capsule_id");
  text(manifest.name, "capsule.name");
  text(manifest.version, "capsule.version");
  text(manifest.capsule_type, "capsule.capsule_type");
  text(manifest.status, "capsule.status");
  text(manifest.purpose, "capsule.purpose");
  object(manifest.payload, "capsule.payload");
  object(manifest.permissions, "capsule.permissions");
  list(manifest.permissions.allowed, "capsule.permissions.allowed").forEach((item) => text(item, "allowed permission"));
  list(manifest.permissions.blocked, "capsule.permissions.blocked").forEach((item) => text(item, "blocked permission"));
  object(manifest.resource_limits, "capsule.resource_limits");
  positiveInteger(manifest.resource_limits.max_wall_time_ms, "max_wall_time_ms", 86_400_000);
  positiveInteger(manifest.resource_limits.max_steps, "max_steps", 1_000);
  positiveInteger(manifest.resource_limits.max_retries_per_step, "max_retries_per_step", 10);
  object(manifest.activation, "capsule.activation");
  text(manifest.activation.mode, "capsule.activation.mode");
  text(manifest.activation.rollback_version, "capsule.activation.rollback_version");
  object(manifest.provenance, "capsule.provenance");
  text(manifest.provenance.content_hash, "capsule.provenance.content_hash");

  const overlap = manifest.permissions.allowed.filter((item) => manifest.permissions.blocked.includes(item));
  if (overlap.length) throw new Error(`permissions cannot be both allowed and blocked: ${overlap.join(", ")}`);
  if (verifyHash && capsuleContentHash(manifest) !== manifest.provenance.content_hash) {
    throw new Error("capsule content hash mismatch");
  }
  return manifest;
}

export function validateDreamLoop(manifest) {
  object(manifest, "dreamloop");
  if (manifest.schema !== DREAMLOOP_SCHEMA) throw new Error(`unsupported dreamloop schema: ${manifest.schema}`);
  for (const field of ["loop_id", "title", "version", "status", "owner", "trigger", "cooldown", "promotion_path", "last_reviewed"]) {
    text(manifest[field], `dreamloop.${field}`);
  }
  if (!PERMISSION_TIERS.includes(manifest.permission_tier)) throw new Error("unsupported permission tier");
  for (const field of [
    "stewards", "inputs", "context_sources", "allowed_actions", "blocked_actions", "checks",
    "evidence_outputs", "receipt_outputs", "knowledge_state_outputs", "execution_trace_outputs",
    "memory_routes", "failure_modes", "steps",
  ]) list(manifest[field], `dreamloop.${field}`);

  object(manifest.limits, "dreamloop.limits");
  positiveInteger(manifest.limits.max_wall_time_ms, "limits.max_wall_time_ms", 86_400_000);
  positiveInteger(manifest.limits.max_steps, "limits.max_steps", 1_000);
  positiveInteger(manifest.limits.max_retries_per_step, "limits.max_retries_per_step", 10);
  if (manifest.steps.length > manifest.limits.max_steps) throw new Error("dreamloop exceeds max_steps");

  const ids = new Set();
  for (const step of manifest.steps) {
    object(step, "dreamloop step");
    text(step.id, "step.id");
    text(step.handler, "step.handler");
    text(step.permission, "step.permission");
    if (ids.has(step.id)) throw new Error(`duplicate step id: ${step.id}`);
    ids.add(step.id);
    if (!manifest.allowed_actions.includes(step.permission)) throw new Error(`step permission is not allowed: ${step.permission}`);
    if (manifest.blocked_actions.includes(step.permission)) throw new Error(`step permission is blocked: ${step.permission}`);
    if (step.retry) {
      object(step.retry, "step.retry");
      positiveInteger(step.retry.max_attempts, "step.retry.max_attempts", manifest.limits.max_retries_per_step + 1);
    }
  }
  return manifest;
}
