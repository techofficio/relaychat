# Mission

Build RelayChat as an easy-to-use, full-featured, decentralized, cross-platform communication platform for communities that value ownership, resilience, and privacy.

## Product Requirements

1. **Easy to use**
- Familiar server, channel, DM, and thread flows.
- Fast onboarding with clear defaults.
- Consistent UX across web, desktop, and mobile.

2. **Full featured**
- Text chat with edits, reactions, replies, pins, and moderation.
- Voice/video architecture readiness with channel-level policy controls.
- Agent ecosystem with explicit purpose, scoped permissions, and hard moderation controls.

3. **Decentralized by design**
- Local-first data ownership on client devices.
- Hybrid networking: P2P preferred, relay/community nodes optional.
- Public-key identities and signed records for trust.

4. **Cross-platform by default**
- Shared domain model and shared UI primitives.
- Web and desktop parity first, mobile following the same core behavior.

## Engineering Constraints

- Default-deny security posture for agent capabilities.
- Offline-first behavior with deterministic sync semantics.
- Avoid central single points of failure for identity and message durability.

## MVP Acceptance Criteria

- User can create a server, create channels, send/edit/delete/react to messages offline.
- Data persists locally and reloads correctly.
- Agent requests can be submitted with purpose + capability scope.
- Moderators can operate manual approval and optional auto-approval.
- Approved agents are visible in a public agent directory.
- Web and desktop apps run the same core workspace experience.
