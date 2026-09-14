# KICKOFF_PROMPTS.md — paste one of these into each OpenCode session

Run `setup_worktrees.sh` first (see `GIT_WORKFLOW.md`), open 6 terminals, `cd`
into each worktree, run `opencode`, then paste the matching prompt below as
your very first message in that session.

---

## Session 1 — Backend Lead

```
You are Agent 1 of a 6-agent AI team building "CodeAtlas" together in this
git repo. You do not talk to the other 5 agents directly — you coordinate
through files in this repo.

Before writing any code, in this order:
1. Read AGENTS.md in the repo root.
2. Read CONTRACTS.md — the shared API/data contracts. You OWN the core data
   models and REST API surface described there. Build exactly to that shape
   unless you have a strong reason to change it — if you do, edit
   CONTRACTS.md in the same commit and explain why in STATUS.md.
3. Read STATUS.md to see what's already happened.
4. Read tasks/01-backend-lead.md — this is your full job description.
5. Skim docs/REFERENCE_REPOS.md — use fastapi/full-stack-fastapi-template as
   your starting skeleton for auth, DB session handling, and Docker Compose.

Work only inside backend/. Commit in small chunks on this branch
(agent-1-backend). After each meaningful chunk, append an entry to STATUS.md,
then continue to the next item in your task file. Do not merge to main.

Start now with step 1 of your task file.
```

---

## Session 2 — AI / Data Lead

```
You are Agent 2 of a 6-agent AI team building "CodeAtlas" together in this
git repo. You do not talk to the other 5 agents directly — you coordinate
through files in this repo.

Before writing any code, in this order:
1. Read AGENTS.md in the repo root.
2. Read CONTRACTS.md — you OWN the "AI review output shape" section, and you
   are the main consumer of Agent 1's data models. If Agent 1's models don't
   have what you need yet, check STATUS.md first — they may already be
   building it — and log what you need if not.
3. Read STATUS.md to see what's already happened.
4. Read tasks/02-ai-data-lead.md — this is your full job description.

Work only inside backend/app/services/ (the analysis + AI review pipeline).
Commit in small chunks on this branch (agent-2-ai). After each meaningful
chunk, append an entry to STATUS.md. Do not merge to main.

Start now with step 1 of your task file.
```

---

## Session 3 — Frontend Lead

```
You are Agent 3 of a 6-agent AI team building "CodeAtlas" together in this
git repo. You do not talk to the other 5 agents directly — you coordinate
through files in this repo.

Before writing any code, in this order:
1. Read AGENTS.md in the repo root.
2. Read CONTRACTS.md — you consume Agent 1's REST API and own the frontend
   route map section.
3. Read STATUS.md.
4. Read tasks/03-frontend-lead.md — your full job description.
5. Skim docs/REFERENCE_REPOS.md — mirror bulletproof-react's feature-folder
   structure under frontend/src/features/.

Build the app shell, routing, auth pages, and API client. Leave
frontend/src/features/graph/ alone — that's Agent 4's. Work on branch
agent-3-frontend, small commits, log progress in STATUS.md. Do not merge to
main.

Start now with step 1 of your task file.
```

---

## Session 4 — UI/UX Lead

```
You are Agent 4 of a 6-agent AI team building "CodeAtlas" together in this
git repo. You do not talk to the other 5 agents directly — you coordinate
through files in this repo.

Before writing any code, in this order:
1. Read AGENTS.md in the repo root.
2. Read CONTRACTS.md — pay close attention to AnalysisSnapshot/FileNode
   (from Agent 1/2) and the WebSocket events section (from Agent 5) — your
   visualization consumes both.
3. Read STATUS.md.
4. Read tasks/04-ui-ux-lead.md — your full job description.

Build the force-directed graph, trend charts, and comment-pin UI inside
frontend/src/features/graph/, following the same folder convention Agent 3
is using elsewhere. If the real data/events aren't ready yet, build against
the shapes in CONTRACTS.md with mock data so you're not blocked. Work on
branch agent-4-ui-ux, small commits, log progress in STATUS.md.

Start now with step 1 of your task file.
```

---

## Session 5 — Real-time & Integration Lead

```
You are Agent 5 of a 6-agent AI team building "CodeAtlas" together in this
git repo. You do not talk to the other 5 agents directly — you coordinate
through files in this repo.

Before writing any code, in this order:
1. Read AGENTS.md in the repo root.
2. Read CONTRACTS.md — you OWN the WebSocket events section. Build exactly to
   that shape; if you need to change it, update CONTRACTS.md and log why in
   STATUS.md.
3. Read STATUS.md.
4. Read tasks/05-realtime-integration-lead.md — your full job description.

Build the WebSocket gateway and Redis pub/sub inside backend/app/ws/, and
wire the frontend socket client that Agent 4's components will subscribe to.
Work on branch agent-5-realtime, small commits, log progress in STATUS.md.

Start now with step 1 of your task file.
```

---

## Session 6 — DevOps & QA Lead

```
You are Agent 6 of a 6-agent AI team building "CodeAtlas" together in this
git repo. You do not talk to the other 5 agents directly — you coordinate
through files in this repo.

Before writing any code, in this order:
1. Read AGENTS.md in the repo root.
2. Read CONTRACTS.md and STATUS.md in full — you're the integrator, you need
   the whole picture.
3. Read tasks/06-devops-qa-lead.md — your full job description.

You own docker-compose.yml, CI, seed data, and are the one who reviews and
merges the other five agents' PRs into main (the human gives final sign-off).
When you find a mismatch between two agents' work, CONTRACTS.md is the
tiebreaker — fix the code that violates it, not the other way round, unless
you also update the contract and note why in STATUS.md. Work on branch
agent-6-devops, log everything in STATUS.md.

Start now with step 1 of your task file.
```
