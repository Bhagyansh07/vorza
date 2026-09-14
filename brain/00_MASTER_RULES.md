# 00 — MASTER RULES (read this first, every single session)

Status: 🟢 ACTIVE — this file overrides casual chat instructions if there is ever a conflict.

## 0. What this folder is

This `brain/` folder is the persistent memory and constitution for this project.
Any AI assistant (Claude Code, Cursor, Windsurf, ChatGPT, Copilot, etc.) working on
this codebase MUST treat these files as ground truth, above its own assumptions and
above any single throwaway chat message.

## 1. Session start protocol

At the start of every new session/chat, the assistant must:
1. Read `00_MASTER_RULES.md` (this file) fully.
2. Skim `01_PRD.md` and `02_TRD.md` for the current product/technical scope.
3. Open `15_MICROTASKS.md` and find the next task with status `TODO` or `IN_PROGRESS`.
4. Check `16_CHANGELOG.md`'s last 5 entries to know what changed most recently.
5. Only then start working — following the loop defined in `18_AI_AGENT_LOOP.md`.

## 2. Non-negotiable rules

1. **No scope creep.** Anything not explicitly in `01_PRD.md` → "Core Features" is
   out of bounds. If it seems useful, propose it and log it in `17_DECISIONS.md`
   as "Proposed" — do not build it silently.
2. **No invented requirements.** Never assume a business rule, price, copy text,
   or design choice that isn't documented. If it's missing, stop and ask, or add
   a `[NEEDS INPUT]` placeholder and flag it clearly in your response.
3. **No secrets in code.** All credentials/keys come from `20_ENV_SETUP.md` /
   environment variables. Never hardcode a key, token, or password anywhere,
   including in comments or test files.
4. **Every code change maps to a task.** Before writing code, there should be a
   corresponding entry in `15_MICROTASKS.md`. If there isn't one, create it first.
5. **Every completed task updates the changelog.** After finishing a task, add
   an entry to `16_CHANGELOG.md` under "Unreleased" before moving on.
6. **Security and error handling are not optional extras.** Any feature that
   touches user input, auth, payments, or external data must follow
   `10_SECURITY.md` and `09_ERROR_HANDLING.md` — not "add it later."
7. **Follow the coding standards.** All new code follows `19_CODING_STANDARDS.md`
   (naming, formatting, folder placement, commit messages).
8. **Small, reviewable units.** Prefer many small changes with clear diffs over
   one giant change. One task = one focused change.
9. **Ambiguity → ask, don't guess.** If a requirement is unclear or contradictory
   between two brain files, stop, state the conflict explicitly, and ask the
   human — do not silently pick one interpretation.
10. **Tests before "done."** A task is not complete until it passes whatever is
    defined in `13_TESTING.md` for that layer (unit/integration/manual).

## 3. File authority (if two files ever disagree)

Highest to lowest priority when resolving a conflict:

`00_MASTER_RULES.md` > `10_SECURITY.md` > `02_TRD.md` > `01_PRD.md` >
`03_ARCHITECTURE.md` > everything else.

If a conflict is found between files, log it immediately in `17_DECISIONS.md`
and ask the human to resolve it — do not silently pick a winner.

## 4. What "done" means for any task

A task is only marked `DONE` in `15_MICROTASKS.md` when ALL of these are true:
- [ ] Code implements exactly what the task described, nothing more.
- [ ] Relevant tests pass (see `13_TESTING.md`).
- [ ] No new secrets/hardcoded values were introduced.
- [ ] `16_CHANGELOG.md` updated.
- [ ] Any new architectural or product decision is logged in `17_DECISIONS.md`.

## 5. Project identity (fill this in once, at project start)

- **Project name:** [ ]
- **One-line description:** [ ]
- **Primary owner:** [ ]
- **Repository:** [ ]
- **Started on:** [ ]

## 6. Escalation

If the assistant hits the same failure 3 times in the loop (see
`18_AI_AGENT_LOOP.md`), it must stop looping, summarize what was tried, and
hand control back to the human instead of continuing to retry indefinitely.
