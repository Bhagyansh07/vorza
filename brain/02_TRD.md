# 02 — Technical Requirements Document (TRD)

Status: 🟡 DRAFT

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | [ ] | [ ] |
| Backend | [ ] | [ ] |
| Database | [ ] | [ ] |
| Auth | [ ] | [ ] |
| Hosting/Infra | [ ] | [ ] |
| CI/CD | [ ] | [ ] |
| Analytics/Monitoring | [ ] | [ ] |

## Non-Functional Requirements

- **Performance:** [e.g. p95 API response < 300ms; app cold start < 2s]
- **Scalability:** [expected concurrent users / requests per second at launch and at 10x]
- **Availability:** [e.g. 99.5% uptime target]
- **Offline support:** [required? which features work offline?]
- **Accessibility:** [WCAG level target, screen reader support, etc.]
- **Internationalization:** [languages supported, RTL support if needed]
- **Browser/OS support:** [minimum versions]

## Third-Party Dependencies

| Dependency | Purpose | License | Cost | Alternative if it fails |
|---|---|---|---|---|
| [ ] | [ ] | [ ] | [ ] | [ ] |

## Environments

- **Local/dev:** [ ]
- **Staging:** [ ]
- **Production:** [ ]

Each environment should have its own config (see `20_ENV_SETUP.md`) — never
point staging code at production data.

## Versioning & Release Strategy

- Semantic versioning? [yes/no, format]
- Release cadence: [ ]
- Rollback strategy: [ ]

## Technical Constraints

- [e.g. "Must run on free-tier hosting initially"]
- [e.g. "Must work on low-end Android devices (2GB RAM)"]
- [e.g. "No server-side rendering required"]
