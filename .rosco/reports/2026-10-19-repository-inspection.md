# GundariuM repository inspection

Date: 2026-10-19. Actor: Rosco. Scope: read-only source and configuration inspection. This is a DreamNet review packet, not deployment evidence or authorization to alter gameplay, contracts, rewards, production configuration, or secrets.

## Evidence boundary

- **CONFIRMED:** The inspected checkout is `735dc4ae132beb927e3f4c92fdaa65c3a538fa77` (`fix(tasks): correct stale eth_getLogs range limit for Base RPC`, 2026-09-23). `git status --short` reported 98 entries at session start: 97 pre-existing entries and the existing untracked `.rosco/` directory.
- **CONFIRMED:** The current working tree contains modified and untracked model-worker, model-queue, battle-trapper, generated-contract, and application files. This review does not attribute those changes to a release, deployment, or one author.
- **UNKNOWN:** Deployment health, production environment variables, Railway status, Cloudflare Worker status, Vercel release state, contract ownership, and on-chain code/address correspondence. Local source cannot establish them.
- **CONFIRMED:** No application build, lint, contract test, worker execution, network request, deployment, queue operation, or wallet action was run in this session. Commands below report file and configuration evidence only.

## Verified architecture map

| Boundary | Status | Source evidence | Trust and limit |
|---|---|---|---|
| Web application | **CONFIRMED** Next.js 16 App Router/React 19 application at `src/`; root scripts are in `package.json`. Pages include mint, collection, arena, tasks, leaderboard, dossier, and a PVP route. | `package.json`, `src/app/`, `src/app/battle/page.tsx` | The route tree proves implementation presence, not production availability. |
| Mint and asset flow | **CONFIRMED** `src/app/api/generate-kitbash/route.ts` rolls traits and calls Gemini; `src/app/api/mint-metadata/route.ts` uploads metadata; client mint code is under `src/components/mint/` and `src/lib/contracts/hooks/useMint.ts`. | those paths | Actual provider credentials, payment completion, IPFS persistence, and mainnet behavior are **UNKNOWN**. |
| On-chain NFT and check-in | **CONFIRMED** Foundry sources include UUPS `GunplaCard`, `DailyCheckIn`, `RerollBurner`, `ArenaBattleLog`, and `DossierShareLog`. Address maps include non-zero mainnet entries for those surfaces. | `contracts/src/`, `src/lib/contracts/addresses.ts` | Address-map values are configuration, not independently verified deployment. |
| PVE game engine | **CONFIRMED** PVE uses client simulation and a server deterministic replay for federation telemetry. The Arena calls `/api/federation/submit-battle-receipt`; that route invokes `replayBattle` before proof hashing. | `src/lib/battle/simulate.ts`, `src/lib/battle/deterministicSim.ts`, `src/app/arena/page.tsx`, `src/app/api/federation/submit-battle-receipt/route.ts` | The route is best-effort telemetry, not a settled economic effect. |
| PVP engine | **CONFIRMED** `GundaniumGame.sol` supports EIP-712 trusted-resolver settlement, PVE/PVP stakes, and UUPS upgrades. **CONFIRMED** `/battle` renders `ComingSoon`. **CONFIRMED** mainnet `gundaniumGame` and `prizePool` map values are zero placeholders. | `contracts/src/GundaniumGame.sol`, `src/app/battle/page.tsx`, `src/lib/contracts/addresses.ts` | Mainnet PVP/PrizePool readiness is **UNKNOWN**. |
| 3D model pipeline | **CONFIRMED** `/api/generate-model` enqueues Redis jobs; the worker removes them with `RPOP`, processes a model, uploads a GLB, and writes status. | `src/app/api/generate-model/route.ts`, `src/lib/modelStore.ts`, `worker/src/queue.ts`, `worker/src/worker.ts`, `worker/src/modelStore.ts` | No claim, lease, acknowledgement, retry, or dead-letter protocol appears in `worker/src/queue.ts`; recovery is **UNKNOWN**. |
| DreamNet boundary | **CONFIRMED** `warperKeeperClient.ts` calls public MCP build and bundle-conversion tools. | `src/lib/federation/warperKeeperClient.ts`, `worker-battle-trappers/src/contract.ts` | `submitted: true` is not independent proof of durable gateway receipt, settlement, or external effect. |

## Stack and deployment map

| Surface | Configuration evidence | Status |
|---|---|---|
| Web | Next.js 16.1.6, React 19.2.3, TypeScript, ESLint, Tailwind, wagmi/viem, Upstash, Pinata, Anthropic, Google GenAI, and Farcaster dependencies are declared. | **CONFIRMED** from `package.json`; dependency declarations do not prove provider health. |
| Vercel | `vercel.json` sets alias `gundarium.xyz` and a 15-minute leaderboard cron. The route checks `Authorization: Bearer $CRON_SECRET`. | **CONFIRMED** from `vercel.json` and `src/app/api/cron/refresh-leaderboard/route.ts`; deployment and cron delivery are **UNKNOWN**. |
| Blockchain | `src/lib/wagmi.ts` configures Base and Base Sepolia; addresses are in `src/lib/contracts/addresses.ts`; Foundry enables via-IR with optimizer runs 200. | **CONFIRMED** from those paths; RPC reliability and deployed bytecode are **UNKNOWN**. |
| Model worker | `worker/railway.json` specifies a Dockerfile, one replica, and restart-on-failure up to ten times. | **CONFIRMED** configuration; Railway service, image, secrets, and process health are **UNKNOWN**. |
| Battle Trapper | `worker-battle-trappers/wrangler.jsonc` targets `jerry.gundarium.xyz/*` and enables observability. | **CONFIRMED** configuration; DNS, route ownership, deployment, and forwarding are **UNKNOWN**. |

## Current game-engine subsystem status

- **CONFIRMED:** `GunplaCard.sol` includes NFT minting, whitelist/VIP price paths, cosmetics, USDC withdrawal, mint phases, owner parameters, and UUPS upgrade authorization.
- **CONFIRMED:** `GundaniumGame.sol` includes PVE/PVP session creation, stake transfers, trusted-resolver EIP-712 settlement, PVP fee retention, owner withdrawal, and UUPS upgrade authorization.
- **CONFIRMED:** The Arena has client simulation and server replay. Their behavioral parity is **UNKNOWN** because no test ran in this session.
- **CONFIRMED:** Paid rerolls verify a wallet signature and matching `Rerolled` event before generation, then mark a transaction consumed in Redis after generation. | `src/lib/rerollVerification.ts`, `src/lib/rerollStore.ts`, `src/app/api/generate-kitbash/route.ts` |
- **UNKNOWN:** Liquidity, owner custody, trusted-resolver custody, player activity, and live economic configuration require approved service or chain inspection.

## Existing tests and commands

- **CONFIRMED:** First-party Foundry test files are `contracts/test/ArenaBattleLog.t.sol` (14 declared `test*` functions), `DailyCheckIn.t.sol` (11), `DossierShareLog.t.sol` (13), `GNDMtoGUNR.t.sol` (28), `GunplaCard.t.sol` (33), and `RerollBurner.t.sol` (11): 110 declarations total.
- **CONFIRMED:** No first-party `*.test.*`, `*.spec.*`, or `tests/` files were found under `src/`, `worker/`, or `worker-battle-trappers/` after excluding dependencies.
- **CONFIRMED:** No dedicated first-party tests exist for `contracts/src/GundaniumGame.sol` or `contracts/src/PrizePool.sol`.
- **CONFIRMED:** Declared commands are `npm run lint`, `npm run build`, and `npm run dev` at root; `npm run typecheck` and `npm run worker` under `worker/`; `npm run check` and `npm run lint` under `worker-battle-trappers/`; and `forge build`/`forge test` under `contracts/`.
- **UNKNOWN:** Whether those commands pass now. They were not run because Foundry writes tracked output in this dirty checkout and the authorized task was read-only.

Command evidence captured:

```sh
git status --short
git rev-parse HEAD
git log -1 --format='%H%n%ad%n%s' --date=iso-strict
find contracts/test -maxdepth 2 -type f -print | sort
find src worker worker-battle-trappers -path '*/node_modules/*' -prune -o \
  -type f \( -name '*.test.ts' -o -name '*.spec.ts' -o -name '*.test.tsx' -o -name '*.spec.tsx' -o -path '*/tests/*' \) -print
```

## Current launch blockers

1. **CONFIRMED source blocker:** Mainnet `gundaniumGame` and `prizePool` address-map values are placeholders. `src/lib/contracts/addresses.ts`.
2. **CONFIRMED source blocker:** `RPOP` removes model jobs before external Meshy/Pinata work completes; the queue has no durable recovery protocol. `worker/src/queue.ts`, `worker/src/worker.ts`.
3. **CONFIRMED source blocker:** Durable DreamNet delivery is not demonstrated by the bundle-conversion path. `src/lib/federation/warperKeeperClient.ts`.
4. **CONFIRMED quality blocker:** PVP/PrizePool lack dedicated contract tests; application, model-worker, and battle-trapper tests were not found.
5. **UNKNOWN operational blocker:** Vercel, Railway, Cloudflare, secret, RPC, provider, and chain deployment state.
6. **CONFIRMED release-integrity blocker:** The checkout is materially dirty, including a model migration: `worker/src/meshy.ts` is untracked while worker, queue, UI, and package files are modified.

## Security and economic areas requiring review

- **CONFIRMED review target:** The UUPS, owner-governed contracts need review of owner custody, upgrades, initialization, emergency withdrawal, mint price/phase control, resolver rotation, and parameter changes. `contracts/src/*.sol`.
- **CONFIRMED review target:** `GundaniumGame.sol` relies on `trustedResolver` signatures and lets the owner withdraw retained GNDM fees. Review resolver custody, signature expiry/replay behavior, abandoned PVP sessions, payout invariants, and monitoring.
- **CONFIRMED review target:** `PrizePool.sol` distributes owner-signed winner lists and allows emergency withdrawal. Review signer/owner separation, winner provenance, accounting, cadence, and auditability.
- **CONFIRMED review target:** `checkRateLimit` fails open when Redis errors, removing route-level ceilings during outages. `src/lib/rateLimit.ts` and its AI/model/federation callers.
- **CONFIRMED review target:** The paid-reroll store permits a narrow replay window after isolated Redis errors and treats a post-generation mark failure as logged bookkeeping. `src/lib/rerollStore.ts`, `src/app/api/generate-kitbash/route.ts`.
- **INFERRED review target:** `/api/generate-model` accepts public HTTP(S) image URLs for a provider-backed worker. Review URL allowlisting, provider-fetch behavior, authentication, and spend controls. `src/app/api/generate-model/route.ts`, `worker/src/worker.ts`.

## Context-management weaknesses

- **CONFIRMED:** `.jerry/context.md` is dated 2026-09-05, `.jerry/state.md`/`active.md` 2026-09-09, and `.larry/state.md`/`active.md` 2026-09-14; the inspected HEAD is 2026-09-23 with later uncommitted work.
- **CONFIRMED:** `README.md` is the default Next.js scaffold and does not orient maintainers to the actual system.
- **CONFIRMED:** `CLAUDE.md` describes a Blender-oriented worker while dirty `worker/src/worker.ts` imports `./meshy.js` and `worker/src/meshy.ts` is untracked. Documentation and implementation are unreconciled.
- **CONFIRMED:** No first-party tests cover the application, model worker, or battle-trapper package.
- **INFERRED:** Tracked Foundry output and a dirty tree make verification noisy and obscure intended source changes. `contracts/out/` and `contracts/cache/` appeared in session-start Git status.

## Top five atomic tasks

1. **Model-job durability contract — test-only.** Add a synthetic crash-after-provider-effect, duplicate-delivery, restart, acknowledgement, and dead-letter fixture for `ModelJob`. Acceptance: one simulated effect per idempotency key and visible unreconciled state. Files: `worker/src/queue.ts`, `worker/src/worker.ts`, `src/lib/modelStore.ts`.
2. **Truthful battle-receipt fixture — test-only.** Mock the battle-trapper MCP client and prove build/bundle acknowledgement cannot claim independent receipt or settlement. Files: `src/lib/federation/warperKeeperClient.ts`, `src/app/api/federation/submit-battle-receipt/route.ts`.
3. **PVP/PrizePool contract coverage.** Add Foundry tests for resolver signatures, expiry/replay, payouts/fees, queue state, PrizePool nonce/cadence/accounting, and owner-only functions. Files: `contracts/src/GundaniumGame.sol`, `contracts/src/PrizePool.sol`, new tests.
4. **Model-pipeline release inventory.** Reconcile the Meshy migration with `worker/README.md`, `worker/Dockerfile`, `worker/package.json`, and UI/queue changes into a reviewable change set; do not delete or deploy.
5. **Read-only launch evidence pass.** With Josh-approved service/chain access, verify deployed bytecode, Vercel/cron, Railway worker, Cloudflare route, and DreamNet receipt readback. No mutation.

## Questions requiring Josh’s authority

1. Which dirty changes form the intended release candidate, especially the Meshy migration?
2. Is the next objective mainnet PVP/PrizePool, PVE/receipt reliability, 3D delivery, or a narrower readiness review?
3. Who may authorize read-only Vercel, Railway, Cloudflare, chain-RPC, and DreamNet access?
4. What production governance is approved for owner, upgrade, resolver, fee, prize-distribution, and emergency-withdrawal authority?
5. Is fail-open rate limiting during Redis outages acceptable for AI/model spending, and what provider/image URL policy is approved?
6. What external effect should DreamNet receipts represent: telemetry, durable artifact delivery, independent verification, or economic settlement?

## Inspection classification

**COMPLETE** for local source/configuration inspection. Production deployment, test success, external receipt delivery, on-chain state, and launch readiness remain **UNKNOWN**.
