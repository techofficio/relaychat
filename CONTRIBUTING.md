# Contributing to RelayChat

## Workflow

1. Create a branch from `main` (prefix `codex/` for generated branches when applicable).
2. Keep changes scoped and include tests or validation notes.
3. Open a pull request using the PR template.

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
- Keep private keys outside the repository (for example in `~/.ssh/` only).
- Run a local secret scan before push:
  `rg -n --hidden --glob '!.git/**' --glob '!**/node_modules/**' "BEGIN (RSA|EC|OPENSSH|PRIVATE KEY)|ssh-(rsa|ed25519) [A-Za-z0-9+/=]+|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]+"`
- Any change to auth/session/media transport policy must update `SECURITY.md`.

## Documentation

Update relevant files when behavior changes:

- `README.md`
- `SECURITY.md`
- `proto/README.md`
- `MISSION.md` (if scope or mission interpretation changes)
