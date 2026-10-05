# 16 — Changelog

Status: 🟢 LIVE — follow "Keep a Changelog" style. Newest entries on top.
Update this every time a task from `15_MICROTASKS.md` is completed.

## [Unreleased]

Audit, fix, SEO and deploy-hardening pass. Full write-up per phase in
`docs/audit/00-recon.md` through `docs/audit/06-summary.md`.

### Added
- Public landing page at `/` — the only indexable page. `/dashboard` is unmoved.
- Per-route document meta (`src/lib/seo.ts`) plus 15 tests: title, description,
  robots, canonical, `og:*`, `twitter:*`.
- Build-time `robots.txt` and `sitemap.xml` via a Vite plugin. Emits the
  configured origin; **warns loudly** when unset rather than shipping a sitemap
  pointing at localhost.
- Web app manifest, `theme-color`, and generated brand assets (`og-image.png`
  1200x630, PWA icon set) via `scripts/make_brand_assets.py`. The script owns the
  icon colours, which is what prevents the favicon/app drift recurring.
- Security headers and sliding-window HTTP rate limiting
  (`app/core/security_headers.py`, `app/core/rate_limit.py`) — 19 tests. Hand-rolled
  rather than adding `slowapi`. Verified absent on the live deploy before the
  change, so the tests pin a real delta.
- Real `RealtimeSource` WebSocket client with exponential backoff and jitter —
  20 tests — replacing a hardcoded mock that meant the product had no realtime.
- `SqlCommentStore` bound at startup. Comments were previously broadcast and then
  discarded, so they appeared to save and vanished on refresh.
- Cross-language contract test (`backend/tests/test_frontend_contract.py`) so the
  two sides of a shape change fail together instead of at runtime.
- `app/core/schema.py`: Alembic owns the schema when a revision is stamped;
  `create_all` + `stamp_head` only for a database with no migrations at all.
- Migration `0002` — renames `analysesnapshot` -> `analysissnapshot` and creates
  `aireviewrow`.
- `render.yaml` (Render blueprint) and `vercel.json` (SPA rewrite + headers) so
  the deploy is reviewable in a diff instead of living in a dashboard.
- 34 tests for `services/analysis.py` (17% -> 90% module coverage; project total
  69.51% -> 77.67%). They found two production bugs, both causing **silently
  missing graph edges**: `from . import <name>` produced no import at all (the
  AST sets `module=None`, so an `and node.module` guard dropped it), and a
  relative import of a Python package never resolved to its `__init__.py`.
- `docs/MANUAL_STEPS.md`, `SEO_BACKLINKS.md`, `DESIGN_SYSTEM.md`,
  `RESUME_BULLETS.md`, and `docs/audit/02`-`06`.

### Changed
- CI installs dev tools with `pip install -e . --group dev` (PEP 735). It used
  `.[dev]`, which resolves to an extra that does not exist, so ruff/pytest/mypy
  were never installed and the backend job failed before running any of them.
- Graph API layer now delegates to the shared `lib/api-client` instead of keeping
  its own `fetch` path. Ids coerced `string | number -> string` at that boundary.
- List endpoints return a typed envelope (`ReposPublic`, `CommentsPublic`,
  `SnapshotsList`); the frontend unwraps once in `http-client.ts`. Documented in
  `CONTRACTS.md` v0.2.
- 12 missing design tokens defined; accent retuned from shadcn violet to cyan so
  it stops competing with the status palette; `colors.panel` removed because it
  silently suppressed `shadow-panel` entirely.
- `render.yaml` deliberately declares **no** managed Postgres. Render's free
  Postgres expires 30 days after *creation* (verified against vendor docs, not
  memory), which is a data-loss clock that looks durable. Points at Neon Free
  instead, which has no expiry.

### Fixed
- **Critical:** removed a hardcoded `GITHUB_WEBHOOK_SECRET` fallback that shipped
  in the repo. The receiver is now fail-closed — unset returns 503 rather than
  accepting a payload it cannot verify.
- **Critical:** `openai` was a dev dependency, but `Dockerfile:13` runs
  `pip install --no-cache-dir .` (main deps only) — so the AI review path would
  not have existed in the deployed image.
- **Deploy-blocking:** `0001_initial` created `analysesnapshot` where SQLModel
  derives `analysissnapshot`, and `AiReviewRow` was never migrated at all. Both
  were masked by an unconditional `create_all` in the lifespan.
- **Deploy-blocking:** `vercel.json` had no SPA rewrite, so every deep link 404'd
  in production.
- **Production served mock data behind a plausible UI.** The graph layer checked
  `VITE_USE_MOCK !== "false"`, which is `true` when unset, on a variable name
  nothing set. CI was green throughout.
- An unusable token `sub` (missing, or not a UUID) returned 500; now 403. Two
  distinct triggers, both covered — 14 tests.
- WebSocket gateway impersonation hole: a client could set `author_id` and have
  a comment broadcast as another user. Now overwritten server-side.
- Two WebSocket backoff tests asserted exact timings against `Math.random` and
  failed in CI after passing locally. Randomness is now pinned.
- Two live bugs that mypy had been masking: a missing `cwd` in
  `services/pipeline.py:66-67` and a reference to a non-existent
  `self._throttle_for` in `ws/manager.py:111,114`.
- 47 strict mypy errors, 66 ruff errors, 36 unformatted files.
- `VITE_SITE_URL` was read but undeclared in `ImportMetaEnv`, so it arrived as
  `any` via vite's index signature.

### Removed
- The shadow graph API layer's own `fetch` path, base-URL constant, and
  client-invented comment ids.
- `colors.panel` from the Tailwind theme.

### Verification state
- Backend 135 passing, 77.67% coverage (gate 60%). Frontend 69 passing across 9
  files, `tsc` clean, eslint 0 errors / 4 pre-existing warnings. CI green.
- **NOT VERIFIED:** the live deploy on current code; that data survives a restart;
  live WebSocket delivery; the Docker Compose stack (no Docker locally — the
  Dockerfiles are built by CI); accessibility (no axe run); scoring correctness
  (`services/ai_review.py` is at 36%; `analysis.py` is now 90%).

---

## [0.1.0] - [YYYY-MM-DD]

### Added
- Initial project scaffold and `brain/` documentation set.

---

<!--
Template for a new release entry:

## [x.y.z] - YYYY-MM-DD

### Added
- New feature X (T-00N)

### Changed
- Updated behavior of Y (T-00N)

### Fixed
- Bug where Z happened (T-00N)

### Removed
- Deprecated feature W
-->
