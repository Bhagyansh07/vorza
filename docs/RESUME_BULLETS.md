# Resume bullets

Derived from `docs/audit/06-summary.md`. Every bullet here is backed by a commit
you can be asked to open, and the ones that are not finished are labelled rather
than dressed up.

**Rules I held to while writing these:** no metric I did not measure, no claim
that something is deployed that isn't, and no "led" or "owned" for work that was
mostly reading carefully.

---

## The headline

> **Audited and hardened a full-stack code-visualisation product (FastAPI +
> SQLModel + Postgres + React/TS + D3/WebSockets), turning a repo whose CI had
> been red on 10 of its last 10 runs into one with 3 green jobs, 170 passing
> tests, 69.5% coverage, and a deployment that no longer loses data on restart.**

Two claims worth defending if challenged:

- **"10 of 10 runs red"** — from `docs/audit/00-recon.md:201-202`, recorded
  before any change. The backend job failed at `Lint (ruff)`.
- **"170 passing tests"** — 101 backend + 69 frontend, measured at `2ee4816`.
  There is no honest baseline count: `pytest-cov` was not a declared dependency,
  so the coverage step could not run at all. Say that rather than inventing a
  "before" number.

---

## Bullets, strongest first

### 1 · Found two bugs that would have broken the first production deploy

> Found and fixed two migration defects by diffing the SQLModel-generated schema
> against the Alembic history: a table created as `analysesnapshot` where the ORM
> derives `analysissnapshot`, and an entire model (`AiReviewRow`) never migrated.
> Both were masked by an unconditional `create_all` in the app lifespan, so the
> suite was green and a managed database would have failed on the first snapshot
> read.

**If asked how you found it:** built the schema both ways — `create_all` against
the models, and `alembic upgrade head` — then diffed tables, columns, types and
nullability. Verified against revision `0001` directly: both tables absent. Not
found by reading the migration, which looks fine.

**If asked about the fix:** added revision `0002` rather than editing `0001`, so
it is correct for a fresh database *and* for any database a stray `create_all`
had already half-fixed. Then made `create_all` stop masking missing migrations: a
stamped database is now left entirely to Alembic. The regression test builds the
schema both ways in CI.

**Commits:** `b5c314c`, `3f02a8d`, `1ac206c`.

### 2 · Caught production serving mock data while CI was green

> Traced a hardcoded mock flag through the frontend and found the graph was
> falling back to fixtures in production: the check was `VITE_USE_MOCK !== "false"`
> — which is `true` when unset — on a variable name nothing in the repo set, while
> the declared variable was `VITE_USE_MOCKS`. Production rendered a plausible map
> of invented repositories. No type error, no lint error, no failing test.

**If asked what you did:** collapsed three divergent API layers into one
authenticated client that handles auth, envelope unwrapping and error mapping,
and added a test asserting `fetch` is never called from the old module — so the
layer cannot quietly come back.

**The follow-up is the interesting part**, and it is worth saying aloud: this
proved a passing suite verifies *logic*, not *wiring*. "Does this code do the
right thing" and "does this code get called with the real environment" are
different questions, and only the second one shipped broken. It is now the first
rule in `docs/audit/04-test-strategy.md`.

**Commits:** `74e4fa3`, `f768b33`.

### 3 · Turned permanently-red CI green — by fixing the cause, not the symptom

> Got CI to green for the first time in the repo's history. The failure was not
> the 66 ruff errors; it was that CI installed dev tools with `.[dev]`, which
> resolves to an extra that does not exist, so ruff, pytest and mypy were never
> installed and the job failed before running any of them.

**If asked:** PEP 735 dependency-groups need `--group dev`. Fixed the install,
then cleared the 66 lint errors, 36 unformatted files and 47 strict mypy errors
that had been hiding behind it.

**Worth volunteering:** mypy immediately found two live bugs it had been masking —
a missing `cwd` argument in the repo-clone pipeline and a reference to a
non-existent attribute in the WebSocket manager. Neither had a symptom anyone had
reported, because the code path had not been exercised in production.

**Commits:** `9a00b51`, `0727d91`, `1ac206c`, `3f02a8d`.

### 4 · Closed a critical auth hole and a 30-day data-loss clock

> Removed a hardcoded `GITHUB_WEBHOOK_SECRET` fallback that shipped in the repo,
> meaning anyone who read the source could forge a signed webhook and queue PR
> reviews. Made the receiver fail-closed — unset secret returns 503 rather than
> accepting a payload it cannot verify — chosen over fail-fast specifically so the
> existing live deployment would not break. Added 7 tests.

Alongside it, a full security pass: hardening response headers and hand-rolled
rate limiting (19 tests), and replacing in-house JWT-with-GitHub-OAuth's two 500
responses with 403s (14 tests).

And the deploy fix: the free-tier host has no persistent disk, so every connected
repository vanished on restart — a bug documented in the handover notes and
invisible in the code. Pointed `DATABASE_URL` at managed Postgres, after checking
vendor docs instead of trusting memory.

**The part to be proudest of:** my first pass recommended the host's own free
Postgres and claimed a weekly ping would keep it alive. Reading the provider's
docs properly showed it **expires 30 days after creation** — the clock does not
reset with use, so the ping was worthless — and that the alternative I switched to
has no expiry at all and suspends compute rather than deleting data when you
exceed a limit. Corrected it in a follow-up commit rather than quietly.

**Commits:** `15a4b66`, `a5aba61`, `b5c314c`, `2ee4816`.

### 5 · Replaced a hardcoded mock with working realtime — and a spoofing hole

> The WebSocket layer was a stub that returned hardcoded frames, so the live
> product had no realtime at all. Built a real socket client with an exponential
> backoff, wired the backend to actually publish events, and bound comment
> persistence — comments were previously broadcast and then discarded, so they
> appeared to save and vanished on refresh.

> In the same pass found and closed a gateway impersonation hole: a client could
> set `author_id` on a message and have it broadcast as another user. The
> gateway now overwrites `repo_id` and `author_id` server-side, and a server-side
> test proves it.

20 frontend and 8 backend tests. This is the strongest "I can build the whole
path" bullet on the list, because it spans the client, the gateway and the
persistence layer.

**Commit:** `05ccbe7`.

### 6 · Made an auth-walled app indexable, and fixed a silent production break

> `/` redirected into a protected route, so the site served crawlers an empty
> `<div id="root">` and had zero indexable pages. Built a public landing page,
> per-route canonicals and meta, a build-time `robots.txt`/`sitemap.xml`, a web
> app manifest, and a generated OG image.

The subtle part, which is the actual engineering: head tags are **duplicated** in
`index.html` on purpose, because social crawlers do not execute JavaScript and
will never see anything the SPA writes. And the canonical origin resolves from
`window.location` at runtime, falling back to the configured value — so a preview
build cannot claim to be production, and there is nowhere for a hardcoded hostname
to hide. That matters because the repo's own docs had accumulated **two different
dead Vercel hostnames**, and the deployed bundle pointed at whichever was written
last.

**Commit:** `f2e5710`, 15 tests on the SEO helpers.

### 7 · Found a design bug no test could have caught

> A colour key named `panel` in the Tailwind theme silently made `shadow-panel`
> compile to a shadow *colour* with no `box-shadow` at all. Every floating overlay
> in the graph rendered with no shadow and looked intentional. No error, no
> warning, no failing test.

Also found 12 design tokens that were referenced throughout the codebase and
never defined — so button hover states, health-badge colours and panel shadows
simply did not exist — and a default violet accent that competed with the
product's status palette for meaning.

**The lesson is the point:** four of the five design defects were invisible
without inspecting compiled output or cross-referencing two source files. A test
suite does not catch a design bug; you catch it by reading the output.

**Commits:** `fd88e51`, plus the documented design system in
`docs/DESIGN_SYSTEM.md`.

### 8 · Deployed as configuration, not as dashboard clicking

> Rewrote the deploy as reviewable code — a Render blueprint and a Vercel config
> — because the previous deployment had been configured by hand, which is exactly
> why the data-loss bug was documented in handover notes and visible to nobody
> reading the repo. Found and fixed a missing SPA rewrite that made every deep
> link 404 in production.

Every provider limit quoted in the docs is cited to that provider's own
documentation, with the date checked. Where something could not be verified, the
docs say **NOT VERIFIED** and explain why, rather than implying it works.

---

## How to answer the hard questions

### *"What's the biggest thing you'd do differently?"*

Point at `2ee4816`. I wrote a claim into the deploy config from memory — that a
free-tier database could be kept alive with a weekly ping — and only checked the
provider's docs after having committed it. It was wrong, and in the worst
direction: the database it described was on a 30-day clock that does not reset
with use, so the mitigation I documented would have done nothing.

The rule I took from it is in the docs now: check the provider's current terms
before committing a claim about them, because they change and my memory of them
does not.

A second honest one: I twice reported a frontend gate as green when I had only
run the one test file I had just written. Vitest does not typecheck — `tsc` does.
A type error reached `master` and CI caught it. The gate is typecheck **and** lint
**and** test **and** build; a single file passing is not the gate.

### *"What would you test next?"*

`services/analysis.py`. It computes the three numbers the entire product exists
to display — cyclomatic complexity, churn, and the health score that decides
which of three colours every node gets. It is at **17%** coverage. It is pure
(source text in, floats out, no database, no network), so the tests are cheap.
The thresholds are fixed at `>= 70` and `>= 45`, so boundaries are easy to pin.

An untested function that produces the product's core output is a worse risk than
anything in the security work, and the security work was the part I did first.
That ordering was wrong, and I'd reverse it.

### *"How do you know your tests are worth anything?"*

Three data points, all of which contradict the tests:

1. The mock-in-production bug shipped with a green suite.
2. A migration bug shipped with a green suite — `create_all` in the app lifespan
   was papering over a schema the migrations never created.
3. Two WebSocket backoff tests asserted exact timings against `Math.random`.
   They passed locally several times, then failed in CI. Fixed by pinning the
   randomness and asserting the exact progression — not by loosening the
   assertion until it passed, which is what the failure invited.

The useful rule I now hold: a test suite verifies logic, not wiring, and a
flaky test is worse than no test because it teaches you to re-run it.

---

## Honest limits — state these before you're asked

| Limit | Say it like this |
|---|---|
| The app is **not** deployed on the current code | The backend is live but on an older build; the frontend deployment is gone entirely — both previously recorded hostnames return 404. Config and migrations are correct and tested; the deploy itself needs account access I don't have. |
| No production database yet | Same reason. The migration history was the blocker, not the config, and it's fixed and covered by tests. |
| No E2E or accessibility tests | No Playwright, no axe. Accessibility claims are from source review only. |
| `analysis.py` at 17% coverage | Named above rather than buried. |
| Free tier has real limits | The backend sleeps after 15 minutes idle and wakes in about a minute, which affects crawlers as much as users. |
| Auth is in-house JWT | Works and is small. Swapping it for a provider is a rewrite of the login surface for no current gain, so I left it and documented the tradeoff. |
| The Docker Compose stack is unverified | No Docker on my machine. The Dockerfiles themselves are built by CI on every push, so the images are covered. |

That table is worth more than another bullet. Knowing exactly where your work
stops is a senior signal, and volunteering it before being asked is the
difference between sounding careful and sounding defensive.

---

## One-liner version, for a 30-second slot

> I audit and harden full-stack apps. On a code-visualisation product I found two
> migration bugs that would have broken the first production deploy, a hardcoded
> auth secret, and a frontend that was serving mock data to users while CI stayed
> green — then took CI from red on 10 of its last 10 runs to three green jobs with
> 170 passing tests and 69.5% coverage. I verify claims against primary sources:
> two "verified" facts I'd written from memory were wrong, and I found both by
> checking.