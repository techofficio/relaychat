# RelayChat Discord Parity Roadmap

This roadmap translates `MISSION.md` into feature-complete execution toward Discord-level parity while preserving RelayChat's decentralized, privacy-first model.

## 1) Mission Alignment Guardrails

- Easy to use: familiar server/channel/DM/thread UX across web, desktop, mobile.
- Full featured: parity for messaging, voice/video, moderation, roles, permissions, onboarding, integrations.
- Decentralized by design: local-first storage, signed records, hybrid p2p + relay fallback.
- Enterprise-ready privacy: relay-only defaults, no raw IP retention, auditable policy controls.
- Agent-friendly, anti-spam: manual approval default, scoped capabilities, enforced rate limits, public approved directory.

## 2) Parity Matrix (Current vs Target)

### A. Core Communication

- `Done`: channels, messaging CRUD basics, reactions, reply metadata, pins, thread creation, local import scaffold.
- `Missing for parity`: DMs/group DMs, rich text/markdown, mentions + notifications, presence/typing, search, unread tracking, message links/jump.

### B. Community and Moderation

- `Done`: agent policy modes, pending/approved/rejected states, public approved-agent list scaffold.
- `Missing for parity`: role hierarchy, channel/category ACL matrix, moderation logs, member management, invite lifecycle, anti-abuse automod, audit exports.

### C. Voice and Video

- `Done`: media session scaffold, relay-only ICE enforcement path, join voice/video/screenshare state.
- `Missing for parity`: actual WebRTC session pipeline, SFU media forwarding, device switching, stage channels, recording policy hooks, QoS adaptation.

### D. Identity and Security

- `Done`: public-key identity model, signed-record types, recovery-kit envelope, relay privacy defaults.
- `Missing for parity`: production passkey UX, verified signature enforcement in all ingest paths, key rotation, SSO/SAML/OIDC policy enforcement, admin security controls.

### E. Cross-Platform Consistency

- `Done`: shared web/desktop UI baseline.
- `Missing for parity`: mobile feature lockstep via shared client SDK + policy behavior parity.

### F. Reliability and Operations

- `Done`: CI and security workflows.
- `Missing for parity`: observability baselines, replay/reconciliation soak tests, production deployment model, incident runbooks.

## 3) New Feature Tracks to Add Now

1. **DM and Presence Track**
- Add `DirectMessageChannel` and `GroupDM` domain types.
- Add typing + presence events to protocol and UI.
- Add unread counters, mentions, and notification preferences.

2. **Role/Permissions and Mod Track**
- Implement role hierarchy with deny/allow merge rules.
- Add per-channel/category ACL editor and effective-permission preview.
- Add moderation audit timeline and exportable moderation reports.

3. **Search and Discovery Track**
- Add local-first indexed search (channels, users, messages).
- Add jump-to-message and permalink support.
- Add filters for `from:`, `has:attachment`, `before/after`.

4. **Real Voice/Video Track**
- Replace media stubs with real signaling + SFU integration.
- Enforce relay-only policy and candidate filtering server-side and client-side.
- Add role-gated speaking/video/screenshare controls and waiting-room policies.

5. **Enterprise Security Track**
- Add tenant policy profile: relay-only locked mode, no direct candidates, strict logging redaction.
- Add per-tenant KMS-backed secret handling for TURN credentials.
- Add SSO + SCIM hooks (phased) and immutable admin audit logs.

6. **Agent Platform Track**
- Add capability templates and approval workflows by server role.
- Enforce dual-throttle limits (per-agent and per-server).
- Add agent observability: action logs, denial reasons, abuse counters.

7. **Migration Track**
- Expand Discord importer for roles, categories, threads, attachment metadata, channel permissions.
- Add import validation report with deterministic retry checkpoints.

## 4) Ordered Next Steps (Execution)

1. **Phase P0 (1-2 weeks): Stabilize Foundations**
- Finalize canonical protocol schema and TS generation pipeline.
- Replace UI `localStorage` with shared SQLite-backed persistence abstraction.
- Enforce signature verification for all accepted events and agent grants.
- Deliver: deterministic offline replay test suite (Rust + TS integration).

2. **Phase P1 (2-4 weeks): Text + Moderation Parity Core**
- Implement DMs/group DMs, mentions, unread model, typing/presence events.
- Implement roles/permissions with channel/category ACLs.
- Add moderation audit log and invite lifecycle controls.
- Deliver: web/desktop parity demo on real sync.

3. **Phase P2 (3-5 weeks): Voice/Video Production Path**
- Integrate SFU signaling in `relay-node` and SDK.
- Implement real media sessions and role-gated permissions.
- Add QoS and failover logic for constrained networks.
- Deliver: cross-platform voice/video soak test report.

4. **Phase P3 (2-4 weeks): Mobile Lockstep + Importer**
- Move mobile to shared SDK/state model for policy parity.
- Expand Discord importer and validation/retry workflows.
- Deliver: parity checklist pass for web/desktop/mobile.

5. **Phase P4 (2-3 weeks): Enterprise Hardening + Beta Launch**
- Add org policy profiles, SSO stubs/integration points, admin audit exports.
- Complete security review and abuse-resilience scenarios.
- Deliver: public beta launch gate from `RELEASE_READINESS.md` plus parity gates below.

## 5) Parity Acceptance Gates (Additive to RELEASE_READINESS)

- DM/group DM, mentions, and unread model operate offline and sync deterministically.
- Role + ACL enforcement blocks unauthorized actions across all clients.
- Voice/video sessions work with relay-only policy and no peer IP leakage.
- Agent approval/rate-limit/capability boundaries are enforced and audited.
- Discord import handles channels/threads/roles with explicit unsupported-item reporting.
- Mobile behavior matches web/desktop for server/channel/message/agent policy paths.

## 6) Non-Goals for Beta

- Marketplace-style third-party monetization.
- Federated bridging to external networks by default.
- Fully decentralized identity recovery without optional relay support.

These remain post-beta expansion items.
