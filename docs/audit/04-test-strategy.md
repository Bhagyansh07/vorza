# 04 — Test strategy

Phase 4 of the audit. What the suite actually covers, what it misses, and what to
add next.

**Measured baseline, 2026-10-05:**

| | Count |
|---|---|
| Backend tests | **135 passing** |
| Backend coverage | **77.67%** |
| Frontend tests | 69 passing across 9 files |
| Typecheck | `tsc` 0 errors, `eslint` 0 errors / 4 warnings |
| Lint / format | `ruff check` clean, `ruff format --check` clean |
| mypy | strict clean, 39 files |
| CI jobs | 3 — backend, frontend, docker-build |

---

## The most important thing in this document

**Two real bugs reached `master` during this work and were caught by CI, not by
the tests.** Both are worth recording because they show where the blind spots are.

### Bug 1: the shadow API layer (tested, still shipped)

`features/graph/api/index.ts` computed
`const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false"` — which defaults to
**true** when unset — while the declared variable is `VITE_USE_MOCKS`. Nothing in
the repo set `VITE_USE_MOCK`.

So in production the graph served fixtures: a plausible-looking map of invented
files. No type error. No lint error. No failing test. The suite was green.

Now fixed, with 6 tests including one that asserts `fetch` is never called from
that module.

**Lesson:** a test suite verifies logic. It does not verify that the *wiring* is
correct. "Does this code do the right thing" and "does this code get called with
the real environment" are different questions.

### Bug 2: a flaky test (caught by CI, fixed honestly)

`websocket.test.ts` asserted exact timings against a `Math.random`-jittered retry
delay:

```ts
FakeSocket.instances[1].drop();
vi.advanceTimersByTime(1000);
expect(FakeSocket.instances).toHaveLength(2);   // failed ~30% of the time
```

It passed locally several times, then CI run `37297214178` failed with exactly
this assertion. The second failure of the same kind (`37298765265` was a
different commit; the jitter flake recurred).

Fixed by pinning `Math.random` and asserting the 500/1000/2000 progression
exactly, plus a new test that proves the jitter window is actually applied.
Stable across 3 consecutive local runs and in CI.

**Lesson:** "passed on my machine" is real evidence for logic bugs and no evidence
at all for timing bugs. A test that depends on randomness without controlling it
is a coin flip that happens to land on heads more often locally than in CI.

### Bug 3: a typecheck error I missed

`index.test.ts` passed its own vitest file, and I moved on without re-running
`npm run typecheck`. A bogus `full_name` on a `User` literal reached `master` and
CI went red on `74e4fa3`.

Vitest does not typecheck. `tsc` does. **A single file passing is not the gate.**

---

## Coverage: where the gaps actually are

Backend, by file, worst first:

| File | Coverage | Missing | Why |
|---|---|---|---|
| `services/analysis.py` | **90%** | 83-95, 127, 183, 214-215, 251-264, 341, 370 | **Was 17%.** Now covered by 34 tests; the remaining lines are defensive branches. |
| `services/ai_review.py` | **36%** | 85-89, 96-119, 167-224 | Prompting, parsing, flag extraction. |
| `services/pipeline.py` | **35%** | 63-107 | Repo clone and checkout. Needs a git fixture. |
| `alembic/versions/*` | 25% / 41% | `upgrade` / `downgrade` | Covered by `test_migrations.py` via a subprocess, which coverage does not see. |
| `ws/gateway.py` | partial | — | Authenticated join, rate-limit throttle, comment broadcast |
| `services/github.py` | 49% | 90-115, 150-164, 201-214 | GitHub API client. Needs HTTP fixtures. |
| `services/orchestrator.py` | good | — | Now that it publishes socket events, and tested for them |

18 files are at 100% and skipped by the report.

### The one that matters most

`analysis.py` was the worst gap in the project, because it computes the three
numbers the entire product is built to display:

- cyclomatic complexity
- churn over the last three months
- health score

These have **exactly defined thresholds** (`>= 70` good, `>= 45` warn, else bad)
and **one number wrong means every user sees a wrong colour on a graph.**

**DONE** in `be484fa` — 17% to 90%, and it found two real bugs (below).

---

## Add next, in order

### T1 — Pure-function tests for the scoring — **DONE**, `be484fa`

`analysis.py`'s scoring is pure: source text in, three floats out. No database,
no network, no fixtures. This is the cheapest meaningful test coverage available
and it guards the numbers users actually see.

- Known input → exact score, for complexity and churn separately.
- Boundary cases at exactly 70 and 45, because those are the thresholds.
- Empty file, single-line file, file with only comments.
- A pathological input (very long single line) to pin the behaviour.

Done in `be484fa`: 34 tests, module coverage 17% -> 90%, project total 69.51% ->
**77.67%**.

**It found two production bugs**, both in the import graph, both meaning edges
are silently missing from the graph:

1. `from . import <name>` yielded **no import at all**. Python's AST sets
   `module=None` and `level=1` for that form, so the `and node.module` guard on
   `ast.ImportFrom` was False and the import was dropped.
2. A relative import of a Python *package* resolved to the raw dotted string,
   because `_resolve_relative_import` checked `name.<ext>` and `name/index.<ext>`
   but never `name/__init__.py`. JS packages resolved; Python ones did not.

Both were invisible: no exception, no wrong colour, just a graph quietly missing
a meaningful share of its real dependency edges. This is the argument for T1 in
one concrete instance — the tests were worth writing because the code under them
was wrong, not merely untested.

### T2 — AI review parsing with a recorded model response

`ai_review.py` parses model output. Model output is non-deterministic, so the
test must not call a model. Instead: record several real responses (including a
malformed one and one that refuses) as fixtures and assert the parsing.

Likely to find real bugs, because JSON extraction from prose is exactly where
that code will be fragile.

### T3 — The frontend contract test

Already exists: `backend/tests/test_frontend_contract.py`, 4 tests, asserting the
backend serves the shapes the frontend expects.

**Extend it.** It caught the envelope mismatch (`f768b33`) and should be the thing
that keeps catching contract drift. Every new field in `CONTRACTS.md` should add an
assertion here.

### T4 — End-to-end with Playwright

The suite has no browser test. Every route's behaviour is verified by reading
code, not by driving it.

Scope for a first run:
- `/` renders, `/login` renders, `/dashboard` redirects to `/login` when signed out
- OAuth callback: stub `/auth/github/callback`, land on the dashboard
- Sign in, see a repo, open it, see the graph
- Post a comment, see it appear

Also the only way to verify the accessibility question in `02-design-audit.md`
(D10), which source review cannot settle.

### T5 — axe-core accessibility check

Wire `@axe-core/playwright` into T4 and fail on violations above a threshold.

Start by *reporting* rather than failing — an unknown number of violations should
not turn CI red on first run. Then set the bar once the count is known.

Priority areas: focus order, the graph canvas, comment-pin overlays, contrast.

### T6 — Bundle size budget

Measure, then gate. Current numbers from the last build:

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (the app) | 285.37 kB | 92.21 kB |
| `react-*.js` | 205.74 kB | 65.68 kB |
| `d3-*.js` | 60.22 kB | 20.62 kB |
| `TrendChart-*.js` (recharts, **on demand**) | 360.13 kB | 105.02 kB |

A simple check that fails if any gzip chunk exceeds a budget. This is what makes
the recharts lazy-load (F5 in the roadmap) verifiable rather than hopeful.

### T7 — Lighthouse CI

Run against a preview deployment, assert on performance and SEO scores.

Requires a live URL, so it comes after `docs/MANUAL_STEPS.md` section 3. Note the
free-tier constraint: a Lighthouse run against a Render free service may measure
the cold-start penalty rather than the app.

---

## What the suite is good at

Credit where it is due — these are genuinely solid:

- **The migration-vs-model drift test.** Builds the schema both ways and diffs
  tables, columns, types and nullability. Caught a migration that created
  `analysesnapshot` where SQLModel derives `analysissnapshot`, and a table
  (`aireviewrow`) that was never migrated at all. Both would have broken the first
  managed-database deploy.
- **The WebSocket client: 20 tests.** Join handshake, frame dispatch (wrapped and
  bare), finite-coordinate validation, backoff progression, jitter, teardown that
  cannot reconnect, and recovery from a throwing constructor.
- **The forged-`author_id` socket test.** The gateway overwrites `repo_id` and
  `author_id` server-side; the test proves it.
- **The security pass: 19 tests.** Rate limiting and security headers, verified
  against headers that were first confirmed absent on the live deployment.
- **The auth failure modes: 14 tests.** Every malformed-`sub` shape returns 403,
  not 500.

---

## What is not verified, stated plainly

| Not verified | Why |
|---|---|
| Docker Compose stack | No Docker on this machine. The Dockerfile **is** built by CI. |
| Live end-to-end flow | Needs deployed frontend + backend. Manual steps. |
| Live socket delivery | Client and gateway are both unit-tested; two live browsers needed. |
| Neon connection from Render | URL normalisation verified with four real Neon URL shapes; a real connection needs real accounts. |
| Accessibility | No automated axe run. Source review only. |
| Scoring correctness | Much improved: `analysis.py` 17% -> 90%. See T1. |
| Search indexing | Takes weeks. |
| Performance under load | Never measured. The free tier is not a load target. |

---

## Rules I would hold to

1. **A test that depends on randomness must control it.** Pin `Math.random`, or
   inject the clock.
2. **A test that runs a subprocess does not contribute to coverage.** The
   migration test genuinely executes `alembic upgrade head`, and coverage does not
   see it. Not a reason to delete it — a reason to know what the number means.
3. **Never lower a gate to go green.** The coverage gate stayed at 60% while the
   measured value moved 62% -> 69.51% -> 77.67%. It was never raised to a number
   the suite did not earn, and it will not be lowered to a number it does not
   reach. Note what the rising number cost: the 60% bar was not raised even at
   77%, because raising it would add a second thing to fail and teach nothing.
4. **Typecheck and lint are part of the gate, not a separate concern.** Vitest
   passing tells you nothing about types.
5. **The production environment must be tested.** Bug 1 shipped a green suite. At
   minimum, assert that the mock flag resolves the way production will resolve it.
6. **Prefer the test that pins a bug.** Every fix in this work added a test
   that fails against the old code. `test_snapshot_table_matches_the_model_name`
   exists because that bug shipped once.