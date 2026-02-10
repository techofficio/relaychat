# RelayChat (Distributed)

A decentralized, local-first, cross-platform chat platform.

The project mission is documented in `MISSION.md`.
Naming and brand conventions are documented in `NAME.md`.
Security baseline and enterprise controls are documented in `SECURITY.md`.
Discord parity execution plan is documented in `PARITY_ROADMAP.md`.
Multi-agent work claims are coordinated in `coordination.md`.
Contribution process is documented in `CONTRIBUTING.md`.
Release checklist is documented in `RELEASE_READINESS.md`.

## Current Status

This repository now includes a usable shared workspace UI for web and desktop with local persistence:

- Server and channel creation
- Direct messages and group direct messages baseline flows
- Offline-persisted local message logs (send, edit, delete, reactions)
- Unread and mention counters at channel/direct message level
- Presence + typing indicators and per-channel notification mode controls
- Public-key-oriented architecture scaffolding in Rust crates
- Desktop app workspace persistence bridged through Tauri app-data storage
- Agent registry workflow with:
  - manual approval by default
  - moderator-controlled auto-approval
  - public approved-agent directory
- relay-only transport defaults to reduce end-user IP exposure
- relay-only media candidate policy to reject direct ICE candidates by default

## Architecture Direction

- **Identity**: public-key identities and signed records (`crates/core`)
- **Data**: append-only event model and storage interfaces (`crates/core`, `crates/store`)
- **Network**: sync and agent moderation envelope types (`crates/net`)
- **Clients**:
  - Web (`apps/web`)
  - Desktop via Tauri (`apps/desktop`)
  - Mobile shell via Expo (`apps/mobile`)
- **Shared UX core**: reusable workspace UI/state (`packages/ui`)

## Repo Layout

- `MISSION.md` - product mission and MVP acceptance criteria
- `proto/README.md` - protocol notes and envelope draft
- `crates/core` - identity and domain records
- `crates/store` - event and agent-registry store abstractions
- `crates/net` - transport envelope definitions
- `packages/ui` - shared local-first workspace state + UI
- `apps/web` - React + Vite client
- `apps/desktop` - React + Vite + Tauri client
- `apps/mobile` - React Native (Expo) shell

## Dev Commands

```bash
npm install

# Web
npm run dev:web

# Desktop (requires Tauri prerequisites)
npm run dev:desktop

# Mobile shell
npm run dev:mobile
```

## Next Build Priorities

1. Execute `PARITY_ROADMAP.md` Phase P0 through P4.
2. Complete P0 foundation gates before public push claims.
3. Prioritize parity tracks that unlock Discord migration confidence:
   - DMs/presence/unreads
   - role/permission enforcement + audit logs
   - production voice/video transport path
4. Keep enterprise privacy defaults locked:
   - relay-only exposure by default
   - no raw client IP retention
   - direct ICE candidate rejection in relay-only mode

## Repository Governance

- License: `LICENSE` (MIT)
- CI: `.github/workflows/ci.yml`
- Security scans: `.github/workflows/security.yml`
- Dependency updates: `.github/dependabot.yml`
- Issue templates: `.github/ISSUE_TEMPLATE/`
- PR template: `.github/pull_request_template.md`
