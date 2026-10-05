# AGENTS.md — Shared rules for every agent working in this repo

This file is read automatically by OpenCode (and most terminal coding agents)
at the start of a session. If you are an AI agent reading this: **read this
whole file, then read `brain/00_MASTER_RULES.md`, `CONTRACTS.md`, and your file
in `tasks/`, before writing any code.**

## Project Constitution: The BRAIN System

**`brain/` is the single source of truth.** It contains the persistent memory,
constitution, and specifications for CodeAtlas. Every agent MUST follow the
protocol in `brain/00_MASTER_RULES.md`:

1. Read `brain/00_MASTER_RULES.md` fully
2. Skim `brain/01_PRD.md` and `brain/02_TRD.md` for scope
3. Open `brain/15_MICROTASKS.md` — find next `TODO`/`IN_PROGRESS` task
4. Check `brain/16_CHANGELOG.md` last 5 entries
5. Follow the loop in `brain/18_AI_AGENT_LOOP.md`

**File authority (highest → lowest):**
`00_MASTER_RULES.md` > `10_SECURITY.md` > `02_TRD.md` > `01_PRD.md` >
`03_ARCHITECTURE.md` > everything else.

## Who's working here

Six agents work in this repo in parallel, each on their own git branch/worktree:

1. Backend Lead — `tasks/01-backend-lead.md`
2. AI / Data Lead — `tasks/02-ai-data-lead.md`
3. Frontend Lead — `tasks/03-frontend-lead.md`
4. UI/UX Lead — `tasks/04-ui-ux-lead.md`
5. Real-time & Integration Lead — `tasks/05-realtime-integration-lead.md`
6. DevOps & QA Lead — `tasks/06-devops-qa-lead.md`

**You do not talk to the other five directly.** You coordinate **through this
repo** using three mechanisms:

| Mechanism | Purpose | Location |
|-----------|---------|----------|
| **BRAIN specs** | Product/tech requirements, tasks, decisions | `brain/` (read-only for agents, write via PR) |
| **CONTRACTS.md** | Live API/data shapes, WebSocket events | Repo root (write when you own/change a contract) |
| **STATUS.md** | Running log: done, blocked, needs, changed | Repo root (append after every meaningful chunk) |

## The Five Rules

1. **Stay in your lane.** Only edit files inside the folder(s) your task file
   assigns you. If you need something from another agent's area (a new field,
   a new endpoint), propose the change in `CONTRACTS.md` and log it in
   `STATUS.md` — don't just go edit their code.
2. **The contract is law until changed on purpose.** If `CONTRACTS.md` says an
   endpoint returns `{id, name, health_score}`, build against exactly that.
   If you must change a contract, edit `CONTRACTS.md` in the same commit,
   explain why in `STATUS.md`, and assume someone else already built against
   the old shape.
3. **Log before you stop.** At the end of every meaningful chunk of work,
   append an entry to `STATUS.md`: what you built, what you exposed, what
   you're blocked on, what you need from someone else. Never end a session
   silently.
4. **Small commits, your branch only.** Commit early and often on your own
   branch. Never commit directly to the default branch. Never commit secrets, `.env`
   files, `node_modules/`, or `__pycache__/`.
5. **Working code over clever code.** Ship the smallest thing that satisfies
   your task file's checklist before adding anything extra. Scope creep from
   one agent blocks the other five.

## Conventions

- Python: type hints everywhere, format with `ruff`/`black`, tests with `pytest`.
- TypeScript: strict mode, format with `prettier`/`eslint`, tests with `vitest`.
- Commit messages: `<area>: <short description>` e.g. `backend: add repo model`.
- Every new API endpoint gets added to `CONTRACTS.md` in the same PR.
- Never invent your own auth system — see `docs/REFERENCE_REPOS.md`.
- Never hardcode API keys or secrets — use `.env` + `.env.example`.
- Follow `brain/19_CODING_STANDARDS.md` for naming, formatting, folder placement.

## Definition of Done for a Task

- Code runs locally (`docker-compose up` for backend/infra, `npm run dev` for frontend).
- Tests exist for the new logic and pass (see `brain/13_TESTING.md`).
- `CONTRACTS.md` is up to date if you exposed or changed anything.
- `STATUS.md` has a fresh entry.
- `brain/16_CHANGELOG.md` updated under "Unreleased".
- Any new architectural/product decision logged in `brain/17_DECISIONS.md`.
- A PR is opened against `master` (do not merge it yourself — see
  `tasks/06-devops-qa-lead.md` for who does).

## How Agents Communicate (The Protocol)

```
┌─────────────┐     CONTRACTS.md      ┌─────────────┐
│  Agent A    │ ◄──────────────────►  │  Agent B    │
│ (producer)  │   API shapes, events  │ (consumer)  │
└─────────────┘                       └─────────────┘
       │                                    │
       │ STATUS.md                          │ STATUS.md
       ▼                                    ▼
┌─────────────────────────────────────────────────────┐
│                  SHARED REPO                        │
│  brain/ (specs)  │  CONTRACTS.md  │  STATUS.md     │
└─────────────────────────────────────────────────────┘
       │                                    │
       ▼                                    ▼
┌─────────────┐     Git PRs + Reviews     ┌─────────────┐
│  Agent C    │ ◄──────────────────────►  │  Agent 6    │
│ (any)       │     (DevOps merges)       │ (DevOps/QA) │
└─────────────┘                           └─────────────┘
```

**Step-by-step example — Agent 1 needs a new field from Agent 2:**

1. Agent 1 edits `CONTRACTS.md` → adds `risk_score` to `AnalysisSnapshot`
2. Agent 1 appends to `STATUS.md`: `"Added risk_score to AnalysisSnapshot contract. Need Agent 2 to populate it."`
3. Agent 2 reads `STATUS.md` → sees the request
4. Agent 2 implements the field in their service, updates `CONTRACTS.md` if shape changed
5. Agent 2 appends to `STATUS.md`: `"Populated risk_score in AnalysisSnapshot. Ready for consumers."`
6. Agent 3/4/5 read `STATUS.md` → know the field is ready, start using it

**No direct messages. No shared memory outside these files.** This is by design —
it creates a durable, auditable trail that any agent (or human) can read later.

## BRAIN Integration Notes for Agents

- `brain/15_MICROTASKS.md` breaks the project into small, ordered tasks. Claim one by changing status to `IN_PROGRESS` with your agent name.
- When you complete a task, mark it `DONE` in `MICROTASKS.md`, add entry to `brain/16_CHANGELOG.md`, and log any decisions in `brain/17_DECISIONS.md`.
- If a task requires a contract change, update `CONTRACTS.md` in the same commit.
- If specs in `brain/` are missing something you need, add a `[NEEDS INPUT]` placeholder in `STATUS.md` and stop — don't guess.
- Security (`brain/10_SECURITY.md`) and error handling (`brain/09_ERROR_HANDLING.md`) are mandatory, not optional.