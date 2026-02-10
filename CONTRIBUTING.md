# Contributing to RelayChat

## Workflow

1. Create a branch from `main` (prefix `codex/` for generated branches when applicable).
2. Keep changes scoped and include tests or validation notes.
3. Open a pull request using the PR template.

## Multi-agent coordination

1. Before editing files, claim your task in `coordination.md` and set status to `IN_PROGRESS`.
2. List exact file paths you plan to edit and update the row before scope changes.
3. Do not edit files owned by another active task unless the row is `BLOCKED` or `HANDOFF`.
4. When finished, mark your row `DONE` (or `HANDOFF` with clear next steps).

## Local checks

Run before opening a PR:

```bash
cargo fmt --all -- --check
cargo check --workspace
npm install
npm run lint
npm run typecheck
npm run build:packages
npm run build:web
```

## Security and privacy requirements

- Do not expose or log end-user IP addresses without explicit approved policy.
- Keep relay-only defaults for enterprise-safe deployments.
- Do not commit secrets, tokens, private keys, or credentials.
- Any change to auth/session/media transport policy must update `SECURITY.md`.

## Documentation

Update relevant files when behavior changes:

- `README.md`
- `SECURITY.md`
- `proto/README.md`
- `MISSION.md` (if scope or mission interpretation changes)
