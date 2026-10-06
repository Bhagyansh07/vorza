# Vorza

**The living, AI-reviewed map of your codebase.**

Connect a GitHub repository and Vorza turns it into a live force-directed map:
every file is a node sized by complexity and coloured by health, so the files
that need attention are the ones that look wrong. Teammates see each other's
cursors on the same canvas, comments pin to exact spots on the graph, and every
new pull request gets an AI review with a risk score before it merges.

> **Live:** [app](https://frontend-bhagyansh.vercel.app) · [API](https://codeatlas-qr0e.onrender.com) · [OpenAPI](https://codeatlas-qr0e.onrender.com/openapi.json) · [source](https://github.com/Bhagyansh07/codeatlas)

![Vorza map](/product-map.png)

## What it does

| Capability | How it works |
|---|---|
| **GitHub login + repo connect** | OAuth sign-in, then pick any of your repos (public or private) or type an `owner/repo` manually |
| **Codebase map** | A shallow clone is scored per file: lines of code, cyclomatic-complexity proxy, git churn, and import/dependency edges (JS/TS + Python) |
| **Health scoring** | Each file gets a 0–100 health score: `>= 70` good (green), `>= 45` warn (amber), below bad (red). Node **colour** is health, node **size** is complexity |
| **Health history** | Every analysis is a snapshot; the trend chart shows how a repo's health moves over time |
| **Live collaboration** | Cursors and comment pins broadcast over WebSockets — a comment pins to a point on the canvas, not a line number that shifts |
| **AI PR reviews** | A GitHub webhook feeds each opened PR's diff to an LLM, which returns a risk score, a plain-English summary and per-file flags (needs `OPENAI_API_KEY`) |

The map answers questions like *which files do I refactor first*, *where does
the risk live*, and *what breaks when I touch this*.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | FastAPI · SQLModel · PostgreSQL (Neon) · Alembic |
| Analysis | Pure-Python pipeline over a git checkout (complexity, churn, imports) |
| AI | OpenAI (`gpt-4o-mini`, optional) — skipped with a logged reason if no key |
| Frontend | React 18 · TypeScript · Vite · TanStack Query · Tailwind + shadcn/ui |
| Graph | `d3-force` + `d3-zoom` |
| Real-time | FastAPI WebSockets (Redis pub/sub optional) |
| Deploy | Render (Docker) + Vercel, config-as-code |

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -e . --group dev   # --group, not .[dev]
copy .env.example .env                        # fill in GitHub OAuth keys
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

Interactive API docs at `http://localhost:8000/docs`. There is **no `/health`
endpoint** — use `/openapi.json`.

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local     # VITE_API_URL=http://localhost:8000, VITE_USE_MOCKS=true for mock data
npm run dev
```

### Checks

```bash
# backend
cd backend && .\.venv\Scripts\python -m ruff check .
cd backend && .\.venv\Scripts\python -m ruff format --check .
cd backend && .\.venv\Scripts\python -m mypy app
cd backend && .\.venv\Scripts\python -m pytest tests --cov=app --cov-fail-under=60

# frontend — run all four, not one (Vitest does not typecheck)
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm test -- --run
cd frontend && npm run build
```

## Architecture

```
React SPA (Vercel)                      FastAPI (Render)
  landing  /  public, indexable           │
  login    /  OAuth callback              ├── routes/    auth, repos, comments,
  dashboard, repos/:id  noindex           │               analysis, webhooks
        │                                 ├── services/  orchestrator (owns all I/O)
        │   REST + JWT                     │              analysis, ai_review, github,
        ├──────────────────────────────►  │              pipeline
        │                                 ├── models/    User, Repo, AnalysisSnapshot,
        │   WebSocket (cursors, comments,  │              Comment, AiReviewRow
        └──────────────────────────────►  ├── ws/        gateway, manager, pubsub
                                          │              comment_store, throttler
                                          └── Alembic    schema is authoritative
                                                   │
                                              PostgreSQL (Neon)
```

Two structural rules worth knowing before you change anything:

1. **`services/orchestrator.py` owns all I/O.** It is the only module allowed to
   touch the database, git checkouts and persistence. Everything else is pure,
   which is why the analysis and review logic is unit-testable.
2. **Migrations are authoritative.** `app/core/schema.py` defers to Alembic
   whenever a revision is stamped and only falls back to `create_all` for a
   database with no migrations at all. `backend/tests/test_migrations.py` builds
   the schema both ways and diffs them, so a migration that drifts from the
   models fails CI — it has already caught a wrong table name and a model that
   was never migrated.

API shapes and WebSocket events: [`CONTRACTS.md`](CONTRACTS.md).

## Testing

Current state:

| | |
|---|---|
| Backend | **155 passing**, coverage **81%** (gate 60%) |
| Frontend | **110 passing** across 14 files |
| `mypy` (strict) | clean |
| `ruff` / `eslint` | clean |
| `tsc` | clean |
| CI | green — backend + frontend + Docker build |

Strategy, coverage gaps and what to add next:
[`docs/audit/04-test-strategy.md`](docs/audit/04-test-strategy.md).

## Deploying

Both targets are configuration-as-code.

| File | Target |
|---|---|
| `render.yaml` | Render — Docker backend with `git` installed, migrations on boot |
| `vercel.json` | Vercel — SPA rewrites + cache and security headers |
| `.github/workflows/CI.yml` | lint, format, types, tests, coverage, Docker build |

`master` auto-deploys to both. Click-by-click setup (Neon, Render, Vercel, the
GitHub OAuth app, the webhook): [`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md).

## Documentation

| Document | What it is |
|---|---|
| [`CONTRACTS.md`](CONTRACTS.md) | API shapes, WebSocket events, model fields |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System diagram and design notes |
| [`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md) | Every step that needs a browser or an account |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tokens, ramps, design rules from the code that exists |
| [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) | Branch model, commit conventions, deploys |
| [`docs/audit/`](docs/audit/06-summary.md) | The audit trail, including what went wrong along the way |
| [`docs/audit/03-feature-roadmap.md`](docs/audit/03-feature-roadmap.md) | What to build next, and what deliberately not to |
| [`HANDOVER.md`](HANDOVER.md) | Operating notes: live environment and free-tier constraints |

## Known gaps

Honest, ordered by how much they matter.

| Gap | Why it matters |
|---|---|
| AI review needs `OPENAI_API_KEY` | Without it the webhook still verifies PR events, but the review is skipped and logged — nothing is reviewed |
| No E2E or accessibility tests | Route behaviour is verified by reading code and unit tests, not by driving a browser |
| OAuth `state` is not single-use | Impact is limited because GitHub's `code` is single-use, but the guard is weaker than the docstring once claimed |
| No bundle-size gate in CI | Source-level guards exist, but nothing measures actual bytes |
| Docker Compose orchestration unverified | The Docker images are built by CI on every push; the compose stack never ran on this machine |

## License

[MIT](LICENSE) © 2026 Bhagyansh. Built as a portfolio project — the audit and
design docs are written to be read.