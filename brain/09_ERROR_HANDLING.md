# 09 — Error Handling Strategy

Status: 🟡 DRAFT

## Error Taxonomy

| Category | Example | User-facing message style | Logged? | Alerted? |
|---|---|---|---|---|
| Network error | request timeout | "Couldn't connect. Retry?" | yes | if repeated |
| Validation error | bad input | inline field message | no | no |
| Auth error | expired token | redirect to login | yes | no |
| Server error (5xx) | crash, DB down | generic "something went wrong" | yes | yes, immediately |
| Third-party/data source failure | source down (see `05_DATA_SOURCES.md`) | show cached/stale data + banner | yes | yes |

## Logging Standard

- Log format: [structured JSON / plain text]
- Log levels: `debug`, `info`, `warn`, `error`, `fatal` — define when each is used
- What must NEVER be logged: passwords, tokens, full card numbers, other secrets
- Where logs go: [console / file / hosted service — Sentry, Datadog, etc.]

## Retry & Backoff Policy

- Default retry count for transient failures: [ ]
- Backoff strategy: [exponential, e.g. 1s, 2s, 4s, 8s, max 5 tries]
- Circuit breaker: after [N] consecutive failures, stop retrying for [duration] and alert.

## User-Facing Error Messages

Rules:
- Never show raw stack traces or internal error codes to end users.
- Every error message should suggest a next action (retry, contact support, go back).
- Match tone/voice defined in `08_UI_SPEC.md`.

## Monitoring & Alerting

- Tool: [ ]
- Alert thresholds: [e.g. error rate > 2% over 5 min → page on-call / send email]
- Who gets alerted: [ ]
