# Battle-receipt truthfulness guard

Date: 2026-10-20
Checkout: `735dc4ae132beb927e3f4c92fdaa65c3a538fa77`
Mission: `DN-ROSCOE-OPT-20261021-01`

## Selected workflow

```text
Arena browser completion
  -> POST /api/federation/submit-battle-receipt
  -> server replay + proof hash
  -> public worker build_battle_trapper
  -> public worker to_warper_keeper_bundle
  -> response ignored by the Arena browser
```

- **CONFIRMED:** The route recomputes the result and proof hash server-side.
- **CONFIRMED:** Before this change, the adapter used a default remote worker URL and labeled built/exported artifacts `submitted: true`.
- **CONFIRMED:** It has no durable receiver call or readback. The two MCP calls are deterministic artifact construction, not model-provider calls and not durable delivery.
- **UNKNOWN:** Deployed configuration, actual provider/API allowance, call volume, elapsed production time, or charges. No environment file or usage record was read.

## Change and acceptance evidence

- Without explicit `BATTLE_TRAPPERS_URL`, return `submitted: false, deliveryStatus: "not_configured"` and do not call `fetch`.
- The configured artifact path returns `trapper_built` or `bundle_exported`, always with `submitted: false`.
- A failed build returns `submitted: false, deliveryStatus: "build_failed"`.

```text
node --test scripts/test-battle-receipt-client.mjs
3 pass, 0 fail

./node_modules/.bin/tsc --noEmit
pass

./node_modules/.bin/eslint src/lib/federation/warperKeeperClient.ts src/app/api/federation/submit-battle-receipt/route.ts scripts/test-battle-receipt-client.mjs
pass

git diff --check
pass
```

The offline test mocks `fetch` and covers unconfigured, normal artifact-export, and failed-build cases. It does not prove a live worker, deployment, durable delivery, provider savings, or independent verification.

## Handoff

The adapter no longer represents a portable bundle as a submitted receipt and avoids default remote artifact-worker calls. A future durable-delivery task requires a named owner-approved receiver, authenticated submission, idempotency semantics, readback, retention decision, and independent verification fixture.
