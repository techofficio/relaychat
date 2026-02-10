# RelayChat Release Readiness Checklist

Use this checklist before pushing to a new public GitHub repository.

## Build and Test Gates

- [ ] `cargo fmt --all -- --check` passes.
- [ ] `cargo check --workspace` passes.
- [ ] `npm install` completes without errors.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build:packages` passes.
- [ ] `npm run build:web` passes.

## Security and Privacy Gates

- [ ] Relay-only transport default is active (`NetworkExposureMode::RelayOnly`).
- [ ] Relay service has `retain_raw_ip = false` by default.
- [ ] Media sessions enforce relay-only ICE policy for enterprise defaults.
- [ ] Client telemetry redacts `ip`/`address` fields.
- [ ] Secret scan workflow passes (`.github/workflows/security.yml`).

## Repository Governance Gates

- [ ] LICENSE exists and is correct for intended distribution.
- [ ] `README.md`, `MISSION.md`, `NAME.md`, `SECURITY.md`, `CONTRIBUTING.md` are current.
- [ ] Issue templates and PR template are configured.
- [ ] Dependabot config is enabled.
- [ ] Branch protection rules are configured in GitHub (required checks + reviews).

## Product Scope Gates (Current Beta Target)

- [ ] Web and desktop share behavior for messaging + Relay Agents + privacy mode.
- [ ] Mobile supports server/channel/message/agent baseline flows.
- [ ] Relay media signaling endpoints return transport policy + ICE server config.

## Final Push Decision

Push to public repo only when all above checks are complete.
