# 18 — AI Agent Loop (Looping Engineering Workflow)

Status: 🟢 ACTIVE — this is the step-by-step loop the AI assistant follows for
EVERY task, from the smallest fix to a full feature. It exists so the AI
behaves like a disciplined engineer doing iterative work, not like it's
guessing in one giant leap.

## The Loop

```
        ┌─────────────────────────────────────────────┐
        │                                               │
        ▼                                               │
 1. LOAD CONTEXT                                        │
    Read 00_MASTER_RULES + relevant spec files          │
        │                                               │
        ▼                                               │
 2. PICK ONE TASK                                        │
    From 15_MICROTASKS.md (or create it first)          │
        │                                               │
        ▼                                               │
 3. PLAN                                                 │
    Write a short plan: files to touch, approach,       │
    edge cases, which spec file governs this             │
        │                                               │
        ▼                                               │
 4. IMPLEMENT SMALLEST UNIT                              │
    Write the smallest piece of code that makes          │
    progress and can be verified                         │
        │                                               │
        ▼                                               │
 5. VERIFY                                               │
    Run lint / tests / manual check (13_TESTING.md)      │
        │                                               │
        ├── FAIL ──► 6. DIAGNOSE & FIX ──► back to 4 ────┘
        │            (max 3 loops, see below)
        ▼ PASS
 7. SELF-REVIEW AGAINST RULES
    Re-check against 00_MASTER_RULES.md,
    10_SECURITY.md, 19_CODING_STANDARDS.md
        │
        ▼
 8. DOCUMENT
    Update 16_CHANGELOG.md, mark task DONE in
    15_MICROTASKS.md, log any new decision in
    17_DECISIONS.md
        │
        ▼
 9. NEXT TASK ──► back to step 2
```

## Step-by-step Rules

1. **Load context.** Never start coding cold. Re-read `00_MASTER_RULES.md` and
   whichever spec file(s) govern the current task (e.g. `07_API_CONTRACT.md`
   for an endpoint, `08_UI_SPEC.md` for a screen).
2. **Pick one task.** Work on exactly one item from `15_MICROTASKS.md` at a
   time. If the task is too big to finish in one focused pass, split it into
   sub-tasks first and log the split.
3. **Plan before coding.** State in 2-5 bullet points what you're about to do
   and why, and which files will be touched. This catches misunderstandings
   before any code is written.
4. **Implement the smallest verifiable unit.** Don't build five features at
   once. Build the smallest slice that can be tested, then move forward.
5. **Verify immediately.** Run the relevant tests/lints/build after every
   meaningful change — don't stack up ten changes before checking anything.
6. **Retry limit (anti-infinite-loop guardrail).** If step 5 fails, diagnose
   and fix, then re-verify. If the same task fails **3 times in a row**, stop.
   Summarize: what was tried, what failed, and what you think the blocker is.
   Hand back to the human instead of continuing to guess — log it under
   "Blocked Tasks" in `15_MICROTASKS.md`.
7. **Self-review against the rulebook**, not just "does it run." Specifically
   re-check security (`10_SECURITY.md`), scope (`01_PRD.md` Out of Scope), and
   style (`19_CODING_STANDARDS.md`) before calling it done.
8. **Document immediately, not later.** Update the changelog and task status
   as part of finishing the task, not as a separate "cleanup pass" you might
   skip. Any decision made along the way (a library choice, a schema tweak)
   gets logged in `17_DECISIONS.md` right away, while the reasoning is fresh.
9. **Move to the next task** only after the current one is fully documented.

## Context-Window / Long-Session Hygiene

- When a session is getting long, proactively summarize progress into
  `16_CHANGELOG.md` and `15_MICROTASKS.md` so a *fresh* session (or a
  different AI tool) can resume with zero prior chat history and still have
  full context — the brain folder is the memory, not the chat log.
- Prefer several short focused sessions (one per task or small task group)
  over one marathon session covering unrelated tasks.

## Human-in-the-Loop Checkpoints

Always pause and ask the human before proceeding, even mid-loop, when:

- A requirement is ambiguous or missing from the brain files.
- A task would touch `10_SECURITY.md`-governed code (auth, payments, PII) in
  a way not already fully specified.
- A task would require adding a new third-party dependency not listed in
  `02_TRD.md`.
- The retry limit in rule 6 above is hit.
