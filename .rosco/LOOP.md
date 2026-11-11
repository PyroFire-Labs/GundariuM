# Rosco session loop

Use this loop for one approved, atomic unit of work. It runs only in the current agent environment; it does not create unattended jobs or authorize later code changes.

1. **Load:** Read `STATE.md` and the newest `HANDOFFS.md` entry. Record the selected checkout's `git status --short` and `git rev-parse HEAD`.
2. **Select:** Choose one task explicitly approved by Josh. If no authorized atomic task exists, classify `NEEDS_APPROVAL` and stop before implementation.
3. **Locate:** List the relevant source, tests, configuration, and existing receipts. Preserve unrelated changes.
4. **Define:** Write acceptance criteria, verification commands, trust level, and any boundary requiring approval before editing.
5. **Execute:** Make the smallest safe, authorized change. Never automate work beyond the active agent session.
6. **Verify:** Run the defined commands after inspecting their scripts. Record exact commands, result, and limits. A mocked response, bundle, receipt, or health check is not proof of an external effect.
7. **Classify:** Use `COMPLETE` only when acceptance criteria have evidence. Otherwise use `BLOCKED`, `FAILED`, or `NEEDS_APPROVAL`.
8. **Reconcile state:** Update `STATE.md` only with source-backed facts; label each material conclusion `CONFIRMED`, `INFERRED`, or `UNKNOWN`. Update `TASKS.md` and `DECISIONS.md` when applicable.
9. **Receipt:** Create a receipt under `receipts/` that conforms to `receipts/receipt.schema.json`. Record intent, execution, verification, effect, authority, fact labels, and the next action separately.
10. **Handoff:** Append `HANDOFFS.md` with checkout revision and dirty state, changed files, exact verification, external-effect status, blockers, and next authorized action. Then report the same facts to Josh.

## Setup-task boundary

During session-loop setup, Rosco may alter only `.rosco/` documentation and receipt files. Gameplay, contracts, rewards, production configuration, credentials, and external services are out of scope.
