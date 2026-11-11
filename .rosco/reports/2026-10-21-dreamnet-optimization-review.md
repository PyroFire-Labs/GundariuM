# DreamNet optimization review

Date: 2026-10-21
Correlation: `DN-ROSCOE-20261019-01`
Mission review: `DN-ROSCOE-OPT-20261021-01-REVIEW-1`

## Revision and local evidence

- **CONFIRMED:** The checkout is on `main` at `735dc4ae132beb927e3f4c92fdaa65c3a538fa77`; the mission change is **UNCOMMITTED**.
- **CONFIRMED:** Mission code files are `src/lib/federation/warperKeeperClient.ts` and `src/app/api/federation/submit-battle-receipt/route.ts`; `scripts/test-battle-receipt-client.mjs` is untracked.
- **CONFIRMED:** `node --test scripts/test-battle-receipt-client.mjs` passed 3 tests; root `tsc --noEmit`, targeted ESLint, and `git diff --check` passed on 2026-10-21.

## Request counts

| Case | Before | After | Evidence |
|---|---:|---:|---|
| Unconfigured normal artifact path | 2 | 0 | Before inferred from default URL/source; after asserted by mocked-fetch test. |
| Configured normal export | 2 | 2 | Before inferred from source; after asserted by mocked-fetch test. |
| Configured build HTTP failure | 1 | 1 | Before inferred from source; after asserted by mocked-fetch test. |
| Configured bundle-conversion failure | 2 | 2 | Both inferred from source; untested. |

These are artifact-worker HTTP counts, not model calls, live traffic, or cost measurements.

## Coverage gaps

- **UNTESTED:** Invalid non-empty worker URL; malformed adversarial route payloads; duplicate/replayed calls; interrupted construction; and bundle-conversion partial failure.
- **CONFIRMED:** The adapter generates random idempotency values per MCP call; no receiver/persistence contract establishes duplicate suppression.
- **CONFIRMED:** No abort/retry/resume/reconciliation behavior is implemented in the adapter.

## Existing receiver inventory

| Component | Authentication | Durable persistence | Idempotency | Readback / retention | Result |
|---|---|---|---|---|---|
| `worker-battle-trappers/` | None; public paper-only MCP | None found | None found | Response only; no retention | Not a receiver |
| `gundarium-battle-receipts/` | Remote mechanism unknown | Local Git until authorized commit/push | No runtime intake path | Rebuildable projection; remote retention unknown | Private archive, not live receiver |
| `contracts/src/ArenaBattleLog.sol` | EVM `msg.sender`, if deployed | On-chain if transaction succeeds | One confirmation per user/day, not receipt-payload dedup | Event/view paths in source; deployment state unknown | Separate self-attestation log, not integrated |

No endpoint, queue, key, or service was created. Missing gates are sender authentication policy, stable idempotency, durable write/readback, retention policy, and independent verification.

## Existing model-calling workflow

`src/app/api/generate-kitbash/route.ts` calls `generateKitbashImage`, which calls Gemini once in `src/lib/kitbash/generate.ts`. No retry loop is visible. Given recorded traits and faction, faction validation, derived stats/rarity/armor/weapons, and prompt construction are deterministic candidates. Trait/name selection must not be cached without an explicit recorded seed or canonical trait input. Turnstile, payment, and rate limits are controls, not cache entries.

Usage, latency, cost, and subscription/API records are **UNKNOWN** because none were inspected. A future no-provider comparison should pin synthetic traits/faction and prompt/version, use a local model-call spy for deterministic preflight versus a proposed cache-hit path, and first obtain approval for cache key, invalidation, and retention. It would not establish live-provider savings.
