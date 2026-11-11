# GundariuM state and architecture

Last reviewed: 2026-10-20 by Rosco.

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
