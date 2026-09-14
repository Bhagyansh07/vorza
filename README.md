# CodeAtlas — The Living, AI-Reviewed Map of Your Codebase

> A resume-grade, full-stack + AI project, built by a 6-agent AI development team
> working in parallel inside this repo.

## 1. What is this kit?

This is not the app. This is the **project kit** — everything one person needs to
brief a team of 6 parallel AI coding agents (e.g. 6 OpenCode sessions) and have them
build a genuinely unique, portfolio-grade full-stack + AI product together, with
almost no chance of them stepping on each other's work.

Read in this order:
1. `docs/IDEA.md` — the product, why it's unique, why recruiters like it, the demo script.
2. `docs/ARCHITECTURE.md` — the system design and tech stack.
3. `docs/REFERENCE_REPOS.md` — the two best-in-class GitHub repos every agent should study.
4. `AGENTS.md` — the rules every agent (human or AI) follows in this repo.
5. `CONTRACTS.md` — the shared API/data contracts that let 6 agents work in parallel without collisions.
6. `docs/GIT_WORKFLOW.md` — how to run 6 agents on one repo safely (git worktrees).
7. `docs/KICKOFF_PROMPTS.md` — the exact text to paste into each of your 6 OpenCode sessions.
8. `tasks/01..06` — one detailed brief per agent.
9. `STATUS.md` — the shared log where the 6 agents "talk" to each other through the repo.

## 2. One-line pitch

**CodeAtlas turns any GitHub repo into a living, force-directed map — sized by
complexity, colored by health — where teammates see each other's cursors like
Figma, and an AI agent auto-reviews every new PR and updates the map live.**

## 3. Tech stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Backend API | FastAPI + SQLModel + PostgreSQL | Async, typed, auto OpenAPI docs, huge ecosystem |
| AI / Analysis | Claude or GPT API + custom static-analysis pass | Real agentic review, not a gimmick |
| Frontend | React 18 + TypeScript + Vite + Tailwind + shadcn/ui | Fast DX, modern, matches current hiring stacks |
| Visualization | D3-force / react-force-graph + Recharts | The "wow" of the demo |
| Real-time | FastAPI WebSockets + Redis pub/sub | Live cursors, live comments, live AI updates |
| Auth | JWT + GitHub OAuth | Recruiters recognize this instantly |
| Infra | Docker Compose, GitHub Actions CI | Deployable in one command |
| Testing | Pytest, Vitest, Playwright | Shows engineering discipline |

Full detail in `docs/ARCHITECTURE.md`.

## 4. The 6-agent team

| # | Role | Owns | Task file |
|---|---|---|---|
| 1 | Backend Lead | FastAPI app, DB models, auth, GitHub OAuth, webhooks | `tasks/01-backend-lead.md` |
| 2 | AI / Data Lead | Repo analysis pipeline, LLM review, risk scoring | `tasks/02-ai-data-lead.md` |
| 3 | Frontend Lead | React app shell, routing, state, API client | `tasks/03-frontend-lead.md` |
| 4 | UI/UX Lead | The graph visualization, charts, visual polish | `tasks/04-ui-ux-lead.md` |
| 5 | Real-time & Integration Lead | WebSockets, Redis pub/sub, live cursors/comments wiring | `tasks/05-realtime-integration-lead.md` |
| 6 | DevOps & QA Lead | Docker, CI, tests, seed data, deployment, merges | `tasks/06-devops-qa-lead.md` |

Each agent works in its own git branch/worktree, reads the same `AGENTS.md` and
`CONTRACTS.md`, and reports progress in `STATUS.md`. See `docs/GIT_WORKFLOW.md`.

## 5. Quick start for you (the human)

```bash
# 1. Create a real empty GitHub repo, e.g. "codeatlas", then:
git init codeatlas && cd codeatlas
cp -r /path/to/this/kit/* .
git add . && git commit -m "chore: project kit + agent briefs"
git remote add origin git@github.com:<you>/codeatlas.git
git push -u origin main

# 2. Set up 6 isolated worktrees (one per agent) — see docs/GIT_WORKFLOW.md
bash setup_worktrees.sh

# 3. Open 6 terminals, cd into each worktree, run `opencode` in each,
#    and paste the matching prompt from docs/KICKOFF_PROMPTS.md
```

That's it — six sessions, one project, one shared memory: this repo.
