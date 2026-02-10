# Multi-Agent Coordination

This file is the single source of truth for active work claims in this repository.

## Rules

1. Before changing code, add or update a task row with `IN_PROGRESS` and list exact file paths.
2. Do not edit files claimed by another active task unless the owner marks it `BLOCKED` or `HANDOFF`.
3. If your scope changes, update your row first, then edit files.
4. When done, set status to `DONE` and add a short handoff note.
5. Do not delete prior rows; keep history by marking old rows `DONE` or `CANCELLED`.

## Status Values

- `IN_PROGRESS`: actively being edited
- `BLOCKED`: waiting on dependency/decision
- `HANDOFF`: ready for another agent to continue
- `DONE`: completed and ready for review
- `CANCELLED`: intentionally stopped

## Active Task Ledger

| Task ID | Owner | Status | Scope | Files | Started (UTC) | Last Update (UTC) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC-003 | codex-agent | DONE | Presence/typing protocol + relay endpoints + mobile notification parity + unread reconciliation tests | `crates/net/src/lib.rs`, `crates/net/Cargo.toml`, `crates/relay-node/src/main.rs`, `packages/protocol/src/index.ts`, `packages/client-sdk/src/index.ts`, `crates/store/src/lib.rs`, `apps/mobile/App.tsx`, `proto/README.md`, `README.md`, `CONTRIBUTING.md` | 2026-02-10T18:43:10Z | 2026-02-10T18:49:03Z | Implemented. Validation blocker: cargo tests require crates.io access (`argon2`) in this environment. |
| RC-004 | codex-agent | DONE | Git bootstrap and publish-readiness prep | `.git/`, `coordination.md` | 2026-02-10T18:55:03Z | 2026-02-10T18:57:13Z | Initialized git, created `codex/bootstrap`, committed baseline (`4b3d53a`). |
| RC-005 | codex-agent | DONE | Configure GitHub remote and push branch | `.git/config`, `coordination.md` | 2026-02-10T18:58:41Z | 2026-02-10T19:05:50Z | `origin` configured and `codex/bootstrap` pushed to GitHub successfully. |
| RC-006 | codex-agent | DONE | Secret/key leak prevention hardening for public repo | `.gitignore`, `CONTRIBUTING.md`, `coordination.md` | 2026-02-10T19:06:47Z | 2026-02-10T19:07:43Z | Added key/env ignore guards and pre-push secret scan guidance; no key-like material found in tracked files/history scans. |
| RC-007 | codex-agent | DONE | Restore local install reliability for browser testing in this environment | `apps/web/package.json`, `apps/desktop/package.json`, `packages/client-sdk/package.json`, `coordination.md` | 2026-02-10T19:08:23Z | 2026-02-10T19:10:27Z | Switched internal deps to `file:` links; no parallel-agent ownership conflicts detected. |
| RC-008 | codex-agent | IN_PROGRESS | Main branch bootstrap, PR flow, branch-protection readiness, validation fixes, README refresh, and M1 kickoff implementation | `.github/workflows/security.yml`, `.eslintrc.cjs`, `package.json`, `package-lock.json`, `packages/protocol/tsconfig.json`, `packages/client-sdk/tsconfig.json`, `packages/ui/tsconfig.json`, `packages/ui/src/workspace-state.ts`, `README.md`, `coordination.md`, `M1_SPRINT.md`, `crates/relay-node/src/main.rs`, `packages/protocol/src/index.ts`, `packages/client-sdk/src/index.ts` | 2026-02-10T19:13:41Z | 2026-02-10T19:23:05Z | Main branch created/pushed; now improving public-facing positioning while continuing validation/M1 foundation work. |

## New Task Template

Add one row to the ledger with:

- Task ID: unique (example `RC-004`)
- Owner: agent/user identifier
- Status: one of the values above
- Scope: one-line objective
- Files: comma-separated paths to be edited
- Started/Last Update: UTC ISO timestamp
- Notes: risks, blockers, or handoff details
