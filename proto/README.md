# Protocol Draft

This folder tracks the evolving on-wire and storage formats for the app.

## Event log

- Each channel is an append-only event log.
- Events are immutable; edits are modeled as new events referencing prior IDs.
- Clients sync by exchanging heads and missing ranges.

## Event types (draft)

- `Message`
- `Edit`
- `Reaction`
- `Delete`
- `System`

## Identity

- Users are public-key identities.
- Devices sign events on behalf of the user.
- Community nodes may relay events but cannot read plaintext.
- Recovery kits are encrypted before relay upload.

## Transport Privacy

- Default server network exposure mode is `RelayOnly`.
- Direct peer paths are disabled by default to avoid end-user IP disclosure.
- Raw client IP retention is disabled by default for enterprise posture.
- Media sessions enforce relay-only ICE policy by default (non-relay candidates rejected).

## Agents

- Agents are public-key identities with an explicit purpose statement.
- Servers default to **manual approval**, but mods can configure **auto-approval**.
- Agent listings are **public** so members can see purpose + capabilities.
- Capabilities are scoped, rate-limited, and revocable via signed grants.
- Network envelopes include:
  - `AgentRegistration(server, signed registration)`
  - `AgentApproval(server, signed capability grant)`
  - `AgentPolicy(server, signed policy update)`
  - `Presence(server, channel?, user, state, lastActive)`
  - `Typing(server, channel, user, typing, updatedAt)`

## Sync

- Client sends `SyncRequest(channel, after, since)`.
- Peer replies with `SyncResponse(events, head)`.

## Media Signaling (Control Plane)

- `POST /v1/media/sessions` creates media session with transport policy.
- Media session responses include relay ICE server config for client RTC setup.
- `POST /v1/media/sessions/{sessionId}/candidates` accepts only policy-compliant ICE candidates.
- `POST /v1/servers/{serverId}/events/publish` verifies signed records before relay acceptance.
- `POST /v1/servers/{serverId}/presence` upserts per-user presence state.
- `GET /v1/servers/{serverId}/presence` returns current server presence index.
- `POST /v1/servers/{serverId}/typing` upserts typing state for a channel/user.
- `GET /v1/servers/{serverId}/typing/{channelId}` returns active typers for a channel.

This is a placeholder; wire format and versioning rules will be formalized as the core crates mature.
