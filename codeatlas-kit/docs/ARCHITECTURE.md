# Architecture

## System diagram (text form)

```
                 ┌─────────────────────┐
                 │   GitHub (target)   │
                 │  repo + PR webhooks  │
                 └──────────┬───────────┘
                             │ webhook / OAuth
                             ▼
┌────────────────────────────────────────────────────────┐
│                     FastAPI Backend                     │
│  ┌───────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  Auth /   │  │  Analysis /     │  │  WebSocket      │ │
│  │  Repos API│  │  AI Review      │  │  Gateway        │ │
│  │  (Agent1) │  │  engine (Agent2)│  │  (Agent5)       │ │
│  └─────┬─────┘  └────────┬────────┘  └────────┬────────┘ │
│        │                  │                    │          │
│        └────────┬─────────┴──────────┬─────────┘          │
│                  ▼                    ▼                    │
│           PostgreSQL              Redis (pub/sub +         │
│        (users, repos,             presence + cache)        │
│         snapshots, comments)                                │
└────────────────────────────────────────────────────────┘
                             │ REST + WebSocket
                             ▼
┌────────────────────────────────────────────────────────┐
│                    React Frontend                       │
│  ┌────────────┐   ┌──────────────────────┐              │
│  │  App shell,│   │  Graph viz, charts,   │              │
│  │  auth, API │   │  live cursors/comments│              │
│  │  client    │   │  (Agent4, wired by    │              │
│  │  (Agent3)  │   │   Agent5)             │              │
│  └────────────┘   └──────────────────────┘              │
└────────────────────────────────────────────────────────┘
```

## Tech stack (detailed)

**Backend**
- FastAPI (async Python), SQLModel ORM, PostgreSQL
- JWT auth + GitHub OAuth app for login and repo access
- Background jobs for analysis (simple async task first; Celery/Redis-queue only
  if a repo is too large to analyze inline within a request)
- Auto-generated OpenAPI docs at `/docs`

**AI / Analysis engine**
- Shallow clone of the target repo, walk the file tree
- Metrics: lines of code, cyclomatic-complexity proxy, git churn (commits per
  file over N months), import/dependency graph (JS/TS + Python to start)
- LLM call (Claude or GPT) per PR diff: risk score 0–100, plain-English summary,
  flagged smells — returned as structured JSON
- Everything the LLM returns is validated against a schema before it touches the DB

**Frontend**
- React 18 + TypeScript + Vite
- TailwindCSS + shadcn/ui for components
- TanStack Query for server state, Zustand (or Context) for local UI state
- react-force-graph or a custom D3 force layout for the map
- Recharts for trend lines
- Socket.io-client or native WebSocket for real-time

**Real-time**
- FastAPI native WebSocket endpoints
- Redis pub/sub so multiple backend instances (or just multiple workers) can
  broadcast presence/cursor/comment events consistently
- Reconnect + resync logic on the client: on reconnect, refetch current state,
  then resume streaming

**Infra**
- Docker Compose: `postgres`, `redis`, `backend`, `frontend`, `adminer` (DB UI)
- GitHub Actions: lint + type-check + test on every PR, build on merge to main
- Deploy target: Render/Railway/Fly.io for backend+DB, Vercel/Netlify for frontend

## Folder layout (target, once agents scaffold it)

```
codeatlas/
├── backend/
│   ├── app/
│   │   ├── api/            (routers: auth, repos, analysis, comments)
│   │   ├── models/         (SQLModel tables)
│   │   ├── services/       (analysis pipeline, LLM client)
│   │   ├── ws/             (websocket gateway)
│   │   └── core/           (config, security, db session)
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/            (routing, providers)
│       ├── features/       (auth, dashboard, graph, comments — bulletproof-react style)
│       ├── components/     (shared UI)
│       └── lib/             (api client, hooks)
├── docs/
├── tasks/
├── AGENTS.md
├── CONTRACTS.md
├── STATUS.md
└── docker-compose.yml
```
