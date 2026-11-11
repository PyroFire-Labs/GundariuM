# Battle-receipt test gaps

Date: 2026-10-21
Mission: `DN-ROSCOE-OPT-20261021-02-TEST-GAPS`
Baseline: `main` at `735dc4ae132beb927e3f4c92fdaa65c3a538fa77`

## Source-bound baseline

The fixture compiles `HEAD:src/lib/federation/warperKeeperClient.ts` into a temporary directory without resetting or changing the dirty checkout. Baseline SHA-256: `8b99e0a7a3811bc3b8c487ebfd983683af33d7777466c3890ec685b0ed475038`.

With the same synthetic payload and mocked `fetch`, the baseline's unset configuration makes two artifact-worker calls on normal export and reports `submitted: true`; its build HTTP failure makes one call and reports `submitted: false`. The repaired unset path makes zero calls and reports `submitted: false, deliveryStatus: "not_configured"`.

## Case matrix

| Case | Baseline | Repaired | Evidence |
|---|---|---|---|
| Unconfigured normal export | 2 requests; submitted true | 0 requests; not configured | Baseline fixture and repaired fixture, asserted |
| Empty/whitespace config | Not separately measured | 0 requests; not configured | Repaired fixture, asserted |
| Malformed/FTP config | Not separately measured | 0 requests; invalid configuration | Repaired fixture, asserted |
| Configured normal export | 2 requests; submitted true | 2 requests; bundle exported, submitted false | Baseline/source and repaired fixture |
| Build HTTP 503 | 1 request; submitted false | 1 request; build failed, submitted false | Baseline fixture and repaired fixture, asserted |
| Bundle HTTP 503 | 2 requests; partial state untested | 2 requests; trapper built, submitted false | Repaired fixture, asserted |
| Malformed worker JSON / rejected fetch | Untested | 1 request; build failed, submitted false | Repaired fixture, asserted |
| Duplicate same payload | Random local keys; no dedup proof | Same local per-stage keys; still 4 calls for two executions | Repaired fixture, asserted |
| Changed proof hash | Untested | Different local key; still no delivery proof | Repaired fixture, asserted |
| Malformed JSON / wrong-type seed / empty moves | Untested | HTTP 400; zero rate/replay/submission calls | Repaired route-handler fixture, asserted |

There was no existing route body-size/range limit to test. Full BattleCard field validation remains outside the pre-existing route policy and is **UNTESTED**.

## Change set and verification

- `src/lib/federation/warperKeeperClient.ts`: configuration validation, stable local keys, and fetch/JSON failure containment.
- `src/lib/federation/battleReceiptHandler.ts`: testable wrapper of the existing route input/rate/replay/submission sequence.
- `src/app/api/federation/submit-battle-receipt/route.ts`: delegates existing behavior to the wrapper.
- `scripts/test-battle-receipt-client.mjs`: source-bound baseline and repaired fixtures.

```text
node --test scripts/test-battle-receipt-client.mjs
9 pass, 0 fail

./node_modules/.bin/tsc --noEmit
pass

./node_modules/.bin/eslint src/lib/federation/warperKeeperClient.ts src/lib/federation/battleReceiptHandler.ts src/app/api/federation/submit-battle-receipt/route.ts scripts/test-battle-receipt-client.mjs
pass

git diff --check
pass
```

All model calls were zero for this offline mission. Actual credit/cash savings, provider behavior, deployed configuration, durable delivery, remote deduplication, restart recovery, and independent verification are **UNKNOWN**.
