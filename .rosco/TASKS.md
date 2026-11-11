# Rosco task board

Task states: `ACTIVE`, `BLOCKED`, `NEEDS_APPROVAL`, `COMPLETE`, or `FAILED`. A task is not complete until its stated acceptance criteria have evidence in its receipt or handoff.

## Active

| ID | Status | Scope | Acceptance criteria |
|---|---|---|---|
| farcaster-access-removal-scope | ACTIVE | Identify the smallest change that removes Farcaster/Network School access while preserving Base-native behavior and Neynar. | Classify metadata, manifest, SDK, connector, and sharing paths by whether removing them affects Base-native operation; produce a reviewable minimal-change proposal. |

## Blockers and open verification work

| ID | Status | Question or blocker | Evidence needed |
|---|---|---|---|
| receipt-truth | BLOCKED | Does a battle receipt reach an authorized receiver and become independently verifiable? | Authenticated submit/readback and independent verification evidence; no existing bundle or ACK is sufficient. |
| model-job-recovery | BLOCKED | Can a model job survive dequeue, worker crash, duplicate delivery, and provider uncertainty? | A bounded test with a durable claim/ack/retry contract and reconciliation evidence. |
| transport-durability | BLOCKED | Does any candidate transport support acknowledgement, restart, poison-message handling, and dead-letter visibility? | A two-consumer restart acceptance fixture. |
| deployment-state | UNKNOWN | Which Railway, Cloudflare, and application services are currently live and authorized? | Read-only, authenticated service evidence approved by Josh; no deployment action. |
| muse-instinct-channel-binding | BLOCKED | Which existing Muse and Instinct AI instances, operators, and private channels may participate in direct coordination? | Attributable agent/account identities and an existing mutually authorized private route; an OAuth-provider notice alone is insufficient. |

## Completed

| ID | Completed | Outcome | Evidence |
|---|---|---|---|
| rosco-project-brain-bootstrap | 2026-10-19 | COMPLETE | `receipts/2026-10-19-project-brain-bootstrap.json`; local Markdown-link and JSON-schema validation. |
| rosco-session-loop-setup | 2026-10-19 | COMPLETE | `LOOP.md`; `receipts/2026-10-19-session-loop-setup.json`; local receipt and Markdown-link validation. |
| rosco-repository-inspection | 2026-10-19 | COMPLETE | `reports/2026-10-19-repository-inspection.md`; `receipts/2026-10-19-repository-inspection.json`; source and configuration inspection only. |
| farcaster-removal-scope | 2026-10-19 | COMPLETE, SUPERSEDED | `reports/2026-10-19-farcaster-removal-scope.md`; `receipts/2026-10-19-farcaster-removal-scope.json`; broad initial scope corrected before implementation. |
| muse-instinct-inventory | 2026-10-20 | COMPLETE | `reports/2026-10-20-muse-instinct-inventory.md`; `receipts/2026-10-20-muse-instinct-inventory.json`; source and authorized-mailbox inventory only. |
| battle-receipt-truthfulness-guard | 2026-10-20 | COMPLETE | `reports/2026-10-20-battle-receipt-truthfulness-guard.md`; `receipts/2026-10-20-battle-receipt-truthfulness-guard.json`; opt-in artifact construction and non-submission status verified offline. |
| battle-receipt-test-gaps | 2026-10-21 | COMPLETE | `reports/2026-10-21-battle-receipt-test-gaps.md`; `receipts/2026-10-21-battle-receipt-test-gaps.json`; nine offline baseline/repaired fixtures and scoped static checks. |
| rosco-session-loop-portability | 2026-11-11 | COMPLETE | `receipts/2026-11-11-rosco-session-loop-portability.json`; npm 11.6.2 clean-copy `npm ci` passed and all six `rosco:verify` checks passed. DreamLoop remains `draft`. |
