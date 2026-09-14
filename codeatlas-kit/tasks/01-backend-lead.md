# Agent 1 — Backend Lead

## Mission

Stand up the FastAPI backend: database models, auth, GitHub OAuth, REST API,
and the webhook receiver. You are the foundation everyone else builds on —
ship the core shapes in `CONTRACTS.md` for real, early, so agents 2–6 aren't
blocked.

## Build this

1. Scaffold `backend/` using `fastapi/full-stack-fastapi-template` as your
   starting skeleton (see `docs/REFERENCE_REPOS.md`) — keep its auth/JWT
   pattern, its DB session pattern, its Docker Compose service definition.
2. Replace its example `Item` model with the real models from `CONTRACTS.md`:
   `User`, `Repo`, `AnalysisSnapshot`, `FileNode` (as a JSON column or child
   table), `Comment`.
3. GitHub OAuth: login flow that gets a token scoped to read the user's
   repos.
4. REST endpoints exactly as listed in `CONTRACTS.md`'s API surface table.
   `POST /repos/{id}/analyze` and the webhook receiver can be stubs that just
   enqueue/log for now — Agent 2 fills in the real logic.
5. Webhook receiver at `POST /webhooks/github`: verify the GitHub signature,
   parse the PR payload, call into Agent 2's analysis entrypoint (define the
   function signature even if Agent 2 hasn't implemented the body yet —
   coordinate via `STATUS.md`).
6. OpenAPI docs working at `/docs` (comes free with FastAPI if you don't
   break it).

## Do

- Keep every model and endpoint honest to `CONTRACTS.md`.
- Write a migration (Alembic, from the template) for every model change.
- Add basic Pytest tests for auth and the CRUD endpoints as you go.
- Seed a `.env.example` with every variable your code reads.

## Don't

- Don't build the actual analysis or LLM logic — that's Agent 2's. Stub it.
- Don't build the WebSocket gateway — that's Agent 5's. Leave `backend/app/ws/`
  for them.
- Don't touch `frontend/` at all.
- Don't invent a custom auth scheme — use the template's JWT pattern.

## Definition of done

- [ ] `docker-compose up` brings up Postgres + backend cleanly.
- [ ] `/docs` shows every endpoint from `CONTRACTS.md`.
- [ ] GitHub OAuth login works end to end against a real GitHub OAuth app.
- [ ] Pytest suite passes.
- [ ] `CONTRACTS.md` matches what you actually built (fix any drift).
- [ ] `STATUS.md` has an entry describing what's ready for Agents 2, 3, 5.

## First 3 steps

1. Clone/adapt the FastAPI template into `backend/`, get it running locally.
2. Swap in the CodeAtlas models + Alembic migration.
3. Implement `/auth/github/callback`, `/me`, `/repos` (POST + GET), then log
   progress in `STATUS.md` before moving to the webhook receiver.
