# Vorza — backend

FastAPI service that powers Vorza: GitHub OAuth, repo connection, static
analysis, health scoring, comments and AI PR reviews.

> API shapes and WebSocket events are defined in [`../CONTRACTS.md`](../CONTRACTS.md).
> This file is the backend setup and layout guide.

## Requirements

- Python 3.13 (CI runs 3.13; 3.11+ should work)
- A PostgreSQL database (or SQLite for a local zero-dependency run)

## Local development

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -e . --group dev   # --group, not .[dev]
copy .env.example .env                          # fill in the GitHub OAuth keys
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

On macOS/Linux replace the venv paths with `.venv/bin/...`.

- Interactive docs: `http://localhost:8000/docs`
- OpenAPI schema: `http://localhost:8000/openapi.json`
- Liveness probe: `GET /health` (public, no database access)

### Environment

Configuration is read from `.env`. See [`.env.example`](.env.example) for the
full list. The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URL, or `sqlite:///./vorza.db` for a local run |
| `SECRET_KEY` | 256-bit random value used to sign tokens |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials |
| `GITHUB_WEBHOOK_SECRET` | Verifies `X-Hub-Signature-256`; unset means the webhook returns 503 |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | Optional AI PR review (any OpenAI-compatible provider; Groq works) |
| `CORS_ORIGINS` / `FRONTEND_HOST` | Browser origins allowed to call the API |
| `REDIS_URL` | Optional; falls back to in-process pub/sub |

## Layout

```
app/api/       routes: auth, repos, comments, analysis, webhooks, health
app/services/  orchestrator (owns all I/O), analysis, ai_review, github, pipeline
app/models/    SQLModel models: User, Repo, AnalysisSnapshot, Comment, AiReviewRow
app/ws/        gateway, manager, pubsub, comment_store, throttler
app/core/      config, security, schema bootstrap
app/alembic/   migrations (authoritative schema)
tests/         pytest suite (unit + route + migration tests)
```

Two rules that matter before you change anything (mirrored from `AGENTS.md`):

1. **`app/services/orchestrator.py` owns all I/O.** It is the only module
   allowed to touch the database, git checkouts and persistence. Everything
   else stays pure so the analysis and review logic stays unit-testable.
2. **Migrations are authoritative.** `app/core/schema.py` defers to Alembic
   whenever a revision is stamped. `tests/test_migrations.py` builds the schema
   both ways and diffs them, so drift fails CI.

## Checks

```bash
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m ruff format --check .
.\.venv\Scripts\python -m mypy app
.\.venv\Scripts\python -m pytest tests --cov=app --cov-fail-under=60
```

The coverage gate is 60%; the current measured total is reported by the CI
`backend` job (see the CI badge in the root `README.md`).

## Running with Docker

The repo root has a `docker-compose.yml` that starts Postgres, Redis, the
backend and the frontend together. See the root `README.md`.
