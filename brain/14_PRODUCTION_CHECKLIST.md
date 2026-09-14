# 14 — Production / Launch Checklist

Status: 🟡 DRAFT — go through this fully before the first real launch, and
again before any major release.

## Functionality

- [ ] All Core Features in `01_PRD.md` are implemented and tested
- [ ] All screens in `08_UI_SPEC.md` handle loading/empty/error/success states
- [ ] No `TODO` / `[NEEDS INPUT]` placeholders remain in shipped code or copy

## Performance

- [ ] Meets performance targets in `02_TRD.md`
- [ ] Images/assets optimized (compressed, correctly sized)
- [ ] No obvious memory leaks / unbounded growth in long sessions

## Security

- [ ] All items in `10_SECURITY.md` threat checklist reviewed
- [ ] No secrets in the repository (double-check with a secret scanner)
- [ ] HTTPS enforced, dependencies up to date with no critical vulnerabilities

## Data & Backups

- [ ] Database backup strategy in place and tested (a real restore, not just a backup job existing)
- [ ] Data migration scripts tested against a copy of production-shaped data

## Monitoring & Observability

- [ ] Error tracking wired up (see `09_ERROR_HANDLING.md`)
- [ ] Uptime monitoring on critical endpoints
- [ ] Alerting reaches a real person, tested end-to-end

## Legal & Compliance

- [ ] Privacy policy published and linked
- [ ] Terms of service published and linked (if applicable)
- [ ] Data source licensing checked (see `05_DATA_SOURCES.md`)
- [ ] Ad/payment SDK compliance requirements met (see `11_MONETIZATION_SPEC.md`)

## Store Listing (if a mobile app)

- [ ] App icon, screenshots, and description finalized
- [ ] Age rating / content rating completed accurately
- [ ] Required permissions justified in the listing

## Rollback Plan

- [ ] Previous stable version can be redeployed in under [ ] minutes
- [ ] Database migrations are reversible or have a documented rollback path

## Post-Launch

- [ ] Plan for monitoring the first 24-48 hours actively
- [ ] Feedback channel for users is set up (email, in-app form, etc.)
