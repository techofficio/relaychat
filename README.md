# RelayChat

**Local-first chat for communities, with decentralized sync and agent-native workflows.**

RelayChat is building a full-featured, cross-platform communication platform with Discord-level usability, stronger ownership guarantees, and enterprise-safe security defaults.

## Why RelayChat

Most chat products force a trade-off:
- Great UX, weak data ownership
- Flexible automation, weak moderation controls
- Scalable collaboration, weak network privacy defaults

RelayChat is designed to remove that trade-off:
- Familiar server/channel/DM model
- Offline-first behavior with deterministic reconciliation
- Hybrid decentralized transport with relay-safe defaults
- Public-key identity and signed records
- Agent-native workflows with moderator-controlled capability scoping

## What Makes It Different

- **Decentralized by default**: hybrid P2P + relay/community nodes
- **Local-first**: client-owned state with append-only event model
- **Enterprise-ready posture**: relay-only mode, no raw client IP retention, policy-driven media routing
- **Agent-safe ecosystem**: `Relay Agents` support with manual approval by default, optional policy-based auto-approval, hard rate/capability controls
- **Cross-platform parity strategy**: web, desktop, and mobile on shared domain and UI semantics

## Current Product Surface

- Server and channel creation
- Direct messages and group DMs
- Offline local message logs (send/edit/delete/reactions)
- Unread + mention counters
- Presence and typing indicators
- Per-channel notification modes
- Agent request/approval flow and public approved-agent directory
- Relay-node baseline APIs for import, events, presence, typing, and media policy enforcement

## Architecture

- **Core domain**: `crates/core`
  - canonical domain types, permissions, agent capability model, signed-record primitives
- **Crypto**: `crates/crypto`
  - signing + verification, recovery-kit encryption path
- **Store**: `crates/store`
  - event store, agent registry, sync cursor persistence, unread reconciliation helpers
- **Network protocol**: `crates/net`
  - sync, publish, presence, typing, and agent RPC envelopes
- **Relay service**: `crates/relay-node`
  - policy-enforcing relay APIs and media-session controls
- **Shared packages**:
  - `packages/protocol` (TypeScript protocol contracts)
  - `packages/client-sdk` (client API layer)
  - `packages/ui` (shared workspace model + UI shell)
- **Clients**:
  - web (`apps/web`)
  - desktop (`apps/desktop`, Tauri)
  - mobile shell (`apps/mobile`, Expo)

## Quick Start

```bash
npm install

# Web
npm run dev:web

# Desktop (requires Tauri prerequisites)
npm run dev:desktop

# Mobile shell
npm run dev:mobile
```

## Security and Trust Model

- Relay-only transport defaults are preserved for safer deployments.
- Raw client IP retention is disabled by default.
- Direct ICE candidates are rejected in relay-only media mode.
- Secret scanning runs in GitHub Actions (`.github/workflows/security.yml`).
- Contributor guardrails for key/secret handling are documented in `CONTRIBUTING.md`.

## Docs

- Mission and product requirements: `MISSION.md`
- Naming and voice: `NAME.md`
- Security baseline: `SECURITY.md`
- Discord parity roadmap: `PARITY_ROADMAP.md`
- Release readiness checklist: `RELEASE_READINESS.md`
- Protocol draft: `proto/README.md`

## Contributing

If you want to help build the next generation of community communication infrastructure, start here:

1. Read `MISSION.md` and `PARITY_ROADMAP.md`.
2. Pick an issue or propose a roadmap-aligned improvement.
3. Follow contribution and security workflow in `CONTRIBUTING.md`.

## Repository Governance

- License: `LICENSE` (MIT)
- CI checks: `.github/workflows/ci.yml`
- Security checks: `.github/workflows/security.yml`
- Dependency updates: `.github/dependabot.yml`
- Issue templates: `.github/ISSUE_TEMPLATE/`
- PR template: `.github/pull_request_template.md`
