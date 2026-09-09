# Jerry — GundariuM Project Brain

This directory is Jerry's persistent context for the GundariuM repo.

It is not production data. It is not game rules. It is not a substitute for the real code, contracts, or live state.

## What lives here

- `README.md` — this file. Start here.
- `schemas/` — templates and schemas for facts, tasks, decisions, context updates, and DreamNet receipts.
- `receipts/` — DreamNet-compatible battle receipts, one file per receipt.
- `state.md` — current project state summary. This is the living fact sheet.
- `context.md` — persistent context across sessions: architecture, decisions, blockers, runbooks, verification commands.
- `active.md` — what is being worked on right now and what is waiting.
- `done.md` — completed work with evidence links.
- `log.md` — session log with timestamps and fact labels.

## How to use this

Before touching the repo, read:

1. `.jerry/README.md`
2. `.jerry/state.md`
3. `.jerry/context.md`
4. `.jerry/active.md`

After working, update:

1. `.jerry/state.md` if anything changed in current state
2. `.jerry/context.md` if you learned something structural
3. `.jerry/active.md` or `.jerry/done.md` for task progress
4. `.jerry/log.md` with what happened and the evidence

## Fact labels

Every claim about the project must be labeled:

- **CONFIRMED** — verified from live evidence: passing `forge test`/`forge build`, passing `npm run lint`, `npx tsc --noEmit`, a deploy confirmation, a log, an on-chain check, or a confirmed DreamNet receipt round trip.
- **INFERRED** — reasonable conclusion from existing evidence, not yet directly re-verified in this session.
- **UNKNOWN** — not provable from the evidence available right now.

Do not upgrade a label without evidence. Do not downgrade a label without reason.

## What Jerry does here

Jerry keeps this brain accurate, breaks work into verifiable steps, gates work behind evidence, and coordinates GundariuM ↔ DreamNet receipts. Jerry does not change game rules, contracts, token economics, production data, or secrets without Josh.

## Receipts

Battle receipts go in `.jerry/receipts/`. File name pattern:

    receipts/<timestamp>-<battleId>.json

Each receipt file uses the schema in `schemas/dreamnet-receipt.json`. Receipts describe what happened and what proof exists. They do not by themselves mean the DreamNet side confirmed anything. Confirmed round trips get marked in the receipt and in `done.md`.

## Validation

Markdown files are checked for basic well-formedness. JSON files are validated by loading them. TypeScript files in this directory are type-checked with `tsc --noEmit`.

Run from the repo root:

    npm run lint
    npx tsc --noEmit
    node -e "require('./.jerry/state.md')"  # only for JSON files

Markdown does not have a linter in this repo. Keep it readable and consistent.

## Scope

This brain covers GundariuM engineering context. It does not hold secrets, private keys, tokens, or production-write authority.
