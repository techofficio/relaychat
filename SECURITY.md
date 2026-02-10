# RelayChat Security Baseline

This document defines the minimum security baseline for enterprise-ready RelayChat deployments.

## Reporting a vulnerability

- For sensitive vulnerabilities, use private GitHub security advisories for this repository.
- If advisories are not enabled yet, do not open a public issue with exploit details.
- Use the security issue template only for non-sensitive discussion.

## Privacy Objectives

1. Hide end-user network addresses from other end users by default.
2. Avoid storing raw client IPs unless explicitly required for legal/compliance reasons.
3. Enforce least privilege for Relay Agents and moderation actions.
4. Keep identity recovery encrypted at rest and in transit.

## Transport and IP Privacy

- Default network exposure mode is `RelayOnly`.
- Direct peer transport is disabled by default.
- Relay services should not persist raw client IP metadata (`retain_raw_ip = false`).
- Telemetry emitted by clients must strip fields containing `ip` or `address`.
- Media signaling enforces relay-only ICE policies unless explicitly switched to hybrid mode.
- Non-relay ICE candidates (`host`, `srflx`, `prflx`) are rejected in relay-only mode.

## Enterprise Controls

- Enforce strict origin allowlists for control-plane APIs.
- Apply security headers on relay responses (`nosniff`, `DENY`, strict referrer policy).
- Require scoped agent capabilities with configurable rate limits and expiry.
- Keep public agent directory limited to approved agents only.

## Identity and Recovery

- Device keys are generated per device and used for signed records.
- Recovery kits are encrypted before relay upload.
- Relay stores encrypted recovery material only.

## Logging Policy

- No plaintext secrets in logs.
- No raw client IP logging in application logs by default.
- Security events should log server/channel/entity IDs, reason, and timestamp.

## Rollout Requirement

Before enterprise onboarding, verify:

1. Relay-only path is active in server policies and SDK config.
2. Direct peer flags are disabled by policy.
3. Security headers and CORS allowlist are active at runtime.
4. Agent abuse protections (rate limits + capability checks) are enforced.
5. Media candidate filtering is active and rejects direct candidates under relay-only policy.
