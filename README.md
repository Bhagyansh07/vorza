# Vorza

**A force-directed map of your codebase — sized by complexity, coloured by health —
where teammates see each other's cursors and an AI agent reviews every new pull
request before it merges.**

Connect a GitHub repo, and Vorza clones it, scores every file for cyclomatic
complexity and commit churn, and renders the result as a live graph. Health scores
land on the map as colour, so the files that need attention are the ones that look
wrong. Comment pins are anchored to coordinates on the canvas, so a review comment
points at the thing it is about. Open a PR and it gets an AI review with a risk
score and per-file flags.

---

## Table of contents

- [What works today](#what-works-today)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Testing](#testing)
- [Deploying](#deploying)
- [Documentation](#documentation)
- [Known gaps](#known-gaps)
- [How this was built](#how-this-was-built)

---

## What works today

Stated precisely, because a README that oversells is worse than none.

**Working:**

- GitHub OAuth sign-in, JWT sessions
- Connect a repository, analyse it, render the force-directed graph
- Per-file complexity, churn and health scoring; snapshot history with trend charts
- Live cursors, comment pins and AI reviews over WebSockets
- GitHub PR webhook → AI review, with HMAC signature verification
- Public landing page, sitemap, and per-route meta

**Not working, or not verified:**

| Gap | Detail |
|---|---|
| **Not deployed on current code** | The backend is live but on an older build. The frontend deployment no longer exists — both previously recorded hostnames return 404. |
| **No production database** | The migration history was the blocker; it is fixed. Applying the deploy needs account access. |
| **Accessibility unverified** | No axe run, no Playwright. Source review only. |
| **Scoring under-tested** | `services/analysis.py` is at 17% coverage, and it computes the three numbers the product displays. |
| **Docker Compose unverified** | No Docker on the machine it was built on. The Dockerfiles are built by CI on every push. |
| **No E2E tests** | No Playwright. The frontend suite is unit-level. |

Full honesty table, with reasons: [`docs/audit/06-summary.md`](docs/audit/06-summary.md).

---

## Tech stack

| Layer | Choice | Note |
|---|---|---|
| Backend | FastAPI + SQLModel + PostgreSQL | Async, typed, auto OpenAPI |
| Migrations | Alembic | Schema is authoritative; `create_all` is not |
| AI | OpenAI (`gpt-4o-mini` default) | Optional — review is skipped with a logged warning if no key |
| Frontend | React 18 + TypeScript + Vite | Strict mode, `tsc` clean |
| UI | Tailwind + shadcn/ui (Radix) + `cva` | Token-based, dark only — see [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) |
| Graph | `d3-force` + `d3-zoom` + `d3-selection` | Radius is LOC-weighted, colour is health |
| Charts | Recharts | One component, one route. It is the largest chunk in the build — see Known gaps |
| Real-time | FastAPI WebSockets, Redis pub/sub optional | Falls back to in-process |
| Auth | JWT via GitHub OAuth | In-house, deliberately — a provider swap is a login-surface rewrite for no current gain |
| Deploy | Render (Docker) + Vercel | Both config-as-code, both free tier |

---

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -e . --group dev   # --group, not .[dev]
copy .env.example .env
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

Interactive API docs at `http://localhost:8000/docs`. There is **no `/health`
endpoint** — use `/openapi.json`.

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local     # VITE_API_URL=http://localhost:8000
npm run dev
```

### Checks

```bash
# backend
cd backend && .\.venv\Scripts\python -m ruff check .
cd backend && .\.venv\Scripts\python -m ruff format --check .
cd backend && .\.venv\Scripts\python -m mypy app
cd backend && .\.venv\Scripts\python -m pytest tests --cov=app --cov-fail-under=60

# frontend
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm test -- --run
cd frontend && npm run build
```

> **Run all four frontend steps, not one.** Vitest does not typecheck — `tsc`
> does. A single passing test file tells you nothing about types, and getting that
> wrong put a type error on `master` during this build.

### Docker

```bash
docker compose up        # NOT VERIFIED — no Docker on the build machine
```

The individual Dockerfiles *are* built by CI on every push, so the images are
covered. The compose orchestration is not.

---

## Architecture

```
React SPA (Vercel)                    FastAPI (Render)
  landing / ─── public, indexable        │
  login   / ─── OAuth callback           ├── routes/    auth, repos, comments,
  dashboard, repos/:id ── noindex        │               analysis, webhooks
        │                                ├── services/  orchestrator (owns all I/O)
        │  REST + JWT                     │              analysis, ai_review, github
        ├──────────────────────────────► │              pipeline
        │                                ├── models/    User, Repo, AnalysisSnapshot,
        │  WebSocket (cursors, comments,  │              Comment, AiReviewRow
        └──────────────────────────────►  ├── ws/        gateway, manager, pubsub
                                         │              comment_store, throttler
                                         └── Alembic     schema is authoritative
                                                  │
                                             PostgreSQL (Neon)
```

Two structural rules worth knowing before you change anything:

**1. `services/orchestrator.py` owns all I/O.** It is the only module allowed to
touch the database, git checkouts and persistence. Everything else is pure. This
is why the analysis and review logic is unit-testable at all.

**2. Migrations are authoritative.** `app/core/schema.py` hands control to Alembic
when a revision is stamped, and only falls back to `create_all` for a database
with no migrations at all. `backend/tests/test_migrations.py` builds the schema
both ways and diffs it, so a migration that drifts from the models fails CI. It
caught two real defects — a table created as `analysesnapshot` where SQLModel
derives `analysissnapshot`, and a model that was never migrated at all.

API shapes: [`CONTRACTS.md`](CONTRACTS.md) (v0.2).

---

## Testing

Measured at commit `2ee4816`:

| | |
|---|---|
| Backend | **101 passing**, coverage **69.51%** (gate 60%) |
| Frontend | **69 passing** across 9 files |
| `mypy` (strict) | **0 errors**, 39 files |
| `ruff check` / `format --check` | **clean** |
| `tsc` | **0 errors** |
| `eslint` | **0 errors**, 4 pre-existing warnings |
| CI | **3 jobs green** — backend, frontend, docker-build |

Strategy, coverage gaps and what to add next:
[`docs/audit/04-test-strategy.md`](docs/audit/04-test-strategy.md).

**The next tests that should be written** are for `services/analysis.py`. It
computes the three numbers the whole product exists to display, it is pure, and it
is at 17% coverage. An untested function that produces the product's core output
is the largest remaining risk here.

---

## Deploying

Both targets are configuration-as-code, because the previous deploy was configured
by hand in a dashboard — which is exactly why a data-loss bug was documented in
handover notes and invisible to anyone reading the repo.

| File | Target |
|---|---|
| `render.yaml` | Render — Docker backend, `alembic upgrade head` as a pre-deploy command |
| `vercel.json` | Vercel — SPA rewrite (without it every deep link 404s) + cache and security headers |
| `.github/workflows/CI.yml` | lint, format, types, tests, coverage, Docker build |

Full click-by-click: **[`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md)**. It covers
Neon, Render, Vercel, the GitHub OAuth app, the webhook, Search Console and a
domain — plus what is *not* verified and why.

**On the database:** `render.yaml` deliberately declares no managed Postgres.
Render's free Postgres **expires 30 days after creation** — verified against
their docs, not assumed — which is a data-loss clock that looks durable right up
until it is not. Neon Free has no expiry and suspends compute rather than deleting
data. Click-by-click for both in the manual steps.

---

## Documentation

| Document | What it is |
|---|---|
| [`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md) | Every step that needs a browser or an account |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tokens, ramps, rules, from the code that exists |
| [`docs/SEO_BACKLINKS.md`](docs/SEO_BACKLINKS.md) | What was wrong, what was fixed, and how to verify |
| [`docs/audit/00-recon.md`](docs/audit/00-recon.md) → [`06-summary.md`](docs/audit/06-summary.md) | The audit, phase by phase |
| [`docs/audit/03-feature-roadmap.md`](docs/audit/03-feature-roadmap.md) | What to build next, and what deliberately not to |
| [`docs/RESUME_BULLETS.md`](docs/RESUME_BULLETS.md) | Project write-up, with the honest limits |
| [`CONTRACTS.md`](CONTRACTS.md) | API shapes, WebSocket events, model fields |
| [`STATUS.md`](STATUS.md) | The running log |
| [`HANDOVER.md`](HANDOVER.md) | Session-start notes — **the live URLs in it are stale** |
| `brain/` | The original project constitution and specs |
| `tasks/` | The six agent briefs this repo was built from |

---

## Known gaps

Open, ordered by how much they matter.

| Gap | Why it matters | Where |
|---|---|---|
| `services/analysis.py` at 17% coverage | It produces the product's core output. A wrong score means every user sees a wrong colour. | `04-test-strategy.md` T1 |
| No E2E or accessibility tests | Every route's behaviour is verified by reading code, not driving it. The graph is likely keyboard-hostile. | T4, T5 |
| `charts-*.js` is 356.24 kB raw / 103.75 kB gzip | Larger than the entire app bundle (292.35 / 94.19), used by one component on one route. | roadmap F5 |
| Missing empty states on 3 routes | A new user's second screen shows nothing. | roadmap F2 |
| No graph legend | Node colour means nothing without one. | roadmap F3 |
| `npm audit`: 10 advisories (6 high, 4 moderate) | Unaddressed. | `01-code-audit.md` |
| No repo deletion | Connected repos can never be removed. | roadmap F7 |
| 9 low-severity code findings open | Naming and docstrings. Deliberately deferred over churn. | `01-code-audit.md` |

---

## How this was built

Originally briefed as a six-agent parallel build (the briefs are still in
`tasks/`), then taken through a full audit pass across seven phases.

The audit found things that reading the code would not have:

- **Two migration bugs that would have broken the first production deploy** —
  a table created as `analysesnapshot` where SQLModel derives `analysissnapshot`,
  and a model never migrated at all. Both were masked by an unconditional
  `create_all` in the app lifespan.
- **Production serving mock data behind a plausible-looking UI.** The graph layer
  tested `VITE_USE_MOCK !== "false"` — true when unset — on a variable name
  nothing in the repo set, while CI stayed green the whole time.
- **A hardcoded webhook secret** in the source, meaning anyone who read the repo
  could forge a signed webhook and queue PR reviews.
- **A gateway impersonation hole** — a client could broadcast a comment as
  another user.
- **A colour key named `panel` that silently made `shadow-panel` emit no shadow
  at all.** No error, no warning. Every floating overlay in the graph rendered
  without one and looked intentional.

Two claims written from memory turned out to be wrong and were corrected against
primary sources: the free-tier database does **not** survive on a weekly ping
(it expires on a clock from *creation*), and the frontend "deployment" turned out
not to exist at all. Both are documented where they were wrong rather than quietly
edited away.

Full findings, including what got wrong along the way:
[`docs/audit/06-summary.md`](docs/audit/06-summary.md).

---

## License

**No license file yet.** This repo is currently private and unlicensed — there is
no `LICENSE` file in the tree, so "MIT licensed" would be a claim about
something that does not exist.

If you want to reuse any of this, add a `LICENSE` first. The audit and design
docs are written to be readable on their own, and reuse is welcome.