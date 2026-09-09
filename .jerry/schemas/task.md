# Jerry task template

Use this shape when capturing a task in `active.md` or `done.md`. A task is one atomic unit of work with a clear boundary, a clear owner, and a clear way to verify completion.

## Fields

- id: short stable identifier, for example `jerry-init.state-files`
- title: one-line plain-English description
- status: TODO / IN_PROGRESS / DONE / BLOCKED / NEEDS_APPROVAL / FAILED
- owner: who is responsible, for example `Jerry` or `Josh`
- scope: what is included, and explicitly what is not
- constraints: any hard limits, for example `.jerry/ only`, `no contracts`, `no production config`
- approval_basis: why this task is allowed to proceed now
- acceptance_criteria: what must be true for this to count as done
- verification: concrete commands or checks that prove it
- evidence: where the proof lives, for example file paths, command output, or links
- fact_labels: any CONFIRMED / INFERRED / UNKNOWN claims involved
- created_at: date
- updated_at: date

## Example

- id: jerry-init.state-files
- title: Create missing Jerry state files and validate them
- status: DONE
- owner: Jerry
- scope: state.md, context.md, active.md, done.md, log.md
- constraints: `.jerry/` only, no gameplay, no contracts, no rewards, no production config
- approval_basis: Jerry spec approved by user; user told me to continue after files were missing
- acceptance_criteria: all five files exist, fact-label discipline present, JSON schemas parse, no CRLF contamination
- verification: `test -f .jerry/<file>` for each file; `node -e "JSON.parse(...)"` for each schema; `grep -oE 'CONFIRMED|INFERRED|UNKNOWN'` to confirm labels
- evidence: `.jerry/log.md` entry for this session
- fact_labels: filesystem existence is CONFIRMED; project status claims from Josh are INFERRED until independently verified
- created_at: 2026-09-05
- updated_at: 2026-09-05
