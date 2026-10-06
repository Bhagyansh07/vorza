# 16 — Changelog

Status: 🟢 LIVE — follow "Keep a Changelog" style. Newest entries on top.
Update this every time a task from `15_MICROTASKS.md` is completed.

## [Unreleased]

Audit, fix, SEO and deploy-hardening pass. Full write-up per phase in
`docs/audit/00-recon.md` through `docs/audit/06-summary.md`.

### Production-complete pass — 2026-10-06

#### Changed
- **Light-only enterprise theme.** The frontend moved from dark-only/cyan to a
  light cool-neutral ramp with a single enterprise blue accent and Primer-style
  status colours. Token *names* are unchanged so no component class renames were
  needed; the graph node palette (`healthColor`) retuned to 50% lightness for
  the near-white canvas. Landing, login, nav, footer de-slopped; landing now
  shows a real-product screenshot with a scope disclosure.
- **Typography:** Geist Sans + Geist Mono Variable, self-hosted via fontsource
  (no runtime font request). Mono reserved for machine output (paths, hashes,
  scores).
- **Health thresholds unified to one 70/45 pair** in `src/lib/health-thresholds.ts`
  (re-exported by the graph's `encoding.ts`). The dashboard badges bucketed at
  80/50 while the graph legend used 70/45, so the same file could read "Medium"
  and "Healthy" on one page. Both now bucket identically; tests pin the bounds.

#### Added
- `frontend/src/components/brand/Logo.tsx` (LogoMark + lockup) and a new V-mark
  favicon; `scripts/make_brand_assets.py` now draws the blue-plate/white-V mark
  for all raster icons and a light OG card; `scripts/check_brand_assets.py`
  pixel-verifies them.
- `ForceDirectedGraph.test.tsx` regression for the mount crash below.

#### Fixed
- **P0: the graph crashed on every mount.** `ForceDirectedGraph` built its
  tick-lookup maps with d3's `selection.each`, which hands React-owned SVG
  elements an `undefined` datum, so `n.id` threw "Cannot read properties of
  undefined" and the error boundary replaced the map with "Something went
  wrong". Maps now read `data-node-id`/`data-link-id` from the DOM instead.
- **P0: connected repos were wiped on every backend deploy.** Render free tier
  wipes the ephemeral disk; the backend's SQLite lived there. `DATABASE_URL`
  (Neon Postgres, pooled) is now set in Render and Alembic `0002` applies on
  boot; tables verified present in Neon.
- `GITHUB_WEBHOOK_SECRET` set in Render so the fail-closed webhook receiver can
  authenticate real GitHub deliveries (registered in the GitHub UI).
- **Live login broke on every alias except the canonical one.** The backend CORS
  allowlist was a single origin (`FRONTEND_HOST`), so the login grant fetch from
  `vorza-app` / `getvorza` / `vorza-sigma` was CORS-blocked and "Continue with
  GitHub" failed before reaching GitHub. Added a `CORS_ORIGINS` setting (the
  live aliases) plus `allow_origin_regex` for `vorza-<hash>-bhagyansh.vercel.app`
  preview URLs. OAuth itself was verified healthy: GitHub accepts the registered
  redirect URI and the code exchange fails only with GitHub's own "code
  incorrect or expired" for a garbage code, which proves the client secret is
  valid.
- Mock repo fixture had a duplicate `src/lib/api.ts` path (React duplicate-key
  warning + ambiguous graph data); replaced with a distinct fixture file.

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
- `recharts` (103.75 kB gzip) removed from the initial bundle. Three causes, and
  the obvious one was wrong: the graph barrel re-exported `TrendChart` (so
  `RepoDetail`'s barrel import dragged recharts in), and
  `manualChunks: { charts: ['recharts'] }` forced it into a chunk that Vite
  preloads. `hoistTransitiveImports` looked like the cause and setting it to
  `false` moved zero bytes. Pinned by 6 source-level tests
  (`frontend/src/features/graph/bundle-boundary.test.ts`).
- Open redirect in the login redirect fixed. `ProtectedRoute` stored
  `location.pathname` (attacker-controlled) in `location.state.from` and `Login`
  navigated to it after sign-in, so `/\evil.com` redirected an authenticated
  user off-origin (GHSA-wrjc-x8rr-h8h6, react-router 6.30.6). Guarded by
  `safeInternalPath`, 11 tests. The dependency upgrade is a v6 -> v7 migration,
  filed as F12 rather than rushed alongside the fix.
- `npm audit` triaged in `docs/audit/07-dependency-audit.md`: 2 of 10 advisories
  were reachable, 8 are dev-tree (verified absent from all 4 built JS chunks),
  `brace-expansion` fixed.
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
