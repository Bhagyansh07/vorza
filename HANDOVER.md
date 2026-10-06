# CodeAtlas / "Vorza" — HANDOVER (Complete Project Story)

> This file holds the whole project story in one place. Any session/agent that
> picks this project up later: read THIS first. 2 minutes.

## 1. MOTIVE — why we are building this
"Your codebase as a living, AI-reviewed map."
Common tools (file-level code maps, lambda notes) only show *files*, nobody
*understands the architecture of the whole codebase*. Our ask: a tool that
**connects a GitHub repo and gives an AI-generated visual map + health analysis
+ history over time**.

Final brand name: **"Vorza"** (repo folder still `CodeAtlas`, frontend title "Vorza").

Planned features:
- Connect GitHub repo via OAuth
- Repo architecture / visual map
- AI repo health analysis (a snapshot)
- History (snapshots over time)
- Comments / pins on code
- Dashboard = list of connected repos + their analysis

## 2. WHAT IS BUILT — architecture
Monorepo: `backend/` (FastAPI, Python) + `frontend/` (React + Vite + TS + React Query + Tailwind).

```
backend/app/
  main.py              # FastAPI app; lifespan create_all (tables always created)
  api/routes/auth.py   # GitHub OAuth: /auth/github/{login,callback}
  api/routes/repos.py  # connect / list / snapshots / history / comments
  core/config.py       # Settings; DATABASE_URL support (Postgres-ready) - SQLite fallback
  core/database.py     # SQLAlchemy engine

frontend/src/
  features/repos/          # Dashboard, ReposList, RepoCard, ConnectRepoDialog, use-repos hooks
  features/auth/           # store.ts (login single-attempt), login page
  lib/http-client.ts       # axios base (from VITE_API_URL)
  router.tsx               # routes: /login, /dashboard (repos), /repos/:id, history
  .env.production          # committed: VITE_API_URL=(Render URL), mocks OFF
vercel.json                # rootDirectory: frontend
```

## 3. STATUS — Deployed & LIVE
| Runtime | URL | Notes |
|---|---|---|
| Backend (Render, free) | `https://codeatlas-qr0e.onrender.com` | /docs 200, CORS green, OAuth OK, Postgres on Neon (Alembic `0002`) |
| Frontend (Vercel) | `https://frontend-bhagyansh.vercel.app` | Light enterprise theme, Geist, real brand mark; aliases `vorza-app`, `vorza-sigma` point here |

Verified (2026-10-06): GitHub OAuth login end-to-end; repo connect + analyze;
graph renders with the light palette; `POST /webhooks/github` enforces the
shared secret (fail-closed: 503 without a valid signature); repos survive
redeploys because the DB is Neon, not the ephemeral disk.

Known (not a bug): Render free tier cold-starts in ~50s — first request after
idle spins the instance up.

## 4. RESOLVED — data no longer wipes on redeploy

**The old issue (fixed 2026-10-06):** Render free tier wipes the ephemeral disk
on restart/move, and the backend's SQLite file lived there, so connected repos
vanished on every redeploy.

**Fix applied:** the backend now reads `DATABASE_URL` (Neon Postgres, pooled
URI). Alembic migrates on boot; verified in Neon that `repo`, `user`,
`analysissnapshot`, `aireviewrow`, `comment` and `alembic_version` all exist.
Connected repos and comments now survive redeploys.

If repos still vanish after a restart, the app is **not** running with the Neon
string — check Render -> Environment -> `DATABASE_URL`, and the service logs for
"Running migrations".

## 5. STARTING A NEW SESSION — where to begin
1. Backend cold? Render sleep -> first request takes 30-60s.
2. Open `https://frontend-bhagyansh.vercel.app` (hard refresh / incognito).
3. "Continue with GitHub" -> GitHub authorize -> /login?code=... (single attempt, DO NOT retry same code) -> dashboard.
4. If blank still -> Render is sleeping; ping the backend once (warm it up) then retry.

**Rule:** before chasing any "server error / network error" in code, check Render sleep + SQLite wipe first. That has been the actual cause ~9/10 times, not a code bug.
