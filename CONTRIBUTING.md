# Contributing to Vorza

Thanks for looking at Vorza. This is a solo-maintained portfolio project, but
issues and pull requests are welcome.

## Getting started

See the root [`README.md`](README.md) for the full setup (backend + frontend),
and [`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md) for the steps that need a
browser or an account (Neon, Render, Vercel, the GitHub OAuth app, the webhook).

In short:

```bash
# backend
cd backend && python -m venv .venv && .\.venv\Scripts\pip install -e . --group dev
# frontend
cd frontend && npm ci
```

## Before you open a pull request

Run the checks and make sure they pass:

```bash
# backend
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m ruff format --check .
.\.venv\Scripts\python -m mypy app
.\.venv\Scripts\python -m pytest tests --cov=app --cov-fail-under=60

# frontend — run all four (Vitest does not typecheck)
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

Rules that matter (also in [`AGENTS.md`](AGENTS.md)):

1. **Small commits, one area each.** Message format `<area>: <summary>`.
2. **`CONTRACTS.md` is law.** If you touch an API shape or a WebSocket event,
   update it in the same commit.
3. **Migrations are authoritative.** Every model change needs a matching Alembic
   migration; `tests/test_migrations.py` fails CI on drift.
4. **The orchestrator owns all I/O.** Keep services pure so they stay testable.

Open the PR against `main`. Do not merge with red CI.

## Reporting bugs / requesting features

Open an issue with steps to reproduce, expected vs actual behaviour, and your
OS / Python / Node versions.

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
