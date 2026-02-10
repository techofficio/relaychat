# RelayChat Next Roadmap

## Scope
This roadmap focuses on dark-first UX quality and Discord-parity features that directly improve migration readiness.

## Locked Product Decisions
- Theme defaults to dark mode.
- Light mode is available via toggle.
- Visual direction is bold cyberpunk but still enterprise-readable.
- Feature priority is messaging + moderation before voice/video expansion.
- Rollout sequence is web first, then desktop/mobile parity.

## Phase 1 (Weeks 1-2): Design Foundation
- Add persisted theme state (`dark`/`light`) in shared UI workspace state.
- Replace hard-coded colors with semantic tokenized styling.
- Ship dark-first layout and interaction polish across shared workspace UI.
- Add accessibility pass for contrast and focus states.

## Phase 2 (Weeks 3-5): Messaging Parity
- Mentions and unread behavior improvements.
- Message permalink/jump-to-message flow.
- Local-first search filters (`from`, `before/after`, `has:attachment`).
- Notification behavior hardening per channel/DM.

## Phase 3 (Weeks 6-8): Moderation Parity
- Role hierarchy + channel/category permission matrix.
- Effective-permission inspector in UI.
- Moderation audit timeline and exports.
- Invite lifecycle controls and basic automod rules.

## Phase 4 (Weeks 9-10): Platform Parity
- Port finalized token system and workflows to desktop/mobile.
- Ensure feature semantics match web for server/channel/message/mod flows.
- Complete responsive behavior and platform UX constraints.

## Phase 5 (Weeks 11-12): Hardening
- Reliability and performance pass across large channel histories.
- Security/privacy validation on relay-only and logging behavior.
- Release readiness checklist completion.

## Acceptance Gates
- Dark mode is default and persisted.
- Web and desktop pass lint/typecheck/build checks with the new UI system.
- Messaging + moderation flows are deterministic offline and during sync.
- Moderation actions are auditable and permission-enforced.
- No secrets or keys present in tracked files.
