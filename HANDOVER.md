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
| Backend (Render, free) | `https://codeatlas-qr0e.onrender.com` | /docs 200, 9 routes, CORS green, OAuth OK |
| Frontend (Vercel) | `https://frontend-bhagyansh.vercel.app` | Serves "Vorza" (title check), /login + /dashboard 200, mocks OFF + bundle has Render URL |

Verified (last check): GitHub OAuth authorize URL redirects to `https://frontend-bhagyansh.vercel.app/login`, backend callback exchange returns 400 on garbage code (means callback route + secret + DB all fine). CORS preflight 200.

## 4. KNOW ISSUE (1 real issue, infra not code)
**Symptom:** connect repo → "Connected" toast → dashboard shows "No repos connected yet" / blank.

**Root cause (NOT a code bug — infra):**
- Render **free tier** sleeps after 15 min idle AND wipes the ephemeral disk on restart/move.
- Backend SQLite DB file (data/vorza.db) lives on that disk → every restart/move deletes connected repos.
- (Earlier "network error" on login was the same: cold start 30-60s; GitHub OAuth code is single-use, so retrying the same code fails with "code incorrect/expired".)

**Fix (durable):** backend is Postgres-ready (reads DATABASE_URL). Just:
1. Create free Postgres on Neon (neon.tech) - 0.5GB, no card.
2. Render -> CodeAtlas backend -> Environment -> add DATABASE_URL=<neon string> -> Deploy.
3. Now connects persist forever (no more wipes).

## 5. STARTING A NEW SESSION — where to begin
1. Backend cold? Render sleep -> first request takes 30-60s.
2. Open `https://frontend-bhagyansh.vercel.app` (hard refresh / incognito).
3. "Continue with GitHub" -> GitHub authorize -> /login?code=... (single attempt, DO NOT retry same code) -> dashboard.
4. If blank still -> Render is sleeping; ping the backend once (warm it up) then retry.

**Rule:** before chasing any "server error / network error" in code, check Render sleep + SQLite wipe first. That has been the actual cause ~9/10 times, not a code bug.
