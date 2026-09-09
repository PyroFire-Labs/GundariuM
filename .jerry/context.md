# GundariuM — Persistent Context

Last updated: 2026-09-05

## How to read this file

This is Jerry's long-term memory for the GundariuM repo. It is not a substitute for the code. It is a summary of what is known, what is verified, what is assumed, and what still needs checking.

Every claim is labeled:
- CONFIRMED — verified from files, commands, or live evidence in this session or a prior verified session
- INFERRED — reasonable conclusion, not re-verified this session
- UNKNOWN — not yet provable from available evidence

## Architecture summary

### Frontend
- Next.js 16.1.6 app at repo root `src/`
- wagmi + viem for wallet/contract interaction — CONFIRMED from `package.json`
- Upstash Redis for leaderboard and lineup storage — CONFIRMED from `src/lib/leaderboardStore.ts` and `src/lib/lineupStore.ts`
- SIWE wallet auth — CONFIRMED from `src/app/api/auth/siwe/route.ts` and auth lib
- Farcaster identity via Neynar — CONFIRMED from `src/lib/neynar.ts` existence
- Rate limiting via `src/lib/rateLimit.ts` — CONFIRMED by import in federation route
- CAPTCHA via `src/lib/turnstile.ts` — CONFIRMED by file existence
- Alerting via Telegram — CONFIRMED from `src/lib/alert.ts`

### Contracts
- Solidity project under `contracts/`
- Foundry build with via-IR and optimizer — CONFIRMED from `contracts/foundry.toml`
- Base Etherscan verification wired via `BASESCAN_API_KEY` — CONFIRMED from `contracts/foundry.toml`
- Key source files CONFIRMED on disk:
  - `contracts/src/GunplaCard.sol`
  - `contracts/src/GundaniumGame.sol`
  - `contracts/src/PrizePool.sol`
  - `contracts/src/GNDMtoGUNR.sol`
  - `contracts/src/DailyCheckIn.sol`
  - `contracts/src/DossierShareLog.sol`
  - `contracts/src/ArenaBattleLog.sol`
  - `contracts/src/RerollBurner.sol`
- Tests under `contracts/test/` — CONFIRMED
- Deploy scripts under `contracts/script/` — CONFIRMED

### Worker
- Separate worker under `worker/`
- Railway service configured in `worker/railway.json` — CONFIRMED
- Model generation pipeline in `worker/blender/` — CONFIRMED by filesystem scan
- Pinata uploads — CONFIRMED from `worker/src/pinataUpload.ts` and `src/lib/pinata/upload.ts`
- In-memory model store in `worker/src/modelStore.ts` — CONFIRMED

### Federation path
- Battle receipt submission at `src/app/api/federation/submit-battle-receipt/route.ts` — CONFIRMED
- Warper Keeper MCP client at `src/lib/federation/warperKeeperClient.ts` — CONFIRMED
- Proof hash at `src/lib/federation/proofHash.ts` — CONFIRMED
- Default gateway URL: `https://warper-keeper-agent-gateway-production.up.railway.app/mcp` — CONFIRMED from `warperKeeperClient.ts`
- Tool used: `submit_artifact` — CONFIRMED
- Payload shape includes `gundarium.battle.result`, idempotency key, correlation id — CONFIRMED
- Fails open when `WARPER_KEEPER_ASSIGNMENT_KEY` missing — CONFIRMED

### Battle simulation
- Deterministic PvE combat in `src/lib/battle/deterministicSim.ts` — CONFIRMED
- Shared by client arena page and server receipt route — CONFIRMED
- Armor types, weapon slots, crit chances, turn cap all defined there — CONFIRMED
- Server re-derives result via `replayBattle` — CONFIRMED

## Current decisions

- Federation path exists but assignment key not confirmed set in this session — INFERRED/UNKNOWN
- 3D rendering engine is the current approved priority — from Josh verbal confirmation, recorded as INFERRED until scoped/verified
- DreamNet receipts should be deterministic and reproducible — implied by existing proof hash and server-side replay, recorded as CONFIRMED for the path that exists
- Jerry spec approved: technical chief of staff, context keeper, task orchestrator, verification gate, DreamNet liaison — from user approval
- Jerry must not change game rules, contracts, token economics, production data, or secrets without Josh — from Jerry spec approval

## Known open questions

- Is `WARPER_KEEPER_ASSIGNMENT_KEY` set in Vercel env?
- Do battle receipts currently round-trip all the way through DreamNet?
- What is the exact live contract address set for each contract?
- What are the current live env var values, aside from what code references?
- What is the exact scope of the 3D rendering engine work?
- What platform/hardware is available for 3D rendering work?

## Verification commands

Repo root: `/Users/joshuagrubbs/Larry/GundariuM`

- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`
- Contract test: `cd contracts && forge test`
- Contract build: `cd contracts && forge build`
- File existence check for Jerry brain: `test -f .jerry/state.md && test -f .jerry/context.md && test -f .jerry/active.md && test -f .jerry/done.md && test -f .jerry/log.md`
- Schema validation for one file: `node -e "JSON.parse(require('fs').readFileSync('.jerry/schemas/<name>.json','utf8')); console.log('valid')"`

## Runbooks referenced

- Project brain README: `.jerry/README.md`
- Fact schema: `.jerry/schemas/fact.json`
- Task schema: `.jerry/schemas/task.json`
- Decision schema: `.jerry/schemas/decision.md`
- DreamNet receipt schema: `.jerry/schemas/dreamnet-receipt.json`
- Context update schema: `.jerry/schemas/context-update.md`

## Session continuity

- Session log: `.jerry/log.md`
- Active work: `.jerry/active.md`
- Completed work: `.jerry/done.md`
- Current state snapshot: `.jerry/state.md`
