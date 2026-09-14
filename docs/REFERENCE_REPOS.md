# Reference repos — the two best-in-class starting points

Every agent should skim both of these before writing their first line of code.
They are not to be forked wholesale — CodeAtlas is a specific product — but
their *patterns* are exactly what a recruiter wants to see, because both are
widely recognized, actively maintained, real-world-battle-tested repos.

## 1. Backend + full-stack skeleton — `fastapi/full-stack-fastapi-template`

<https://github.com/fastapi/full-stack-fastapi-template>

Maintained directly by Sebastián Ramírez (creator of FastAPI). ~35k stars.
Gives you, out of the box: FastAPI + SQLModel + PostgreSQL + JWT auth +
React + Vite + TailwindCSS + shadcn/ui + Docker Compose + GitHub Actions CI +
Playwright E2E tests already wired together correctly.

**How to use it:**
- **Agent 1 (Backend Lead)**: use this as the literal starting skeleton for
  `backend/` — its auth flow, DB session pattern, and Docker Compose setup are
  production-grade. Adapt its `User`/`Item` models into CodeAtlas's `User`/
  `Repo`/`AnalysisSnapshot` models instead of reinventing auth from scratch.
- **Agent 6 (DevOps Lead)**: copy its GitHub Actions workflows and Docker
  Compose file as the base, then extend with Redis and the frontend's real
  build steps.

## 2. Frontend architecture — `alan2207/bulletproof-react`

<https://github.com/alan2207/bulletproof-react>

~35k stars. The most widely cited reference for how to structure a
production React app: **feature-based folders** (not "one giant `components/`
folder"), a clear rule for where API calls, hooks, and UI for a feature live
together, testing conventions, and — notably — it ships its own `AGENTS.md`
for AI coding agents, which is exactly the convention this kit follows.

**How to use it:**
- **Agent 3 (Frontend Lead)**: mirror its `src/features/<feature-name>/`
  structure for CodeAtlas's features: `auth/`, `repos/`, `graph/`, `comments/`.
  Each feature folder gets its own `api/`, `components/`, `hooks/`, `types/`.
- **Agent 4 (UI/UX Lead)**: put the graph visualization inside
  `src/features/graph/`, following the same internal convention, so Agent 3's
  routing/shell code and Agent 4's visualization code never fight over the
  same files.

## The combination

Backend skeleton from template #1 + frontend architecture from template #2 +
CodeAtlas's own domain (graph viz, real-time, AI review) on top = a codebase
that looks like it was built by an experienced team, because it borrows the
exact patterns experienced teams already converged on.
