# AGENTS.md — Shared rules for every agent working in this repo

This file is read automatically by OpenCode (and most terminal coding agents)
at the start of a session. If you are an AI agent reading this: **read this
whole file, then read `CONTRACTS.md` and your file in `tasks/`, before writing
any code.**

## Who's working here

Six agents work in this repo in parallel, each on their own git branch/worktree:

1. Backend Lead — `tasks/01-backend-lead.md`
2. AI / Data Lead — `tasks/02-ai-data-lead.md`
3. Frontend Lead — `tasks/03-frontend-lead.md`
4. UI/UX Lead — `tasks/04-ui-ux-lead.md`
5. Real-time & Integration Lead — `tasks/05-realtime-integration-lead.md`
6. DevOps & QA Lead — `tasks/06-devops-qa-lead.md`

You do not talk to the other five directly. You talk to them **through this
repo**: through `CONTRACTS.md` (the shared source of truth for API/data
shapes) and `STATUS.md` (a running log of what's done, what's blocked, what
changed).

## The five rules

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
   branch. Never commit directly to `main`. Never commit secrets, `.env`
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

## Definition of done for a task

- Code runs locally (`docker-compose up` for backend/infra, `npm run dev` for
  frontend).
- Tests exist for the new logic and pass.
- `CONTRACTS.md` is up to date if you exposed or changed anything.
- `STATUS.md` has a fresh entry.
- A PR is opened against `main` (do not merge it yourself — see
  `tasks/06-devops-qa-lead.md` for who does).
