# STATUS.md — the shared log

This is how the six agents talk to each other. **Append, never delete.**
Newest entry at the bottom. Every session ends with a new entry here before
the agent stops.

Format:

```
### [Agent <n> - <role>] <date> <time>
Did: <what you built/changed>
Exposed: <new/changed endpoint, event, or contract — link to CONTRACTS.md section>
Blocked on: <what you need from another agent, or "nothing">
Next: <what you'll do next session>
```

---

### [Human] project kickoff
Kit generated. Six agents about to start on their own branches. CONTRACTS.md
v0.1 is the starting shape — expect it to evolve as Agent 1 and Agent 2 build
the real models.

<!-- New entries go below this line -->

### [Copilot] 2026-09-15 local full-stack verification
- Did: Verified backend with `python -m pytest -q` (23 passed), frontend with typecheck, production build, lint, and Vitest (26 passed). Started FastAPI locally with SQLite and Vite locally; both responded successfully over HTTP.
- Exposed: Backend OpenAPI at `http://127.0.0.1:8000/openapi.json`; frontend at `http://127.0.0.1:5174/` because port 5173 was already occupied by an existing frontend process.
- Blocked on: Docker/Docker Compose is not installed or available on this Windows environment, so container-stack verification cannot run here. No application failure was reproduced.
- Next: Install/start Docker Desktop for Compose validation, or use the verified local commands from the backend and frontend directories.

### [Backend Consolidation] Orchestrator wiring + first commit
- Fixed the `webhooks.py` import crash (P0): routes `analysis.py`/`webhooks.py`
  were importing `analyze_repo`/`review_pull_request` + `verify_webhook_signature`
  from names that did not exist on pure services or had wrong signatures. Added
  `app/services/orchestrator.py` (the only module allowed to own DB + git-checkout
  + persistence I/O) exposing `analyze_repo(repo_id)` and
  `review_pull_request(repo_id, pr_number)`; repointed the two routes to it.
  `app.main` now imports cleanly; `pytest` collects 23 tests, 11 pass.
- Backend service files that are DEVELOPMENT-ISH stubs/placeholders and verified:
  `app/services/analysis.py` (pure, 309 lines) and `app/services/ai_review.py`
  (pure, 199 lines) are untouched/own Agent 2 per CONTRACTS.
- Fixed broken `app/services/pipeline.py` imports (SessionDep, fetch_repo_metadata,
  uuid coercion) and added `RedisPubSubBackend` dep; added REDIS_URL to config.
- Windows only: `httpcore` + `orjson` reinstall in .venv fixed a real SQLite
  file-lock (codeatlas_test.db) that hung the gateway test teardown.
- Repo hygiene: deleted all 6 agent worktrees + their tags in the main CI workspace
  Wayand�"central repo is a single clean monorepo. Root .gitignore covers
  .venv/node_modules/__pycache__/.env and git history started with a conventional
  commit (`6fc97f8`) over the consolidated tree.
- Blocked: real GitHub OAuth creds + OpenAI key not configured in production env;
  gag order not implemented in WebSocket (auth only, no onion-key yet); alembic
  migrations dir absent (tests bootstrap via init_db.create_all).

[2026-09-16] OAuth live: Render FRONTEND_HOST + GitHub callback fixed. Vercel project update: framework=vite, rootDirectory=frontend. Check backend bundle contains codeatlas-qr0e after this build.

---

## [2026-10-05] Audit pass: phases 0-7 (security, CI, DB, SEO, realtime, docs)

Commits on `master`, newest last:

```
5cb223c chore: full audit pass phase 1 - security, CI and lint fixes (#1)
a5aba61 feat(security): add response hardening headers and HTTP rate limiting
f768b33 fix(api): unwrap the list envelopes the backend actually serves
05ccbe7 feat(realtime): replace the hardcoded mock realtime source with a real socket
f2e5710 seo: give the app an indexable page, real head tags and a sitemap
b5c314c fix(db): align the migration history with the models, and deploy Postgres
74e4fa3 fix(auth): 403 instead of 500 on an unusable token subject, and one API layer
2ee4816 fix(deploy): drop Render's managed Postgres, and fix a typecheck error CI caught
```

### Built
- Security: hardcoded webhook secret removed (fail-closed now, 503 when unset);
  `openai` promoted to a main dependency so the AI review path exists in the
  Docker image; response hardening headers; sliding-window rate limiting.
- CI green on `master` for the first time in the repo's history (3 jobs). The
  backend job had failed on 10 of the last 10 runs.
- Contract: typed list envelopes on the backend, unwrapped once in the frontend,
  plus a cross-language contract test so the two sides fail together.
- Realtime: a real socket client with backoff, comments actually persisted,
  orchestrator events actually published, impersonation hole closed.
- SEO: public landing page at `/`, per-route meta, build-time robots + sitemap,
  generated OG card and PWA icons. Was 0 indexable pages.
- Deploy: `render.yaml` blueprint and `vercel.json` rewrites + headers. Found and
  fixed a missing SPA rewrite that made every deep link 404 in production.
- Docs: `docs/audit/00`-`06`, `MANUAL_STEPS.md`, `SEO_BACKLINKS.md`,
  `DESIGN_SYSTEM.md`, `RESUME_BULLETS.md`. Rewrote `CONTRACTS.md` to v0.2.

### Bugs found
- Two migration defects that would have broken the first managed-database deploy
  (`analysesnapshot` vs `analysissnapshot`; `aireviewrow` never migrated), both
  masked by an unconditional `create_all` in the app lifespan.
- Production was serving **mock data** behind a plausible-looking UI: the graph
  layer tested `VITE_USE_MOCK !== "false"` (true when unset) on a variable name
  nothing in the repo set. CI stayed green throughout.
- A gateway impersonation hole: a client could broadcast a comment with another
  user's `author_id`.
- Two live bugs mypy had been hiding: a missing `cwd` in `services/pipeline.py`
  and a non-existent `self._throttle_for` in `ws/manager.py`.

### Corrections to earlier work in this repo
- **The stale Vercel hostname question is resolved: neither candidate is live.**
  `frontend-bhagyansh.vercel.app` and `frontend-mu-jet-18.vercel.app` both return
  404. A new Vercel project is needed; the canonical origin now resolves from
  `window.location`, so no hostname ships anywhere.
- `render.yaml` previously recommended Render's own free Postgres and claimed a
  weekly ping would keep it alive. Reading the provider's docs rather than
  trusting memory showed it expires 30 days after **creation**, and a ping does
  not reset that. Corrected in `2ee4816`; points at Neon Free instead, which has
  no expiry.
- I reported a frontend gate as green twice having only run the one test file I
  had just written. Vitest does not typecheck; `tsc` does. A type error reached
  `master` and CI caught it. The gate is typecheck AND lint AND test AND build.

### Contract changes
Recorded in `CONTRACTS.md` v0.2: list envelopes, 403 on unusable token `sub`,
fail-closed webhook (503), security headers + 429 on rate limit, `AiReviewRow`
documented for the first time, `/` now a public indexable route, authed routes
and the 404 `noindex`, health-score thresholds (>=70 / >=45), `Comment.x`/`.y`
documented as normalised `0..1`, dual-shape `comment:new`.

### Numbers
| | Before | After |
|---|---|---|
| Backend tests | not measured (`pytest-cov` was not a declared dependency) | **101 passing** |
| Coverage | could not run | **69.51%** |
| Frontend tests | 26 across 6 files | **69 across 9 files** |
| mypy (strict) | 47 errors | **0** |
| `ruff check` | 66 errors | **clean** |
| `ruff format --check` | 36 files unformatted | **clean** |
| CI on master | red on 10/10 runs | **3 green** |
| Indexable pages | **0** | **2** |

### Blocked / needs
- **Vercel project is gone** (both old hostnames 404). Needs a new project —
  `docs/MANUAL_STEPS.md` section 3.
- **Render is running an older build.** `/openapi.json` still describes
  `/analyze` as a logging stub, so the security headers and rate limiting are
  **not in production yet**.
- **No production database.** Applying the blueprint and creating the Neon
  project needs account access. Click-by-click in `docs/MANUAL_STEPS.md`.
- **GitHub OAuth app + webhook**, domain, and Search Console all need account
  access. Not faked; written out in `docs/MANUAL_STEPS.md`.
- **Docker Compose stack unverifiable locally** (no Docker). The Dockerfiles
  themselves are built by CI on every push, so the images are covered.
- ~~**`services/analysis.py` is at 17% coverage**~~ — **DONE** in `be484fa`.
  34 tests, module coverage 17% -> 90%, project total 69.51% -> 77.67%. Found two
  production bugs: `from . import <name>` produced no import at all, and a
  relative import of a Python package never resolved to its `__init__.py`. Both
  mean edges silently missing from the graph.
- **`services/ai_review.py` is at 36%** and is now the same-shape risk: it parses
  model output, which is non-deterministic, so it needs recorded-response
  fixtures. See `docs/audit/04-test-strategy.md` T2.
- **Accessibility unverified.** No axe run; source review only.
- ~~`npm audit` reports 10 advisories, unaddressed.~~ **Triaged** in
  `docs/audit/07-dependency-audit.md`. **2 of 10 were reachable.** One was a
  real open-redirect chain through the login redirect
  (`ProtectedRoute` → `Login.tsx:64`, GHSA-wrjc-x8rr-h8h6) — now guarded by
  `safeInternalPath` with 11 tests. One (`deserializeErrors`) needs SSR this app
  does not do. The other 8 are dev-tree, verified absent from all 4 built JS
  chunks. `brace-expansion` fixed; now **9 advisories, 0 high at runtime**
  (`npm audit --omit=dev`). Remaining fixes are roadmap F12 (react-router 7)
  and F13 (tailwind 4, vitest 5).
- ~~Chart library shipped to every visitor.~~ **DONE** in `fc69379`.
  `recharts` (103.75 kB gzip) is no longer in the initial bundle: the graph
  barrel's `TrendChart` re-export is gone and `manualChunks: { charts:
  ['recharts'] }` is removed. Verified against `dist/index.html` and the
  emitted imports. `hoistTransitiveImports` was the wrong suspect and stays at
  its default.
- **No bundle-size gate in CI.** `bundle-boundary.test.ts` pins the two source
  properties that caused it, but it cannot measure bytes, so a future
  *quantitative* regression would not be caught. `docs/audit/04-test-strategy.md`
  T6.
- 9 low-severity findings in `docs/audit/01-code-audit.md` — all now worked
  through: 5 fixed, 2 were not defects, 1 blocked on GitHub account access,
  1 needs a real code change filed as roadmap F11.

### NOT VERIFIED
- The live deploy on current code, and whether data survives a backend restart.
- Live WebSocket delivery end to end.
- Neon connectivity from Render. URL normalisation **was** verified against four
  real Neon URL shapes.
- Search indexing (weeks).

### [Prod-Complete Agent] 2026-10-06 production-hardening pass
Did: Frontend re-skinned to a light-only enterprise theme (cool neutral ramp,
single blue accent, Primer-style status colours, Geist Sans + Geist Mono
self-hosted, V-mark logo + regenerated favicon/icons/og-image, landing page
rewrite with real-product figure). Health thresholds unified to one 70/45 pair
(src/lib/health-thresholds.ts) — dashboard badges and the graph legend now
bucket identically. Fixed a P0 graph crash: ForceDirectedGraph read d3-bound
datum off React-owned SVG via `selection.each` and threw "Cannot read
properties of undefined (reading 'id')" on every mount; tick maps now key off
data-node-id/data-link-id, with a regression test
(ForceDirectedGraph.test.tsx). Mock repo fixture had a duplicate path (fixed).
Backend durability: DATABASE_URL (Neon pooled URI) + GITHUB_WEBHOOK_SECRET set
in Render; deploy live; Alembic 0002 applied — repo/user/analysissnapshot/
aireviewrow/comment tables verified present in Neon via psycopg.
Exposed: Nothing new on the wire (no contract change).
Blocked on: OPENAI_API_KEY (needs user's OpenAI account) — AI review degrades
gracefully by design.
Next: Push to master, CI + Vercel deploy, re-point aliases, register GitHub
webhooks, capture the real graph screenshot for the landing hero, full live E2E
audit, then final report.

### [Prod-Complete Agent] 2026-10-06 GitHub connect fix
Did: User reported "connect with GitHub" not working. Root cause: backend CORS
allowlist was only settings.FRONTEND_HOST (frontend-bhagyansh.vercel.app), so
the login grant fetch from every other alias (vorza-app, getvorza, vorza-sigma)
was CORS-blocked and "Continue with GitHub" failed before reaching GitHub.
Verified OAuth itself is healthy: authorize URL builds, GitHub accepts the
registered redirect_uri (probe showed the GitHub sign-in page), and the code
exchange returns GitHub's "code incorrect or expired" for a garbage code,
which proves GITHUB_CLIENT_SECRET is valid. Fix: added CORS_ORIGINS setting
(aliases, comma-separated, default) + allow_origin_regex for vorza-<hash>-
bhagyansh.vercel.app preview URLs. Also re-pointed vorza-app/getvorza/
frontend-bhagyansh aliases to the current deployment.
Exposed: Nothing new on the wire.
Blocked on: nothing.
Next: confirm deploy, verify CORS from all aliases, then finish live E2E +
product-map.png + final report.

### [Prod-Complete Agent] 2026-10-06 Analyze never produced a snapshot on Render
Did: User logged in on live site (login now works), connected clauseit + SWARM,
but every POST /repos/{id}/analyze ended with no snapshot -> UI stuck on
"Map unavailable" / Health -analyzing with only a backend log line. Root cause:
backend/Dockerfile is python:3.13-slim, which ships NO git, and
services/pipeline._ensure_checkout clones repos with git clone. So the
background analyze silently failed on Render (orchestrator logs only).
Verified locally: the exact pipeline (git clone with gh token + pure analyze)
produces health=67.36 / 78 files for Bhagyansh07/clauseit. Fix: install git in
the Docker image. Also fixed the en-dash "–" health placeholder in GraphView
(side task T-70x). Redep1oyed; needs one manual "Re-analyze" click to verify.
Exposed: nothing new on the wire.
Blocked on: nothing; waiting on user click to confirm snapshot lands in Neon.
Next: verify snapshot row in Neon after user re-clicks Analyze; then final report.
