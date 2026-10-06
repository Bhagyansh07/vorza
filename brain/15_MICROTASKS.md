# 15 — Microtasks

Status: 🟢 LIVE — this file is updated constantly during development. Every
task the AI works on should exist here first (see `00_MASTER_RULES.md` rule 4).

## How to use this file

- Break every feature from `01_PRD.md` into tasks small enough to finish and
  test in one sitting (roughly 15 minutes to 2 hours of focused work).
- Status values: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.
- When a task is `DONE`, it must satisfy the "definition of done" in
  `00_MASTER_RULES.md` section 4.
- Move genuinely finished tasks older than the current milestone into an
  "Archive" section at the bottom so this file stays scannable.

## Task Template

```
### [T-001] Short task title
- Status: TODO
- Related spec: 01_PRD.md #core-features
- Description: [what exactly needs to be built]
- Acceptance criteria:
  - [ ] [criterion 1]
  - [ ] [criterion 2]
- Files likely touched: [ ]
- Notes: [ ]
```

## Active Tasks

### [T-700] Light enterprise theme + real brand (2026-10-06)
- Status: DONE
- Related spec: 01_PRD.md #core-features
- Description: Re-skin the whole frontend from dark-only/cyan to a light-only
  enterprise theme: cool neutral ramp, single blue accent, Primer-style status
  colours, Geist Sans + Geist Mono (self-hosted via fontsource), V-mark logo
  (favicon.svg + LogoMark + regenerated raster assets from
  scripts/make_brand_assets.py), unified 70/45 health thresholds in
  src/lib/health-thresholds.ts. Landing page rewritten (real-product figure,
  two-column feature grid, scope disclosure), login/nav/footer de-slopped.
- Acceptance criteria:
  - [x] No `dark:` utilities; color-scheme light; toaster pinned light
  - [x] Gates green: tsc, eslint 0 errors, 110 vitest tests
  - [x] Brand assets pixel-checked (scripts/check_brand_assets.py)
- Files likely touched: frontend/src/index.css, tailwind.config.ts, Landing,
  Navbar, Login, AppShell, graph components, Logo.tsx, scripts/*
- Notes: Graph crashed on mount via d3 `selection.each` over React-owned SVG —
  fixed by keying tick maps off data-node-id/data-link-id +
  ForceDirectedGraph.test.tsx regression test.

### [T-701] Durable data + webhook hardening (2026-10-06)
- Status: DONE
- Related spec: 03_ARCHITECTURE.md, 10_SECURITY.md
- Description: Point the backend at Neon Postgres (`DATABASE_URL`) so connected
  repos survive Render free-tier restarts (ephemeral SQLite was the P0 data-loss
  issue); set `GITHUB_WEBHOOK_SECRET` so the fail-closed webhook receiver can
  be enabled and authenticated.
- Acceptance criteria:
  - [x] Alembic 0002 applied on Neon; all tables verified via psycopg
  - [x] Both env vars present in Render; deploy live
  - [x] GitHub webhook registered on the app's repos with the shared secret
- Files likely touched: Render env (dashboard), Neon project
- Notes: OPENAI_API_KEY still cannot be provisioned (needs the user's OpenAI
  account) — AI review degrades gracefully.

## Blocked Tasks

_(move tasks here with a note on what's blocking them, and why)_

- OpenAI-powered PR review depth: `OPENAI_API_KEY` not provisioned — needs the
  user's OpenAI account.

## Archive (completed in earlier milestones)

_(move DONE tasks here periodically to keep the active list short)_
