# AGENTS.md — working rules for this repository

Read this before writing code in this repo. It applies to human contributors
and AI agents alike.

## What this project is

Vorza — a SaaS that turns a GitHub repo into a live, force-directed map scored
for complexity, churn and health, with collaborative cursors and AI PR reviews.
Stack in one line: React 18 + Vite + TypeScript frontend (Vercel), FastAPI +
SQLModel + PostgreSQL backend (Render), Alembic for schema, GitHub OAuth for
auth.

## Repository layout

```
backend/    FastAPI app (app/api routes, app/services, app/models, app/ws,
            app/core). Alembic migrations live in backend/app/alembic/versions.
frontend/   React SPA (src/features per domain, src/lib api client + types,
            src/components/ui shared primitives).
docs/       Architecture, design system, ops manual, audit trail.
CONTRACTS.md  Single source of truth for API shapes and WebSocket events.
```

## The rules that matter

1. **`CONTRACTS.md` is law.** If your change touches an API shape, a model that
   is exposed, or a WebSocket event, edit `CONTRACTS.md` in the same commit.
   The frontend types in `frontend/src/types/index.ts` mirror it.
2. **Small commits, one area each.** Message format `<area>: <summary>`, e.g.
   `backend: add repo model`. Never commit secrets, `.env` files,
   `node_modules/` or `__pycache__/`.
3. **Migrations are authoritative.** `backend/app/core/schema.py` defers to
   Alembic whenever a revision is stamped. Every model change needs a matching
   migration in the same commit — `backend/tests/test_migrations.py` diffs the
   migration output against the models and fails CI on drift.
4. **The orchestrator owns all I/O.** `backend/app/services/orchestrator.py`
   is the only module allowed to touch the database, git checkouts and
   persistence. The analysis and AI-review services stay pure so they are
   unit-testable.
5. **Working code over clever code.** Ship the smallest thing that satisfies
   the requirement. If a change needs a decision that is not yet made, stop and
   ask instead of guessing.

## Conventions

- **Python:** type hints everywhere; `ruff` for lint/format; `mypy` strict;
  tests with `pytest` (gate: 60% coverage).
- **TypeScript:** strict mode; `eslint` + `prettier`; tests with `vitest` —
  and note that Vitest does not typecheck, so run `tsc -b --noEmit` too.
- **Health thresholds:** `>= 70` good, `>= 45` warn, below bad. These are the
  single source of truth for node colour.
- **Design:** system-preference light + dark, token-based (see
  `docs/DESIGN_SYSTEM.md`). No `dark:` utilities, no em dashes in visible copy.

## Definition of done

- Code runs locally and the relevant checks pass (backend: `pytest`, `ruff`,
  `mypy`; frontend: `npm run typecheck`, `npm run lint`, `npm test`).
- Tests exist for new logic and pass.
- `CONTRACTS.md` is up to date if anything was exposed or changed.
- The change is a small, well-named commit (or a PR against `master`).

## Deploys

`master` auto-deploys to Render (backend) and Vercel (frontend). Keep `master`
deployable at every commit. See `docs/GIT_WORKFLOW.md` for the branch flow.