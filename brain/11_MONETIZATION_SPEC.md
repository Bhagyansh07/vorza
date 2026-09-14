# 11 — Monetization Spec

Status: 🟡 DRAFT — delete/mark N/A if the project has no monetization, but log
that decision in `17_DECISIONS.md`.

## Model

- Type: [ads / freemium / subscription / one-time purchase / affiliate / none]

## Ads (if applicable, e.g. AdMob / AdSense / Meta Audience Network)

- Ad network: [ ]
- Ad units and placement:

| Placement | Ad type | Frequency cap | Notes |
|---|---|---|---|
| [e.g. Home screen bottom] | Banner | always visible | must not overlap content |
| [e.g. Between search results] | Native | every N items | |
| [e.g. After completing an action] | Interstitial | max 1 per [ ] minutes | never during a critical flow |

- Consent/compliance: [GDPR consent flow (e.g. Google's UMP SDK), age-gating for kids' apps, ATT prompt on iOS]
- Rule: ads must never block or delay a core user action (see `01_PRD.md` success metrics).

## Subscriptions / In-App Purchases (if applicable)

| Tier | Price | What's included |
|---|---|---|
| Free | $0 | [ ] |
| [Paid tier] | [ ] | [ ] |

- Billing provider: [Stripe / RevenueCat / native store billing]
- Trial period: [ ]
- Cancellation/refund policy: [ ]

## Guardrails

- [ ] Monetization never compromises core UX defined in `01_PRD.md` success metrics.
- [ ] All pricing/ad copy is truthful — no dark patterns (fake countdowns, hidden charges).
- [ ] Payment/ad SDK keys are managed per `20_ENV_SETUP.md` and `10_SECURITY.md` — never hardcoded.
