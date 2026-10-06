# 00 — Recon (current state)

> Phase 0 deliverable. Second pass — the first pass (`docs/audit/00-recon.md`,
> 2026-10-05) audited the pre-fix codebase; this one re-verifies everything
> against the current `master` (HEAD `b08db33`) and records what changed since.
> Every claim cites a path:line. No numbers below are estimated.

## 1. What this project is

**Vorza** turns a connected GitHub repository into an interactive force-directed
map of its files: node size = complexity, node colour = health score, with
comment pins, live multiplayer cursors, health history, and an AI PR review
with citations. Product pitch at `README.md:26-28`.

Audience: a 4th-year student's portfolio piece that has to survive a 60-second
look by a recruiter (`README.md:45-54`), plus engineers who want a fast read on
an unfamiliar repo.

Live: frontend https://vorza-sigma.vercel.app (Vercel), backend
https://codeatlas-qr0e.onrender.com (Render), Postgres on Neon. The GitHub repo
is still named `codeatlas` and is **private**.

**Branding decision (2026-10-06):** the product name is **Vorza**. The GitHub
repo/folder name `codeatlas` will be renamed and domains consolidated in the
Phase 6/7 deploy pass, not in this recon.

## 2. Repo tree (depth 3, tracked files only)

```
codeatlas/
├── backend/                      FastAPI app
│   ├── app/
│   │   ├── api/routes/           auth, repos, analysis, comments, webhooks
│   │   ├── alembic/versions/     0001_initial, 0002_*, 0003_*
│   │   ├── core/                 config, db, schema, security, rate_limit
│   │   ├── models/               user, repo, snapshot, comment
│   │   ├── services/             analysis, ai_review, github, orchestrator, pipeline
│   │   └── ws/                   gateway (WebSocket), pubsub, events, manager
│   ├── tests/                    160 tests
│   ├── Dockerfile, render.yaml(→root), pyproject.toml, alembic.ini
├── frontend/                     React 18 SPA
│   └── src/
│       ├── app/                  router, ProtectedRoute, providers
│       ├── components/           layout (AppShell, Navbar), brand (Logo), ui/ (shadcn primitives)
│       ├── features/             auth, repos, graph, landing, comments
│       ├── lib/                  api-client, config, health, http-client, seo, token
│       └── types/                API types mirroring CONTRACTS.md
├── docs/                         ARCHITECTURE, DESIGN_SYSTEM, GIT_WORKFLOW, MANUAL_STEPS,
│                                 audit/ (first-pass audit), REFERENCE_REPOS, RESUME_BULLETS, SEO_BACKLINKS
├── scripts/                      brand asset generation/checking
├── .github/workflows/CI.yml
├── render.yaml                   Render blueprint
├── vercel.json                   SPA rewrites
├── CONTRACTS.md                  API + WebSocket contract (source of law)
└── AGENTS.md                     working rules
```

Language split by tracked file count: **TypeScript/TSX dominates the frontend
(~95 files)**, Python the backend (~45 files). No monorepo tooling; two
independent packages (`backend/`, `frontend/`) each with its own manifest.

## 3. Tech stack (verified from manifests)

| Layer | Choice | Evidence |
| --- | --- | --- |
| Backend | FastAPI (starlette stack) + uvicorn | `backend/pyproject.toml:7`, `:133` |
| ORM | SQLModel over SQLAlchemy 2 | `pyproject.toml:15` |
| Migrations | Alembic; `0001`→`0003`; run on boot | `backend/app/alembic/versions/`, `backend/Dockerfile` CMD |
| DB | PostgreSQL via **psycopg v3 only** (`postgresql+psycopg://`), SQLite fallback for dev | `backend/app/core/config.py:44-53` |
| Auth | GitHub OAuth + PyJWT HS256 JWT | `backend/app/services/github.py`, `backend/app/core/security.py` |
| Realtime | FastAPI WebSocket `/ws/repos/{id}` + in-process pub/sub hub (Redis optional) | `backend/app/ws/gateway.py:94`, `backend/app/ws/pubsub.py` |
| Static analysis | Pure Python (AST), no external service | `backend/app/services/analysis.py:1-15` |
| AI PR review | `openai` SDK ≥1.60, JSON mode, any OpenAI-compatible endpoint | `pyproject.toml:22`, `backend/app/services/ai_review.py` |
| Frontend | React 18 + TypeScript 5.8 + Vite 6 | `frontend/package.json:32,34,65,67` |
| Routing | react-router-dom 6 | `frontend/src/app/router.tsx` |
| Server state | TanStack Query 5 | `package.json:20` |
| Client state | Zustand 5 | `package.json:36` |
| Styling | Tailwind 3 + local shadcn-style primitives + Geist font | `frontend/tailwind.config.ts`, `index.css` |
| Graph | Raw `d3-force` + `d3-zoom` (no wrapper) on SVG | `package.json:26-28`, `features/graph/components/ForceDirectedGraph.tsx` |
| Charts | Recharts 3 (lazy-loaded on history page) | `package.json:33` |
| CI | GitHub Actions: backend (pytest/ruff/mypy), frontend (tsc/eslint/vitest), docker-build | `.github/workflows/CI.yml` |
| Hosting | Vercel (frontend, static SPA), Render (backend, Docker), Neon (Postgres) | `vercel.json`, `render.yaml` |

## 4. Frontend

- **Build:** Vite 6 + `tsc -b` (typecheck gate in `npm run build`). `eslint 9`
  + `prettier`. Tests: Vitest 3 + Testing Library + MSW, 110 tests.
- **Routes** (`frontend/src/app/router.tsx:20-37`): `/` public Landing,
  `/login`, then behind `ProtectedRoute` → `/dashboard`, `/repos/:repoId`,
  `/repos/:repoId/history`, `*` → NotFound.
- **Graph pipeline:** `RepoDetail` → `useGraphView` + `lib/graphModel.ts`
  (nodes/edges from snapshot `files[]`, edge = `imports` match) →
  `ForceDirectedGraph` (d3-force simulation, zoom, health colours from
  `lib/health-thresholds.ts`, thresholds 70/45) → overlay layers: presence
  (cursors), comments (pins), review banner.
- **Realtime:** `features/graph/realtime/websocket.ts` connects to
  `wss://…/ws/repos/{id}`, sends `presence:join` with JWT, handles
  roster/join/leave/cursor/comment/review events. Backend throttles cursor
  frames at 10 Hz (`backend/app/ws/gateway.py:43-45`).
- **Styling:** Tailwind with shadcn-style CSS variables in HSL, light theme,
  final design tokens in `docs/DESIGN_SYSTEM.md`.
- **SEO:** `src/lib/seo.ts` sets per-page title/description; `index.html` has
  OG/meta; `public/og-image.png` (1200x630). Known gap: SPA is client-rendered,
  so crawlers see an empty shell (Phase 4 work).

## 5. Backend — every route

REST (all under empty `API_V1_STR`, so paths match CONTRACTS.md verbatim):

| Method | Path | Input | Output | Auth | File |
| --- | --- | --- | --- | --- | --- |
| GET | `/auth/github/login` | — | `GithubAuthorize {authorize_url, scopes, write_access}` | none | `api/routes/auth.py:48` |
| POST | `/auth/github/callback` | `{code, state}` | `Token {access_token, token_type}` | none | `auth.py:84` |
| GET | `/me` | — | `UserPublic` | JWT | `auth.py:137` |
| POST | `/repos` | `{github_full_name}` | `RepoPublic` (201) | JWT | `api/routes/repos.py:19` |
| GET | `/repos` | — | `ReposPublic {data, count}` | JWT | `repos.py:67` |
| GET | `/github/repos` | — | `list[GitHubRepoLite]` | JWT | `repos.py:81` |
| DELETE | `/repos/{repo_id}` | — | 204, cascades snapshots/comments/reviews | JWT | `repos.py:106` |
| GET | `/repos/{id}/snapshots/latest` | — | `AnalysisSnapshotPublic` (graph data) | JWT | `api/routes/analysis.py:19` |
| GET | `/repos/{id}/snapshots/history` | — | `SnapshotsList` (trend summaries) | JWT | `analysis.py:39` |
| POST | `/repos/{id}/analyze` | — | 202 `{message}` (queues BackgroundTask) | JWT | `analysis.py:62` |
| GET | `/repos/{id}/comments` | — | `CommentsPublic` | JWT | `api/routes/comments.py:14` |
| POST | `/repos/{id}/comments` | `CommentCreate` | `CommentPublic` (201) | JWT | `comments.py:31` |
| POST | `/webhooks/github` | raw body + HMAC headers | `{status, …}` | HMAC signature | `api/routes/webhooks.py:18` |

WebSocket: `GET/WS /ws/repos/{repo_id}` with mandatory first frame
`presence:join {repo_id, token}` (`gateway.py:94,139-172`); events:
`presence:join/leave/roster/cursor`, `comment:new`, `snapshot:updated`,
`review:new`, `error` (see CONTRACTS.md).

- **Auth:** JWT HS256, 8-day expiry (`config.py:26`). WebSocket auth re-verifies
  the JWT server-side per socket (`gateway.py:168`).
- **Owner checks:** every repo route goes through `get_owned_repo`
  (`api/deps.py`); snapshot/comment routes verify the repo belongs to the caller.
- **Rate limiting:** in-process sliding windows; `/auth/*` 20/min,
  `/webhooks/github` 60/min, `/repos*` 30/min, writes 30/min, default 120/min;
  429 + Retry-After (`core/rate_limit.py:105-118`).
- **Security headers:** `SecurityHeadersMiddleware` (`core/security_headers.py`).
- **Background jobs:** `BackgroundTasks` per request (notcelery/redis queue):
  `analyze_repo` and `review_pull_request` each open their own short-lived DB
  session so they survive request teardown (`services/orchestrator.py:14-16`).

## 6. Env vars (names only) + secrets handling

Backend (`backend/app/core/config.py`, pydantic-settings, reads `backend/.env`):

`API_V1_STR`, `PROJECT_NAME`, `APP_VERSION` (surfaced in `/openapi.json`
`info.version` = live-build marker), `SECRET_KEY` (required, no default),
`ACCESS_TOKEN_EXPIRE_MINUTES`, `FRONTEND_HOST`, `CORS_ORIGINS`,
`FASTAPI_ENV`, `DATABASE_URL` (default SQLite, prod = Neon Postgres),
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_SCOPES`,
`GITHUB_OAUTH_CALLBACK_URL`, `GITHUB_WEBHOOK_SECRET` (no default → 503 when
unset), `REDIS_URL` (empty → in-process hub), `OPENAI_API_KEY`,
`OPENAI_MODEL`, `OPENAI_BASE_URL` (empty → OpenAI default), `REPO_CHECKOUTS_DIR`.

Frontend (`frontend/src/lib/config.ts:9-21`): `VITE_API_URL`,
`VITE_USE_MOCKS`, `VITE_GITHUB_OAUTH_URL`, `VITE_GITHUB_CLIENT_ID`,
`VITE_GITHUB_CALLBACK_URL`.

Secrets handling: no secret values in the repo (verified by fresh-clone check);
secret-bearing envs live only in Render/GitHub dashboards and the untracked
local `.env`. `frontend/.env.production` is committed but holds only public
build-time values (backend URL, mocks off). Placeholder secrets are refused at
startup in production (`config.py:105-132`). Webhook receiver is fail-closed:
no secret configured → 503, never a signature check against nothing
(`api/routes/webhooks.py:34-38`).

External services touched: GitHub (OAuth, REST, webhooks), one OpenAI-
compatible LLM provider for PR review (optional), Neon Postgres (persistence),
Vercel + Render (hosting). Sentry/analytics: **not wired**.

## 7. Pipeline: from "GitHub URL" to "graph on screen"

1. **Login** — browser → `GET /auth/github/login` → GitHub authorize URL with
   HMAC-signed `state` (`github.py:90-129`) → GitHub → callback `POST
   /auth/github/callback` (`auth.py:84`) exchanges code → JWT minted, user row
   upserted with the stored GitHub token (`auth.py:108-133`).
2. **Connect** — `POST /repos` validates the repo exists via GitHub API
   (`repos.py:40-51`), stores `Repo {owner_id, github_full_name,
   default_branch}` (`models/repo.py`).
3. **Analyze** — `POST /repos/{id}/analyze` queues BackgroundTask
   `analyze_repo` (`analysis.py:62-80`):
   - `orchestrator.py:82` resolves repo + owner's GitHub token
     (`pipeline.py:110-125`).
   - `_ensure_checkout` clones `--depth=1` once, then `git pull --ff-only` on
     re-runs; token-less remote is restored so secrets never persist in the
     worktree (`pipeline.py:61-107`).
   - Pure `analysis.analyze_repo(checkout)` walks supported files (`.py .js
     .jsx .ts .tsx .mjs .cjs`, skipping node_modules/.git/etc,
     `analysis.py:33-52,66-75`) and computes per-file loc / complexity /
     churn / imports / health — formulas at `analysis.py:10-15` — plus a
     LOC-weighted snapshot health.
   - Result validated into domain `FileNode`s, dumped to JSON dicts, stored as
     `AnalysisSnapshot` (`orchestrator.py:89-108`);
     `repo.last_analyze_error` cleared, then `snapshot:updated` broadcast to
     open graphs (broadcast failure logged, never marks the run failed,
     `orchestrator.py:110-124`).
4. **Graph** — `GET /repos/{id}/snapshots/latest` returns the snapshot
   (`analysis.py:19-36`); frontend builds nodes (=files) and edges (=
   `imports` resolved against other file paths) in `graphModel.ts`, simulates
   with d3-force, colours by health thresholds 70/45
   (`lib/health-thresholds.ts`).

**PR review path:** webhook (`webhooks.py:18`) verifies HMAC, then for each
connected copy of that repo queues `review_pull_request`: fetch unified diff
(`github.py:304-324`) → truncate to 120k chars (`ai_review.py:37`) → one JSON
call to the configured provider (with retry + validation,
`ai_review.py`) → persisted `AiReviewRow`, broadcast `review:new`. No
`OPENAI_API_KEY` → skips with a logged reason, webhook stays 200
(`orchestrator.py:162-173`).

## 8. Known limits (current)

- **Analysis:** only 7 extensions supported; JS/TS imports via regex, Python
  via AST; no Java/Go/Ruby/C etc. (falls back to loc-only — file still appears,
  graph edges absent). Complexity is a proxy (fn/class/nesting count), not full
  cyclomatic. Churn window: git history of the local checkout (depth-1 clone
  means churn is 0 on first run, grows with re-analysis).
- **Clones:** shallow (`--depth=1`) so no full history; `git` subprocess
  timeout 600s (`pipeline.py:54`).
- **GitHub API:** httpx timeouts 15s (auth/profile/metadata), 30s (diff);
  `/user/repos` paginated `per_page=100` — repos beyond 100 unlisted;
  unauthenticated API rate limits apply to the OAuth app's token budget.
- **AI review:** diff cap 120k chars; one retry on malformed JSON; model price
  table covers only gpt-4o-mini/gpt-4o/gpt-4.1-mini/o3-mini — other providers
  report $0 cost (`ai_review.py:41-46`); free providers (Groq etc.) are
  rate-limited by them.
- **Rate limits (self):** in-process (per-instance), not shared across
  replicas; `/auth/*` 20/min, webhook 60/min, `/repos*` 30/min, writes 30/min,
  default 120/min.
- **Deploy:** Render free = 1 instance, cold start ~50s (no keep-alive), no
  managed Redis → in-process hub (correct for single instance). Rebuild on
  every push to `master` (~3-6 min).
- **Storage:** snapshots store full file list as JSON per run → unbounded
  growth over time; no trimming job yet.

## 9. What changed since the first audit (`docs/audit/00-recon.md`)

| Old finding (2026-10-05) | Status now |
| --- | --- |
| CI red 10/10 (ruff) | **Fixed** — green for `08ad016`/`b08db33` (backend, frontend, docker-build) |
| `openai` dependency missing → AI review silently no-op | **Fixed** — `pyproject.toml:22`; key optional, graceful skip with logged reason |
| Multiplayer cursors were a mock (`RepoDetail.tsx` hardcoded fake) | **Fixed** — real WebSocket client `features/graph/realtime/websocket.ts` |
| Analysis lost on Render restart (SQLite on ephemeral disk) | **Fixed** — Neon Postgres `DATABASE_URL` + Alembic on boot |
| Graph UI used undefined Tailwind tokens (violet-on-black) | **Fixed** — design system pass, light theme, Geist, `docs/DESIGN_SYSTEM.md` |
| 23 backend / 26 frontend tests | **Now 160 backend / 110 frontend** |
| No AI provider flexibility | **New** — `OPENAI_BASE_URL` (b08db33) → any OpenAI-compatible free provider |
| Health endpoint absent | still absent — version is surfaced via `/openapi.json` `info.version` |

**Still missing / open:** repo is private with no topics/description; landing is
client-rendered (SEO gap); no custom domain; no demo video; no sample-repo
one-click demo; block-level symbol parsing; WebGL rendering at scale; snapshot
trimming; GitHub App read-only scoping (F14); OAuth `state` not single-use (P2).

## 10. Phase 0 status

**done.** Recon re-verified against current `master` (`b08db33`), live backend
checked via `/openapi.json` (routes + schemas + `info.version`), frontend
structure read from source. Test counts cross-checked against this session's
runs (`pytest`: 160 passed; frontend suite 110).

Next: Phase 1 audit (see `docs/audit/01-code-audit.md` for the first pass —
will be re-validated against current state).