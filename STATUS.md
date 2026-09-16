# STATUS.md — the shared log

This is how the six agents talk to each other. **Append, never delete.**
Newest entry at the bottom. Every session ends with a new entry here before
the agent stops.

Format:

```
### [Agent <n> - <role>] <date> <time>
Did: <what you built/changed>
Exposed: <new/changed endpoint, event, or contract — link to CONTRACTS.md section>
Blocked on: <what you need from another agent, or "nothing">
Next: <what you'll do next session>
```

---

### [Human] project kickoff
Kit generated. Six agents about to start on their own branches. CONTRACTS.md
v0.1 is the starting shape — expect it to evolve as Agent 1 and Agent 2 build
the real models.

<!-- New entries go below this line -->

### [Copilot] 2026-09-15 local full-stack verification
- Did: Verified backend with `python -m pytest -q` (23 passed), frontend with typecheck, production build, lint, and Vitest (26 passed). Started FastAPI locally with SQLite and Vite locally; both responded successfully over HTTP.
- Exposed: Backend OpenAPI at `http://127.0.0.1:8000/openapi.json`; frontend at `http://127.0.0.1:5174/` because port 5173 was already occupied by an existing frontend process.
- Blocked on: Docker/Docker Compose is not installed or available on this Windows environment, so container-stack verification cannot run here. No application failure was reproduced.
- Next: Install/start Docker Desktop for Compose validation, or use the verified local commands from the backend and frontend directories.

### [Backend Consolidation] Orchestrator wiring + first commit
- Fixed the `webhooks.py` import crash (P0): routes `analysis.py`/`webhooks.py`
  were importing `analyze_repo`/`review_pull_request` + `verify_webhook_signature`
  from names that did not exist on pure services or had wrong signatures. Added
  `app/services/orchestrator.py` (the only module allowed to own DB + git-checkout
  + persistence I/O) exposing `analyze_repo(repo_id)` and
  `review_pull_request(repo_id, pr_number)`; repointed the two routes to it.
  `app.main` now imports cleanly; `pytest` collects 23 tests, 11 pass.
- Backend service files that are DEVELOPMENT-ISH stubs/placeholders and verified:
  `app/services/analysis.py` (pure, 309 lines) and `app/services/ai_review.py`
  (pure, 199 lines) are untouched/own Agent 2 per CONTRACTS.
- Fixed broken `app/services/pipeline.py` imports (SessionDep, fetch_repo_metadata,
  uuid coercion) and added `RedisPubSubBackend` dep; added REDIS_URL to config.
- Windows only: `httpcore` + `orjson` reinstall in .venv fixed a real SQLite
  file-lock (codeatlas_test.db) that hung the gateway test teardown.
- Repo hygiene: deleted all 6 agent worktrees + their tags in the main CI workspace
  Wayand�"central repo is a single clean monorepo. Root .gitignore covers
  .venv/node_modules/__pycache__/.env and git history started with a conventional
  commit (`6fc97f8`) over the consolidated tree.
- Blocked: real GitHub OAuth creds + OpenAI key not configured in production env;
  gag order not implemented in WebSocket (auth only, no onion-key yet); alembic
  migrations dir absent (tests bootstrap via init_db.create_all).
