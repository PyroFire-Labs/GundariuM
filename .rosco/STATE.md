# GundariuM state and architecture

Last reviewed: 2026-11-11 by Rosco.

## Current project state

- **CONFIRMED:** This checkout's origin is `https://github.com/PyroFire-Labs/GundariuM.git`; its HEAD is `735dc4ae132beb927e3f4c92fdaa65c3a538fa77` (`fix(tasks): correct stale eth_getLogs range limit for Base RPC`, 2026-09-23).
- **CONFIRMED:** Before this brain was added, `git status --short` reported 97 existing entries. They include application, worker, contract-output, generated, and untracked changes. They are outside Rosco's bootstrap scope and must be preserved.
- **CONFIRMED:** The repository has three implementation boundaries: a Next.js application at the root, Foundry contracts under `contracts/`, and a standalone Node/Blender model worker under `worker/`. `worker-battle-trappers/` is a separate Cloudflare Worker package.
- **UNKNOWN:** Current production deployment, Railway service health, contract deployment state, and environment-variable presence. A configured URL or historical note is not proof of live readiness.
- **CONFIRMED:** `LOOP.md` implements Rosco's ten-step, in-session operating procedure. It requires task authorization, bounded verification, separate receipt trust axes, and a handoff; it does not automate future code changes.
- **CONFIRMED:** The 2026-10-19 inspection report is `reports/2026-10-19-repository-inspection.md`. It is source and command cited, with deployment state explicitly left `UNKNOWN` where local source cannot establish it.
- **INFERRED:** Josh reports that `https://gundarium.xyz` is live through GitHub-to-Vercel deployment, and that the current dirty Meshy migration is the intended 2D-NFT-image-to-3D-Arena work. Local source confirms the Meshy-oriented dirty changes exist; deployment and behavior remain unverified here.
- **CONFIRMED:** The next approved objective is to remove GundariuM's Farcaster/Network School access and discovery surface. Base-native app behavior and Neynar integration remain in scope to preserve. See the correction in `reports/2026-10-19-farcaster-removal-scope.md`; on-chain logging contracts are not part of the removal without a separate authorized contract decision.
- **CONFIRMED:** Rosco read the DreamNet coordination handshake `DN-ROSCOE-20261019-01` using the authorized Gmail connector and sent an ACK in the same private thread on 2026-10-20. `COORDINATION.md` records the accepted bounds. This is local transport evidence only; DreamNet-agent receipt and independently verified work remain **UNKNOWN**.
- **CONFIRMED:** No attributable Muse or Instinct AI agent instance or direct coordination channel was found in the GundariuM checkout or the authorized Gmail searches performed on 2026-10-20. Two historical provider notices refer to an OAuth application named “Instinct”; that does not identify an agent instance, operator, present authorization, or communication channel. See `reports/2026-10-20-muse-instinct-inventory.md`.

## Architecture discoveries

- **CONFIRMED:** `src/app/api/federation/submit-battle-receipt/route.ts` replays battle inputs server-side, derives a proof hash, then calls `submitBattleReceipt`.
- **CONFIRMED:** `src/lib/federation/warperKeeperClient.ts` invokes the public battle-trapper MCP tools `build_battle_trapper` and `to_warper_keeper_bundle`; its returned `submitted: true` means local/remote bundle construction at that boundary, not independent proof that an external gateway durably accepted or effected the receipt.
- **CONFIRMED:** `worker/src/queue.ts` removes model jobs using Redis `RPOP`. It has no visible lease, acknowledgement, retry, dead-letter, or deduplication mechanism in that file. A worker failure after dequeue therefore leaves recovery behavior **UNKNOWN** until the complete worker path is tested.
- **CONFIRMED:** The model worker documentation at `worker/README.md` identifies a headless Blender host and real 3D assets as operational dependencies. It also describes manual re-POST as the current response to a failed job.
- **INFERRED:** Receipt truthfulness, transport durability, and job recovery remain the highest-value engineering investigations because the verified implementation boundaries above do not establish durable external effect or recoverable queue processing.
- **CONFIRMED:** On 2026-10-21, the battle-receipt adapter validates missing/empty/malformed/unsupported worker URLs before `fetch`, contains malformed/rejected worker responses, and uses stable local per-stage request keys. Nine offline mocked-fetch/route fixtures, root TypeScript, and targeted ESLint passed. No durable receiver, remote deduplication, retry, or readback was added. See `reports/2026-10-21-battle-receipt-test-gaps.md`.

## Evidence sources

- Root onboarding and baseline: `/Users/joshuagrubbs/Larry/START_HERE.md`, `/Users/joshuagrubbs/Larry/docs/CURRENT_STATE.md`, and `/Users/joshuagrubbs/Larry/discovery/project-genesis/FINAL-DISCOVERY-DELIVERABLE.md`.
- Current source: `src/app/api/federation/submit-battle-receipt/route.ts`, `src/lib/federation/warperKeeperClient.ts`, `worker/src/queue.ts`, and `worker/README.md`.
- Historical inputs, not current truth: `.larry/` and `.jerry/`.

## Rosco session-start DreamLoop rehearsal — 2026-11-10

- **CONFIRMED:** `.rosco/rosco-session-start.dreamloop.json` and the local Capsule pass `@dreamloops/runtime` validation. The loop remains `draft`, has an empty `checks` list, and allows only local context/task/Git reads and local receipt writes; it has no email action.
- **CONFIRMED:** One manual local run executed all five handlers and stopped before implementation because no task was supplied. The Rosco receipt and local Markdown-link checks passed. No external effect occurred.
- **CONFIRMED:** The DreamLoops runtime receipt for this run reports `authority: UNAUTHORIZED`, `verification: UNVERIFIED`, and `effect: UNKNOWN`; the run was locally permission-scoped and emitted a separate Rosco receipt documenting no external effect.
- **CONFIRMED (current, 2026-11-11):** `.rosco/rosco-session.capsule.json` is trackable via a narrow `.gitignore` exception; `.rosco/runtime-state/` remains ignored and generated.
- **CONFIRMED (current, 2026-11-11):** `npm ls @dreamloops/runtime` resolves `@dreamloops/runtime@0.1.0` to `./vendor/dreamloops-runtime`. `package.json` and `package-lock.json` point to the repository-relative vendor package; `rg 'everythingDreamNet' package.json package-lock.json` returned no matches.
- **CONFIRMED (current, 2026-11-11):** All six local Rosco acceptance checks passed, including Capsule/DreamLoop validation, successful local session-start execution, receipt-schema validation, Markdown links, and the no-external-action boundary. The isolated offline clean-checkout fixture installed and imported the vendored runtime successfully. No external effect occurred.
- **CONFIRMED (2026-11-11):** The root lockfile no longer contains the sibling-machine DreamLoops path and includes the optional `bufferutil@4.0.9` peer record required by clean installation. A fresh temporary copy passed `npm ci --ignore-scripts --no-audit --no-fund` using Node `v24.13.0` / npm `11.6.2` (`added 758 packages in 4m`).
- **CONFIRMED (2026-11-11):** In that copy, `npm run rosco:verify` passed all six local acceptance checks. The verification used local files and npm registry package retrieval; no deployment, wallet, contract, or production action occurred. Receipt: `receipts/2026-11-11-rosco-session-loop-portability.json`.
- **UNKNOWN:** Promotion from `draft` to `rehearsed` or `active_local`; it requires separate Josh approval.
