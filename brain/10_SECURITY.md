# 10 — Security Spec

Status: 🟡 DRAFT — this file has high authority; see `00_MASTER_RULES.md`.

## Authentication & Authorization

- Auth method: [email/password, OAuth providers, magic link, etc.]
- Session/token type: [JWT / server session] — expiry: [ ]
- Role/permission model: [ ] (e.g. admin/user, or none for MVP)
- Password rules (if applicable): [min length, hashing algorithm — bcrypt/argon2]

## Secrets Management

- All secrets live in environment variables, defined in `20_ENV_SETUP.md`.
- Never commit `.env` files — confirm `.gitignore` includes them.
- Secrets rotation policy: [ ]
- Where production secrets are stored: [hosting provider's secret manager / vault]

## Input Validation

- Validate and sanitize all user input server-side, even if also validated client-side.
- Rule: never build SQL/queries via string concatenation — use parameterized queries/ORM.
- File upload restrictions (if applicable): [allowed types, max size, virus scanning]

## Data Privacy

- What personal data is collected: [ ]
- Where it's stored and for how long: [ ]
- Applicable regulations: [GDPR / DPDP (India) / CCPA / none, depending on audience]
- User rights supported: [data export, account deletion]

## Dependency & Infrastructure Security

- [ ] Dependencies are checked for known vulnerabilities (e.g. `npm audit`, `pip-audit`, Dependabot).
- [ ] HTTPS enforced everywhere in production.
- [ ] CORS configured to allow only known origins.
- [ ] Rate limiting on public endpoints (see `07_API_CONTRACT.md`).
- [ ] Admin/internal routes are not publicly reachable without auth.

## Basic Threat Checklist

- [ ] SQL/NoSQL injection — mitigated via parameterized queries/ORM
- [ ] XSS — mitigated via output escaping / framework defaults
- [ ] CSRF — mitigated via tokens or SameSite cookies (if session-based)
- [ ] Broken access control — every endpoint checks the caller owns/can access the resource
- [ ] Sensitive data exposure — no secrets or PII in logs, URLs, or client-side code

## Incident Response

- If a security issue is found: [who to notify, how quickly, disclosure policy]
