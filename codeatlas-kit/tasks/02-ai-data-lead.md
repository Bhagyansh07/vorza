# Agent 2 — AI / Data Lead

## Mission

Build the part that makes this project more than a CRUD app: the analysis
pipeline that scores a codebase's health, and the LLM-powered PR reviewer
that scores risk and explains it in plain English.

## Build this

1. **Repo analysis pipeline** (`backend/app/services/analysis.py` or similar):
   - Shallow-clone the target repo (or use the GitHub API's tree endpoint —
     no auth token juggling headaches).
   - Walk files, compute per file: `loc`, a complexity proxy (start simple —
     e.g. nesting depth + function count from the AST for Python/JS/TS;
     don't try to support every language on day one), and `churn_score`
     (commits touching that file over the last N months via `git log`).
   - Build an import/dependency edge list for JS/TS and Python files.
   - Roll file scores into a `health_score` per file and an
     `overall_health_score` for the snapshot (simple weighted formula is
     fine — document it in a comment, don't over-engineer).
   - Save as an `AnalysisSnapshot` (Agent 1's model) via the DB session.
2. **AI PR review** (`backend/app/services/ai_review.py`):
   - Take a PR diff (from the webhook payload Agent 1 hands you).
   - Prompt the LLM (pick one provider, Anthropic or OpenAI, and commit to
     it) to return **structured JSON** exactly matching the "AI review
     output shape" in `CONTRACTS.md` — use function calling / JSON mode, not
     hopeful string parsing.
   - Validate the JSON against a schema (Pydantic) before saving/returning
     it. If the LLM returns something malformed, retry once, then fail
     loudly — never silently save garbage.
3. Wire both into the entrypoints Agent 1 stubbed (`/repos/{id}/analyze` and
   the webhook handler).

## Do

- Keep prompts in their own file (`prompts.py`) so they're easy to iterate on.
- Cap how much diff/code you send the LLM per call — truncate sanely, don't
  blow context windows or budgets.
- Write a unit test with a fixture PR diff and a mocked LLM response, so your
  pipeline is testable without burning API calls on every test run.
- Log every LLM call's cost/token usage somewhere you can see it while
  developing.

## Don't

- Don't try to support every programming language's AST on day one — JS/TS +
  Python is enough for the MVP and the demo repo you'll pick.
- Don't call the LLM synchronously inside the webhook request — the webhook
  handler should return fast; do the LLM call in a background task.
- Don't touch `frontend/`, the WebSocket gateway, or Agent 1's auth code.

## Definition of done

- [ ] Given a real small public repo, `/repos/{id}/analyze` produces a
      sensible-looking snapshot (spot-check a few files by eye).
- [ ] Given a sample PR diff, the AI review returns valid JSON matching
      `CONTRACTS.md` every time (including the retry path).
- [ ] Unit tests pass without live network/LLM calls.
- [ ] `STATUS.md` entry: what the analysis output actually looks like, so
      Agent 4 can build the graph against real shapes instead of guesses.

## First 3 steps

1. Get the file-walk + basic metrics working against one local test repo,
   print the results — don't touch the DB yet.
2. Wire it into Agent 1's `AnalysisSnapshot` model and confirm it saves.
3. Build the LLM review call with a hardcoded sample diff, get valid JSON
   back, then log progress in `STATUS.md`.
