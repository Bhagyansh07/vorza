# 00 — Recon

> Phase 0 deliverable. Every number below was produced by running the commands
> shown, on Windows, Python 3.13.1 / Node v24.15.0, on 2026-10-05.

## 1. What this project is

**Vorza** (repo folder and GitHub repo are still named `codeatlas`) turns a
connected GitHub repository into an interactive, force-directed map of its files —
node size driven by complexity, node colour driven by a health score — with
comment pins and multiplayer cursor presence layered on top, plus an AI review of
incoming pull requests.

The product pitch from `README.md:26-28`:

> CodeAtlas turns any GitHub repo into a living, force-directed map — sized by
> complexity, colored by health — where teammates see each other's cursors like
> Figma, and an AI agent auto-reviews every new PR and updates the map live.

### Who it is for

Per `README.md:45-54` and `brain/`, the stated audience is **recruiters and
hiring managers** reviewing a 4th-year student's portfolio, plus engineers who
want a fast read on an unfamiliar codebase. The repo is explicitly framed as a
"resume-grade, full-stack + AI project" (`README.md:3`).

This matters for every later decision: the demo has to survive a 60-second look,
so the graph screen and the first-impression load matter more than breadth of
features.

## 2. Reality vs. the repo's own claims

This is the single most important finding of Phase 0, so it goes first.

The repo carries a large amount of **process scaffolding that was never filled
in**, and it reads like documentation but is not:

| File | Claimed | Actual |
| --- | --- | --- |
| `brain/01_PRD.md` | PRD | **Empty template.** Every section still contains `[ ]` / `[Describe the real-world problem...]` placeholders. `brain/01_PRD.md:12` literally reads `Primary users: [ ]`. |
| `brain/15_MICROTASKS.md` | Task board | Three tasks, all `Status: TODO` (`brain/15_MICROTASKS.md:20,33,42`). No task was ever claimed or completed through the BRAIN protocol. |
| `brain/14_PRODUCTION_CHECKLIST.md` | Launch gate | Untouched template, all boxes empty. |
| `AGENTS.md` | "brain/ is the single source of truth" | Cannot be followed — the specs are empty, so `brain/00_MASTER_RULES.md`'s instruction to "skim `01_PRD.md` for scope" yields nothing. |
| `README.md` | Product readme | Still describes the repo as a **"project kit" for briefing 6 AI agents** (`README.md:6-11`), with quick-start instructions to `cp -r /path/to/this/kit/* .` (`README.md:64`). It does not describe the app that actually exists. |
| `HANDOVER.md:34` | Architecture | References `backend/app/core/database.py`, but the real file is `backend/app/core/db.py`. |
| `HANDOVER.md:37` | Architecture | References `features/repos/.../ReposList`, which does not exist. |
| `frontend/src/features/graph/README.md:3` | Feature doc | "This folder is intentionally empty" — but it contains 13 implemented components. |
| `frontend/src/features/comments/README.md` | Feature doc | Describes comment UI as not built; it is built (`CommentLayer.tsx`). |
| `CONTRACTS.md` | Source of law | The 6-agent contract system was designed for parallel agents that never ran. |

**Consequence:** the `AGENTS.md` constitution instructs any agent to treat
`brain/` as authoritative and to stop at `[NEEDS INPUT]` rather than guess. Since
`brain/` is empty, following it literally blocks all work. I have therefore
treated the **code** as the source of truth for scope, and recorded the spec gap
as a finding rather than inventing PRD content.

## 3. Tech stack (verified from manifests, not docs)

| Layer | Choice | Evidence |
| --- | --- | --- |
| Backend framework | FastAPI 0.142.2 + Starlette 1.7.0 | `backend/pyproject.toml:7` |
| ORM / models | SQLModel 0.0.47 over SQLAlchemy 2.0.54 | `pyproject.toml:15` |
| DB | SQLite by default, Postgres-ready via `DATABASE_URL` | `backend/app/core/config.py:29`, `:31-38` |
| Migrations | Alembic (present, one initial revision) | `backend/alembic.ini`, `backend/app/alembic/versions/0001_initial.py` |
| Auth | GitHub OAuth + PyJWT HS256 access token | `backend/app/services/github.py:39-57`, `backend/app/core/security.py:11` |
| Realtime | FastAPI WebSocket + Redis pub/sub with in-memory fallback | `backend/app/ws/gateway.py:90`, `backend/app/ws/pubsub.py` |
| Static analysis | Pure-Python, no external service | `backend/app/services/analysis.py` |
| AI PR review | OpenAI chat-completions, JSON mode, lazy-imported | `backend/app/services/ai_review.py:73-111` |
| Frontend | React 18 + TypeScript + Vite 6 | `frontend/package.json:27-29,54` |
| Routing | react-router-dom 6 | `package.json:34` |
| Server state | TanStack Query 5 | `package.json:20` |
| Client state | Zustand 5 | `package.json:36` |
| Styling | Tailwind 3 + shadcn-style local UI primitives | `frontend/tailwind.config.ts` |
| Graph rendering | Raw `d3-force` / `d3-selection` / `d3-zoom` (no wrapper lib) | `package.json:26-28` |
| Charts | Recharts 3 | `package.json:33` |
| Toasts | sonner | `package.json:34` |
| Container | Docker + docker-compose, root and `backend/compose.yml` | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` |
| CI | GitHub Actions, 3 jobs | `.github/workflows/CI.yml` |
| Deploy targets | Vercel (frontend), Render (backend, documented in `HANDOVER.md`) | `vercel.json`, `frontend/vercel.json` |

### Entry points

- Backend ASGI app: `backend/app/main.py:30` (`app.main:app`), router prefix from
  `settings.API_V1_STR`, which defaults to `""` (`config.py:18`) so routes match
  `CONTRACTS.md` verbatim.
- Backend routes: `backend/app/api/main.py` aggregating `auth`, `repos`,
  `analysis`, `comments`, `webhooks`; plus `ws_router` mounted at the app root.
- Frontend: `frontend/index.html` → `frontend/src/main.tsx` → `App.tsx` →
  `app/router.tsx`.
- Health endpoint: **none** (see `docs/audit/06-deployment.md`).
- OpenAPI: `/openapi.json` (no `/api` prefix).

### Environment variables

Root `.env.example` declares: `POSTGRES_PASSWORD`, `FASTAPI_ENV`, `SECRET_KEY`,
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `REDIS_URL`,
`FRONTEND_HOST`.

Backend additionally reads, per `backend/app/core/config.py`, without appearing in
any `.env.example`: `API_V1_STR`, `PROJECT_NAME`, `ACCESS_TOKEN_EXPIRE_MINUTES`,
`DATABASE_URL`, `GITHUB_OAUTH_SCOPES`, `GITHUB_OAUTH_CALLBACK_URL`,
`REPO_CHECKOUTS_DIR`. `ai_review.py:77-78` reads `OPENAI_API_KEY` and
`OPENAI_MODEL` from the raw environment via `os.getenv`, bypassing settings
entirely.

Frontend reads `VITE_API_URL`, `VITE_USE_MOCKS`, `VITE_GITHUB_OAUTH_URL`,
`VITE_GITHUB_CLIENT_ID`, `VITE_GITHUB_CALLBACK_URL` (`frontend/src/lib/config.ts:9-21`).

### External services

GitHub OAuth + REST API, GitHub webhooks, OpenAI (optional, PR review only),
Redis (optional, realtime fan-out), Neon/Postgres (optional, persistence),
Vercel, Render, Sentry is **not** wired.

## 4. How to run it

### Backend (Windows, verified)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

`SECRET_KEY` is mandatory (`config.py:20` has no default), so `.env` must exist at
`backend/.env`.

### Frontend (verified)

```powershell
cd frontend
npm ci
npm run dev
```

### The documented commands are wrong

`CI.yml:28` runs `pip install -e ".[dev]"`. `pyproject.toml:19-26` declares the
dev tools under `[dependency-groups]` (PEP 735), **not**
`[project.optional-dependencies]`. `.[dev]` therefore names an extra that does not
exist, and pip silently installs runtime deps only. Measured result after running
the documented command: `pytest`, `ruff`, `mypy` and `coverage` were all absent —
`pip list` matched only `SQLAlchemy`.

The correct command is:

```powershell
.\.venv\Scripts\python.exe -m pip install -e . --group dev
```

`pytest-cov` is missing from the dev group entirely, so `CI.yml:37`'s
`--cov=app --cov-report=term-missing --cov-fail-under=60` fails with
`error: unrecognized arguments: --cov=app`. Both defects are fixed in Phase 1.

## 5. Measured baseline

All numbers from this machine, on the branch point of `master`
(commit `b01b6c0`). Nothing below is estimated.

### Backend

| Check | Command | Result |
| --- | --- | --- |
| Tests | `pytest tests -q` | **23 passed**, 1 warning, 0.44s |
| Lint | `ruff check .` | **66 errors** (50 auto-fixable) |
| Format | `ruff format --check .` | **36 files** would be reformatted, 10 already clean |
| Types | `mypy app` (strict) | **47 errors in 17 files** of 35 checked |

### Frontend

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | **0 errors** |
| Lint | `npm run lint` | **0 errors, 4 warnings** |
| Tests | `npm test` | **26 passed** across 6 files, 45.5s |
| Build | `npm run build` | **succeeds**, 2555 modules, 21.7s |
| Deps | `npm audit` | **10 vulnerabilities — 6 high, 4 moderate** |

### Production bundle (from `npm run build`)

| Chunk | Raw | Gzip |
| --- | --- | --- |
| `charts-BmzW2pkX.js` (recharts) | 356.24 kB | 103.75 kB |
| `index-Co6llnv-.js` (app) | 284.60 kB | 91.74 kB |
| `react-Bv0AXtS9.js` | 205.74 kB | 65.68 kB |
| `d3-D5_4qGb0.js` | 60.22 kB | 20.62 kB |
| `index-C_O2xeVZ.css` | 25.61 kB | 5.56 kB |
| `index.html` | 0.81 kB | 0.42 kB |

Total JS ≈ **906.8 kB raw / 281.8 kB gzip**. Recharts is the single largest
chunk and is only used by `TrendChart` on the history page — a lazy-load
candidate.

### GitHub Actions: red on every run

The last 10 CI runs all conclude `failure`, and in every one the **`backend` job
fails at the `Lint (ruff)` step**. `frontend` and `docker-build` pass on all 10.

```
RUN 36905893860 | failure | master | 2026-10-01 | backend -> failure (Lint (ruff))
RUN 35055282747 | failure | master | 2026-09-16 | backend -> failure (Lint (ruff))
... 10/10 identical
```

The repo's badge state is therefore "failing", and CI has never been green with
the current lint config.

### Git state

- Default branch is **`master`** (not `main`), despite `AGENTS.md` saying "Never
  commit directly to `main`" and `README.md:68` telling the reader to `push -u
  origin main`.
- 30 commits, conventional-commit style, decent messages. Monorepo consolidated
  in `6fc97f8`.
- Repo is **private**, has **no description**, **no topics**, **0 stars**, and
  `homepageUrl` set to `https://frontend-mu-jet-18.vercel.app` — a URL that
  differs from the one `HANDOVER.md:47` calls live
  (`https://frontend-bhagyansh.vercel.app`). One of the two is stale.
- `.env.production` is committed (`frontend/.env.production`). Its contents were
  **NOT VERIFIED** — deliberately not read during recon. `git log` shows it was
  added by `0328ebb` with the message "commit public VITE build-time env
  (.env.production): backend URL + mocks off", which asserts it holds only public
  build-time values. This must be verified before anything is published.

## 6. What actually works, feature by feature

Measured by reading the code, not the docs. Full table with severity and effort
is in `docs/audit/01-code-audit.md`.

| Capability | State | Evidence |
| --- | --- | --- |
| GitHub OAuth login | **Complete** | `services/github.py` HMAC-signed `state`, constant-time compare at `:77`; `api/routes/auth.py` |
| Repo connect + list | **Complete** | `api/routes/repos.py`, covered by `tests/api/routes/test_auth.py` and frontend `Dashboard.test.tsx` |
| Static analysis (health + complexity per file) | **Complete** | `services/analysis.py`, pure functions, driven by `orchestrator.analyze_repo` |
| Real repo checkout for analysis | **Complete** | `orchestrator.py:55` `_ensure_checkout(repo, token)` |
| Force-directed graph rendering | **Complete but visually broken** | 13 components in `features/graph/components/`; see below |
| Analysis snapshots + history | **Complete** | `models/snapshot.py`, `api/routes/analysis.py` |
| Health history chart | **Complete** | `features/graph/components/TrendChart.tsx` (recharts) |
| Comment pins | **Partial** | UI is complete (`CommentLayer.tsx`); see realtime note |
| Multiplayer cursors ("like Figma") | **Stub in the product path** | Frontend has **zero** WebSocket code — `grep WebSocket frontend/src` returns nothing. `RepoDetail.tsx:143` hardcodes `realtime={mockRealtimeSource}`, a timer-driven fake (`features/graph/mocks/events.ts:54-168`) that invents two drifting cursors and two fake AI reviews. The backend gateway is real and correct (`ws/gateway.py`), so this is frontend wiring that was never written. |
| AI PR review on webhook | **Cannot run in production** | `pyproject.toml` has **no `openai` dependency**; `ai_review.py:85` lazy-imports it, so `OpenAIReviewClient._connect()` raises `LLMError("OPENAI_API_KEY is not set")` → `AiReviewError` → swallowed by `orchestrator.py:126-131`. No `OPENAI_API_KEY` is in any `.env.example`. Result: the webhook returns `{"status":"ok"}` and nothing is ever reviewed. |
| Analysis survives restarts | **Broken by design on free tier** | `HANDOVER.md:51-62` documents it: Render's ephemeral disk wipes the SQLite file, so connected repos vanish. Durable fix is a free Neon Postgres via `DATABASE_URL`. |
| Design system | **Inconsistent — see below** | |

### The graph UI renders with no colour tokens

This is the most consequential visual defect and it is invisible from the docs.

`features/graph/` styles itself with twelve Tailwind colour utilities that
**do not exist** in either `tailwind.config.ts` or `src/index.css`:

```
bg-surface   bg-raised   bg-line      bg-signal-good
border-line  border-signal-good  border-signal-warn  border-signal-bad
text-ink     text-signal-good    text-signal-warn    text-signal-bad
```

`src/index.css:11-43` defines only the shadcn set (`--background`, `--primary`,
`--border`, …) plus `--health-*` and `--complexity-*`. It defines **no**
`--surface`, `--raised`, `--line`, `--ink`, `--ink-faint` or `--signal-*`.
`tailwind.config.ts:43-87` exposes only the shadcn keys plus `health.*` and
`complexity.*`.

Tailwind emits no CSS for an unknown utility, so every one of those classes is a
silent no-op. The components also rely on `rounded-stem` (not in the
`borderRadius` scale at `tailwind.config.ts:88-92`) and a `tabular` font-feature
utility that is likewise undefined.

Net effect: the app's centrepiece — the "living map" — renders unstyled and
colourless, while the rest of the app uses the shadcn palette. The two halves do
not share a design language because only one of them has one.

Additionally the palette itself (`--primary: 258 90% 70%`, `--background: 224 30% 7%`)
is the stock shadcn violet-on-near-black default, which is exactly the generic
template look a portfolio project cannot afford.

## 7. Phase 0 status

**done.** Repo mapped, both halves installed and executed, baseline measured,
CI history inspected, and the spec-vs-code gap documented.

Verified this phase: both builds run; 49 tests pass (23 backend + 26 frontend);
ruff, mypy, eslint, tsc and npm audit all executed with recorded output; CI run
history queried via the GitHub API.

Not verified: `frontend/.env.production` contents (not read); live behaviour of
the deployed Render and Vercel instances (no credentials used, and
`HANDOVER.md`'s two conflicting URLs mean the target host is ambiguous);
Docker Compose stack (no Docker on this machine — `STATUS.md:29` records the same
blocker earlier).