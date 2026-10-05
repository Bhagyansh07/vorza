# 06 — Audit summary

Every phase, what it found, what it fixed, what it deliberately did not, and the
three things that matter most.

---

## Phase status

| Phase | Deliverable | Status |
|---|---|---|
| 0 recon | `00-recon.md` | **done** |
| 1 code audit | `01-code-audit.md` | **done** — 30 findings |
| 2 design audit | `02-design-audit.md` | **done** — 10 findings |
| 3 roadmap | `03-feature-roadmap.md` | **done** |
| 4 SEO | `seo: give the app an indexable page…` | **done** |
| 5 test strategy | `04-test-strategy.md` | **done** |
| 6 deploy + docs | `05-deploy-verify.md`, `render.yaml`, `vercel.json` | **partial** — config done, deploy blocked on account access |

---

## The three findings that mattered

### 1. The app was undeployable to a managed database, and nothing in the suite said so

`alembic upgrade head` against an empty database produced:

- `analysesnapshot` — while SQLModel derives `analysissnapshot` from the class
  name `AnalysisSnapshot`. Every snapshot read would hit
  `no such table: analysississnapshot`.
- no `aireviewrow` at all, so every PR review insert would fail.

Both were invisible because the lifespan called
`SQLModel.metadata.create_all(engine)` unconditionally, which creates tables under
the *models'* names and papered over the wrong one.

Found by building the schema both ways and diffing them — not by reading the
migration. Verified against revision `0001` directly: both tables absent.

Fixed by `0002` plus `app/core/schema.py`, which now hands control to Alembic when
a revision is stamped instead of letting `create_all` mask a missing migration.
`tests/test_migrations.py` fails CI if the two ever drift again.

**Why this is first:** the previous deploy was the last thing standing between
this and a working hosted deployment. Without this fix, adding a database would
have looked like a configuration step and instead produced a mystery
`no such table` in production.

### 2. Production served mock data, behind a plausible-looking UI

`features/graph/api/index.ts` computed:

```ts
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
```

`!== "false"` is `true` when the variable is **unset** — and the declared variable
is `VITE_USE_MOCKS` (with an S). Nothing set `VITE_USE_MOCK`. So the graph layer
defaulted to mocks in production and served a map of invented files.

The same file also had `API_BASE = ""` (so calls went to the frontend origin, not
the backend), no `Authorization` header, no envelope unwrapping, and it invented
comment `id`/`author_id`/`created_at` client-side.

No type error. No lint error. No failing test. **The suite was green.**

Fixed by delegating to the shared authenticated client — one API layer instead of
three — with 6 tests including one asserting `fetch` is never called from that
module.

**Why this matters beyond the bug:** it is the clearest evidence in this audit that
a passing test suite verifies logic, not wiring. "Does this code do the right
thing" and "does this code get called with the real environment" are different
questions and only one of them is testable in isolation.

### 3. The frontend deployment no longer exists

Both recorded Vercel hostnames return 404. This resolves the stale-hostname
ambiguity from `00-recon.md:217` — not by picking the right one, but by showing
neither is live.

The backend is live but running old code: its `/openapi.json` still describes
`/repos/{id}/analyze` as a logging stub, so Render has not redeployed recent
`master` and the security headers and rate limiting are **not yet in production**.

---

## Numbers

All measured on 2026-10-05, at `2ee4816`. Baselines are quoted from
`00-recon.md:166-168` and `01-code-audit.md:40-42`, which recorded them at the
time — where no baseline was measured, the row says so rather than guessing.

| | Before this work | After |
|---|---|---|
| Backend tests | **not measured** — see note | **135 passing** |
| Backend coverage | **could not run** (`pytest-cov` not a declared dependency) | **77.67%** |
| Frontend tests | 26 across 6 files | **69 across 9 files** |
| mypy (strict) | **47 errors in 17 files** | **0** (39 files checked) |
| `ruff check` | **66 errors**, 50 auto-fixable | **clean** |
| `ruff format --check` | **36 files** unformatted | **clean** |
| `tsc` | 0 errors | **0** |
| eslint | 0 errors | **0 errors**, 4 pre-existing warnings |
| CI on `master` | **red on 10/10 runs** | **3 jobs green** |
| Indexable pages | **0** | **2** |
| Coverage gate | 60%, never executed | 60%, passing at 77.67% |
| Commits in this pass | — | **8**, plus this documentation pass |

**Note on the backend test baseline.** There is no honest "before" number for
backend tests or coverage, because `pytest-cov` was not a declared dependency and
the CI coverage step could not execute at all. The README *claimed* 23 tests;
that was never verified until the install was fixed. The first real measurement
after that fix was **62.01%**, then 70.38%, then 69.51% after the migration and
schema-bootstrap code was added, and now **77.67%** after the analysis-scoring
tests. The gate was never lowered — see
`docs/audit/04-test-strategy.md` rule 3.

Bundle, unchanged by this work except for the landing page:

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (the app) | 285.37 kB | 92.21 kB |
| `react-*.js` | 205.74 kB | 65.68 kB |
| `d3-*.js` | 60.22 kB | 20.62 kB |
| `TrendChart-*.js` (recharts, **on demand**) | 360.13 kB | 105.02 kB |

---

## Findings by severity

| Severity | Found | Fixed | Deferred |
|---|---|---|---|
| Critical | 2 | **2** | 0 |
| High | 9 | **7** | 2 (auth provider migration, multi-repo analysis) |
| Medium | 10 | **7** | 3 (`npm audit` vulns, tracked `.env.production`, chart bundle) |
| Low | 9 | 0 | 9 |
| Design | 10 | **5** | 5 |
| SEO | — | **all** | 0 |

### Critical

| ID | Finding | Fix |
|---|---|---|
| C1 | Hardcoded `GITHUB_WEBHOOK_SECRET` fallback — anyone who read the repo could forge a signed webhook and queue PR reviews | Removed. Unset means the receiver is **fail-closed** (503), not fail-open. 7 tests. Chosen over fail-fast so the user's live Render deploy would not break. |
| C2 | `openai` was a dev dependency, but `Dockerfile:13` runs `pip install --no-cache-dir .` — **main deps only**. So the AI review path would not exist in the image. | Moved to main. Orchestrator skips review with an explicit warning when no key is set. |

### High — fixed

| ID | Finding | Fix |
|---|---|---|
| H1 | Ruff debt across the backend; `format --check` failing | Cleared. |
| H2/H3 | CI installed dev tools with `.[dev]`, which resolves to a non-existent extra — so ruff, pytest and mypy were never installed, and CI was failing for the wrong reason | `pip install -e . --group dev` (PEP 735). Added `pytest-cov`. |
| H4 | 12 design tokens referenced but never defined; `colors.panel` silently killed `shadow-panel` | All defined. `colors.panel` removed. Accent retuned to cyan. |
| H5 | The shadow API layer above | One authenticated client. |
| H6/H7 | No security headers, no rate limiting | Hand-rolled in `core/rate_limit.py` rather than adding `slowapi`. 19 tests. Verified absent on the live deploy first. |
| H8 | Envelope mismatch — the frontend read `AnalysisSnapshot[]` where the backend served `{data, count}` | `ListEnvelope<T>`, unwrapped once in `http-client.ts`. Fixtures rewritten. Cross-language contract test added. |

### High — deferred

| ID | Finding | Why deferred |
|---|---|---|
| — | Auth is in-house JWT via GitHub OAuth, not a provider | Works and is small. Swapping it is a rewrite of the login surface for no current gain. |
| — | Analysis is sequential per repo, not concurrent | Correct at this scale. Revisit if a large repo takes minutes. |

### Medium — fixed

`uuid.UUID(token_data.sub)` returned 500 instead of 403, and had two distinct
triggers (`sub: "not-a-uuid"` → `ValueError`; no `sub` claim → `TypeError`). The
except clause was too narrow in both cases. 14 tests.

Also fixed: mypy surfaced two live bugs it had been hiding — `pipeline.py:66-67`
missing `cwd`, and `ws/manager.py:111,114` referencing a non-existent
`self._throttle_for`.

### Low — worked through, 9 of 9 closed or explained

Names and docstrings, so each was re-examined rather than blindly edited:

| ID | Outcome |
|---|---|
| L1 | **Fixed.** README rewritten in `e4a946b`. |
| L2 | **Deliberately not fixed.** Filling `brain/*.md` means inventing requirements nobody stated. An empty template is honest; a fabricated PRD is a trap for the next agent. The roadmap derives from the code instead. |
| L3 | **Blocked** on GitHub account access. Exact description and topic text written out in `SEO_BACKLINKS.md` 4.1. |
| L4 | **Partial.** `.gitignore` is clean. Old `STATUS.md` entries keep their mojibake — they are a historical record, and rewriting the log of what was actually written would be the dishonest fix. |
| L5 | **Fixed.** Five docs plus the workflow snippets in `brain/12`, which had `branches: [main]` in two places while the real CI workflow used `master`. |
| L6 | **Not a defect.** `_pure_analyze` is a *local alias* distinguishing the pure core from the orchestrator's own `analyze_repo`. Renaming it would misread the most important line in the file. |
| L7 | **Already gone.** Path does not exist; the finding was stale. |
| L8 | **Already gone.** Zero grep matches for `DEFAULT_USERNAMES`. |
| L9 | **Partial, and the honest half matters.** The OAuth `state` docstring claimed "single-use"; it is neither single-use nor time-boxed. Corrected to state exactly what is enforced. The real fix needs spent-nonce storage and is filed as roadmap **F11** rather than half-done. |

Worth recording: two of the nine were **not defects at all**, and one was **not
fixable as recommended** (L2's original advice was "fill PRD or delete the
fiction" — deleting would have destroyed the repo's stated constitution, and
filling would have invented it). An audit that only records fixes hides the fact
that its own findings needed re-examination.

---

## What I got wrong

Recording it because the corrections are the useful part.

| Mistake | How it was caught |
|---|---|
| **Recommended Render's free Postgres**, calling it a 30-day-inactivity clock to be kept alive by a weekly ping. It actually expires **30 days after creation**, and a ping does not reset it. | Checked vendor docs instead of trusting memory, after writing the claim down. Corrected in `2ee4816`. |
| **Missed a typecheck error** by running only the one test file I had just written, not the full gate. Reached `master`, CI went red. | CI, on `74e4fa3`. |
| **Claimed a "verified green" gate** after the shadow-API commit without re-running `typecheck`. | Re-running the full gate later. |
| Wrote a genuinely broken Vite plugin on the first attempt (a self-recursive `configResolved`), then rewrote it. | Immediate — it would not have run. |
| Two WebSocket backoff tests asserted exact timings against `Math.random`. | CI, run `37297214178`, after they had passed locally several times. |
| Broke a `multi-line` edit by rewriting a file through PowerShell `.Replace()`, which mixed CRLF and LF. | The edit tool failing to match. Worked around with Python heredocs. |

---

## What is NOT verified

| Not verified | Why |
|---|---|
| The live deploy after these changes | Applying a blueprint and setting secrets needs your accounts |
| Data survives a backend restart | Can only be confirmed on a live deploy. This is the bug the whole phase targeted. |
| Live WebSocket delivery | Client and gateway are both unit-tested; two live browsers needed |
| Neon connection from Render | URL normalisation verified with four real Neon URL shapes; a real connection needs real accounts |
| Docker Compose stack | No Docker on this machine. The Dockerfile **is** built by CI on every push. |
| Scoring correctness | **Much improved** — `analysis.py` 17% -> 90%, 34 tests. Still no recorded-model-response test for `ai_review.py`. |
| Bundle size | `recharts` off first paint (103.75 kB gzip), verified against built output. No CI byte budget yet — T6. |
| Accessibility | No axe run. Source review only. `04-test-strategy.md` T5. |
| Search indexing | Takes weeks. Cannot be forced. |
| Keyword search volume | Needs a Keyword Planner account |
| Performance under load | Never measured. The free tier is not a load target. |

---

## If you only read one thing

**Done: `services/analysis.py` now has 90% coverage and the two import bugs
behind it are fixed** (`be484fa`).

It was the one item here that could produce a *silent wrong answer* rather than a
visible failure, which is exactly why it was worth doing before anything else. It
paid for itself immediately — the tests found that `from . import <name>` produced
no import at all, and that a relative import of a Python package never resolved to
its `__init__.py`. Both mean **edges missing from the graph**: the product renders,
looks plausible, and is quietly wrong. Nothing in the suite would ever have said so.

The next target is the same shape of problem: `services/ai_review.py` at 36%,
which parses model output. Non-deterministic model responses mean the test must
use recorded fixtures rather than a live call, and JSON extraction out of prose is
exactly where that code will be fragile.