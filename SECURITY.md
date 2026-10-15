# Security Policy

## Supported versions

`main` is the only supported branch and the only branch that deploys.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report privately
via GitHub's [Security Advisories](../../security/advisories/new) for this
repository, or email the maintainer. Include a description, impact, steps to
reproduce and any suggested fix. You can expect an acknowledgement within a few
days.

## How secrets are handled

No credentials live in the repository. Everything is read from environment
variables, set in the Render (backend) and Vercel (frontend) dashboards, or in a
local `.env` file (git-ignored; `.env.example` is the template).

| Secret | Where it is used |
|---|---|
| `SECRET_KEY` | Signs auth tokens |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth token exchange |
| `GITHUB_WEBHOOK_SECRET` | Verifies webhook signatures (`X-Hub-Signature-256`); fail-closed when unset |
| `OPENAI_API_KEY` | Optional AI PR review |
| `DATABASE_URL` | Postgres connection string |

If you believe a secret was committed, rotate it immediately and report it
privately.

## Known, documented gaps

See the "Known gaps" section of the root [`README.md`](README.md) for the
current, maintainer-disclosed security posture (for example the OAuth `state`
handling and the GitHub OAuth scope).
