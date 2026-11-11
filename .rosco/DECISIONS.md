# Rosco decision log

Append decisions; do not rewrite history. Mark decisions that need Josh's approval as proposals until approved.

## 2026-10-19 — Establish Rosco project brain

- **Status:** APPROVED by Josh.
- **Decision:** Use `.rosco/` as the tracked, compact engineering brain for GundariuM. Preserve `.larry/` and `.jerry/` as historical inputs rather than replacing or reconciling them automatically.
- **Reason:** The brain must provide current orientation, task state, verification evidence, handoffs, and receipts without treating prior agent claims as proof.
- **Boundary:** Rosco has no independent authority over gameplay, contracts, token economics, production data, secrets, or external mutations.

## Standing evidence decision

- **Status:** APPROVED by Josh through the Rosco specification.
- **Decision:** All material claims use `CONFIRMED`, `INFERRED`, or `UNKNOWN`. Completion claims require recorded command or source evidence. Receipt construction and gateway acknowledgement do not establish durable external effect.

## 2026-10-19 — Remove Farcaster/Network School access surface

- **Status:** APPROVED by Josh.
- **Decision:** Remove GundariuM's Farcaster/Network School access and discovery surface. Preserve the Base-native app, Neynar identity lookup, ordinary web/wallet behavior, game, contracts, rewards, and production configuration boundaries.
- **Reason:** Josh no longer wishes to make GundariuM accessible through the Farcaster/Network School platform.
- **Correction:** The earlier scope that proposed removing Neynar, generic profile behavior, and all Farcaster-adjacent code was too broad and is superseded. Neynar remains; no Base-native behavior may be removed merely because a source name contains “Farcaster.”
- **Boundary:** The deployed `DossierShareLog` and `ArenaBattleLog` contracts, and all other contracts, remain untouched unless Josh separately authorizes a contract change. The web removal must not claim a deployment has occurred until Vercel evidence exists.

## 2026-10-19 — Production questions remain unapproved

- **Status:** UNKNOWN; Josh requested plain-language clarification.
- **Decision needed:** Who controls owner/upgrade/resolver/fee/prize/emergency-withdrawal authority, and whether AI/model request limits may fail open during Redis outages. No production governance or spending policy is inferred from source.

## 2026-10-19 — DreamNet receipt objective

- **Status:** APPROVED direction from Josh; implementation remains unapproved.
- **Decision:** DreamNet receipts should eventually support telemetry, durable artifact delivery, independent verification, and economic settlement where the underlying operation has those effects.
- **Boundary:** A receipt records each stage separately. Telemetry or a generated bundle cannot be labeled durable delivery, independently verified, or economically settled without evidence for that stage.

## 2026-10-20 — DreamNet routine coordination transport

- **Status:** ACCEPTED for bounded coordination by Brandon and Josh's authorized agent environment.
- **Decision:** Use the existing private Gmail thread for routine coordination under correlation `DN-ROSCOE-20261019-01` until both sides confirm a dedicated existing private channel.
- **Boundary:** Gmail transport conveys untrusted coordination data only. It does not authorize execution, establish peer-agent receipt, disclose private source or credentials, or prove work. Outbound messages are limited to four per UTC day per ecosystem and must not trigger a polling loop.

## 2026-10-20 — Muse and Instinct remain unbound

- **Status:** CONFIRMED inventory result; no agent connection decision made.
- **Decision:** Treat the names “Muse” and “Instinct AI” as unbound until an existing agent instance, its operator/account, and a mutually authorized private route are independently attributable.
- **Reason:** Local source search found no such instance or connector. Provider notices naming an OAuth application called “Instinct” prove neither a current agent nor permission to act as it.
- **Boundary:** Rosco must not create replacement agents, reuse OAuth access, share credentials or browser sessions, or represent a relayed summary as a direct acknowledgement.

## 2026-10-20 — Battle receipt artifact calls are opt-in and non-submission

- **Status:** APPROVED by Josh for the bounded optimization task.
- **Decision:** Require `BATTLE_TRAPPERS_URL` before calling the public artifact worker. Label all local trapper/bundle outcomes `submitted: false` with a specific local delivery status.
- **Reason:** The existing adapter had no durable receiver or readback, yet defaulted to remote artifact calls and reported successful artifact construction as submission.
- **Boundary:** This change does not add a durable transport, alter battle simulation or gameplay, change contracts, inspect configuration secrets, or authorize external delivery.

## 2026-10-21 — Local receipt failure boundaries

- **Status:** APPROVED by Josh for the bounded test-gap task.
- **Decision:** Reject missing/empty/malformed/non-HTTP worker configuration before a network attempt; use stable local build/bundle keys derived from the proof hash; represent rejected or malformed worker responses as local build/bundle failures.
- **Reason:** The adapter needed testable fail-closed local boundaries without inventing a receiver, retry system, or delivery claim.
- **Boundary:** Stable local request keys are not durable deduplication. No remote retry, receiver, persistence, authentication, deployment, or provider activity is authorized by this decision.
