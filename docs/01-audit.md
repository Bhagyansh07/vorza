# 01 — Honest Audit (current state)

> Phase 1 deliverable, second pass. The first pass (`docs/audit/01-code-audit.md`,
> 2026-10-05) audited a pre-fix codebase whose critical/high findings were then
> applied. This file re-verifies the CURRENT `master` (`d7802bc`) and records
> what remains. Everything measurable was re-measured today (2026-10-06):
> pytest/coverage, ruff, mypy, tsc, eslint, `npm audit`, `pip-audit`,
> `npm run build` output, source line counts. Nothing below is estimated except
> the completion percentages, and those are justified per table.

## 1. Completion estimate

### Core features (what the product pitches)

| # | Feature | Status | Evidence |
| --- | --- | --- | --- |
| 1 | GitHub OAuth login | **complete** | `api/routes/auth.py:48-134`; HMAC state at `services/github.py:90-149`; verified live this session |
| 2 | Connect + list + disconnect repos | **complete** | `api/routes/repos.py`; picker via `GET /github/repos` (`repos.py:81`); verified live (6 repos) |
| 3 | Force-directed map (node size = complexity, colour = health) | **complete** | `ForceDirectedGraph.tsx` (d3-force), health thresholds `lib/health-thresholds.ts:70/45`; renders real snapshot data |
| 4 | Per-file analysis snapshot (loc, complexity, churn, health) | **complete** | `services/analysis.py`; live runs: clauseit 67.36, SWARM 61.16 |
| 5 | Health history over time | **complete** | `api/routes/analysis.py:39-59`, `RepoHistory.tsx` + lazy `TrendChart` |
| 6 | Comment pins on the graph | **complete** | `api/routes/comments.py` + socket path; persistent via `SqlCommentStore` (`app/main.py:35`) |
| 7 | Multiplayer cursors ("like Figma") | **complete** | real WS client `features/graph/realtime/websocket.ts`; gateway `ws/gateway.py`; mocks only when `VITE_USE_MOCKS=true` |
| 8 | AI PR review with citations | **partial** | Pipeline works end-to-end (webhook → diff → LLM → persisted row) **but findings carry no line citation and nothing stops the model inventing files** — §5, the key finding |
| 9 | Public landing page | **complete** | `/` is the public Landing (`app/router.tsx:24`); sitemap.xml + robots.txt generated at build |
| 10 | "Updates the map live" (snapshot → graph push) | **complete** | `snapshot:updated` / `review:new` broadcast → WS client → graph |

### Honest percentages

| Dimension | % | Reasoning |
| --- | --- | --- |
| Backend feature completeness | **~95%** | Every route and pipeline works and was verified live this session. Open: OAuth `state` not single-use, no revocation, no `/health`, snapshot storage unbounded. |
| Frontend feature completeness | **~85%** | Every screen exists, realtime real, design system in place. Open: graph keyboard nav + list alternative, dark theme (Phase 3), deep a11y pass. |
| Test coverage of the brief | **~60%** | 160 backend tests @ 80% coverage + 110 frontend tests. No E2E, no perf/Lighthouse CI, gateway/orchestrator error paths thinner (77%/68%). |
| SEO / marketing readiness | **~30%** | Landing + sitemap/robots/OG assets exist, but SPA is client-rendered; `VITE_SITE_URL` unset (canonical/`og:url` depend on Vercel env); no `/docs` content, no JSON-LD. |
| Production readiness | **~80%** | Deploys, Neon persistence, CI green, security headers + rate limits in place. Open: react-router 6 advisory, cold starts, no custom domain, no snapshot trimming. |

**Overall: ~80%.** The honest summary: the previously-red flags are all green and
the product works live end to end. What remains is credibility work — the one
gap that touches the product's core promise is **PR-review citations without
receipts** (§5), plus polish (SEO, a11y depth, perf at scale).

## 2. Code quality

### Measured (today)

| Tool | Result |
| --- | --- |
| `pytest` (160 tests) | **pass**, 80% coverage (CI comment says 69.5% — stale, suite grew) |
| `ruff check .` | **0 errors** |
| `ruff format --check .` | **all formatted** |
| `mypy app` (strict) | **0 errors** |
| `tsc -b --noEmit` | **0 errors** |
| `eslint .` | **0 errors** |

### What the first audit fixed (all verified still-fixed)

| Old finding | Now |
| --- | --- |
| Webhook secret committed default → **C1** | **Fixed** — no default (`config.py:80`), receiver 503 when unset (`webhooks.py:34-38`) |
| `openai` undeclared → **C2** | **Fixed** — `pyproject.toml:22`; key optional, graceful skip (`orchestrator.py:162-173`) |
| CI red 10/10 → **H1** | **Fixed** — green on `08ad016`/`b08db33`/`d7802bc` |
| PEP 735 install bug → **H2** | **Fixed** — `CI.yml:28-31` uses `--group dev` |
| `pytest-cov` missing → **H3** | **Fixed** — coverage runs (`CI.yml:46-47`) |
| Undefined graph tokens → **H4** | **Fixed** — token set defined (`index.css`), health/complexity scales in `tailwind.config.ts` |
| Fake cursors/map updates → **H5** | **Fixed** — real WS client; mocks gated behind `VITE_USE_MOCKS` |
| No security headers → **H6** | **Fixed** — `SecurityHeadersMiddleware`; `main.py:79` adds it outermost |
| No rate limiting → **H7** | **Fixed** — `core/rate_limit.py` (per-path budgets at `:108-118`) |
| `deps.py` UUID parse → 500 → **M8** | **Fixed** — wide except → 403 (`deps.py:30-48`) |
| `DummyCommentStore` default → **M1** | **Fixed** — `init_runtime(SqlCommentStore())` (`main.py:35`) |
| Recharts in main bundle → **M5** | **Fixed** — `TrendChart` is its own lazy chunk (verified in build output) |
| mypy 47 errors → **M3**, ORM-as-response → **M4** | **Fixed** — strict-clean; explicit `model_validate` (`repos.py:64`) |

### Remaining code-quality findings

| Finding | Severity | Evidence |
| --- | --- | --- |
| No god files at the old bar, but **ForceDirectedGraph.tsx (409 lines)** and **`analysis.py` (381)** now exceed the ~300-line convention and are the two heaviest files | low | measured line counts |
| Stale duplicated manifest `backend/app/services/requirements.txt` (agent-era relic; not referenced by any script, Dockerfile, or CI) | low | file exists, `pyproject.toml` is the single source |
| `ConnectionManager.throttle_submit` / `throttle_due` (manager.py:107-114) are correct now but still have **zero callers** | low | gateway uses `throttle_for` directly (`gateway.py:97`) |
| Error handling + logging | **strong** — exception taxonomy (`GithubOAuthError`/`RepoCheckoutError`/`AiReviewError`), orchestrator records `last_analyze_error` per repo (`orchestrator.py:49-59`), broadcast failures never mark runs failed (`:116-124`) | verified in code |

## 3. Security

### OWASP pass (current)

| Area | Finding | Severity |
| --- | --- | --- |
| **Secrets in repo** | Fresh shallow-clone scan earlier today: **0 internal files, 0 secret values, 0 committed `.env`**. `frontend/.env.production` is tracked deliberately (documented `!.env.production` + header comment `:1-20`) and holds only public build-time values (`VITE_API_URL`, `VITE_USE_MOCKS=false`). | pass |
| **Secret validation** | Placeholder secrets refused at startup in production (`config.py:105-121`); webhook secret intentionally has no default | pass |
| **SSRF via repo URL** | Repo validated against GitHub API with the owner's token before clone (`repos.py:40-51` → `github.py:214-236`); clone URL scheme is fixed (`https://x-access-token:…@github.com/<name>.git`, `pipeline.py:81-88`); git invoked via arg list, `shell=False` — no injection surface | pass |
| **Broken access control** | Ownership enforced per route, 404-not-403 (`deps.py:58-67`) | pass |
| **Webhook integrity** | HMAC-SHA256, constant-time compare, fail-closed 503 | pass |
| **Injection** | SQLModel parameterised; no `eval`/`exec`/`dangerouslySetInnerHTML` in src | pass |
| **CORS** | Explicit allowlist + regex for preview origins (`main.py:61-74`) | pass |
| **Rate limiting** | In-process sliding windows, per-path + per-write budgets, authenticated keys by user id (`rate_limit.py:121-139`) — single-instance only, documented | pass (note) |
| **Security headers** | `SecurityHeadersMiddleware` — CSP, HSTS, `X-Content-Type-Options`, Referrer-Policy, X-Frame-Options | pass |
| **OAuth `state`** | HMAC-signed (`github.py:132-149`) but **stateless**: replayable until `SECRET_KEY` rotates; docstring says exactly this; single-use fix = storing spent nonces (P2 carryover) | low |
| **JWT** | HS256, 8-day expiry; **no `aud`/`iss`/`jti`/revocation**; logout is client-side only | low |
| **X-Forwarded-For** | Trusted for rate-limit keys (`rate_limit.py:128-139`) — safe only while app isn't exposed directly; documented in MANUAL_STEPS | low |
| **Frontend redirect** | `react-router-dom` 6.x carries open-redirect advisory GHSA-wrjc-x8rr-h8h6 (fix = v7 major). App-level guard `features/auth/routes/safe-redirect.ts` blocks non-/ internal targets | medium |
| **npm audits** | **13** (2 critical, 6 high, 5 moderate) — criticals `tinypool`/`vitest` are **dev-only** (test runner, absent from built chunks); high chain (`braces`→`micromatch`→`tailwindcss`) is build-time only; runtime-reachable = react-router pair only | low (prod impact) |
| **pip-audit** | **2** (both `pytest 8.4.2` → PYSEC-2026-1845, dev-only; fix 9.0.3). Runtime Python deps clean | low |

## 4. Performance

### Bundle (fresh `npm run build`, today)

| Chunk | Raw | Gzip | Note |
| --- | --- | --- | --- |
| `index-` (app) | 295.96 kB | 95.10 kB | |
| `react-` vendor | 205.74 kB | 65.68 kB | React 18 + router + query |
| `d3-` | 60.22 kB | 20.62 kB | force graph — separate chunk |
| `TrendChart-` | 360.08 kB | 105.01 kB | **lazy** — only on history route ✅ |
| `index.css` | 32.40 kB | 7.33 kB | |
| Geist woff2/woff | ~14 files | — | multi-subset; latin 400-700 loaded |

Initial JS ≈ **561.9 kB raw / 181.4 kB gzip** (index+react; d3 loads with the map
route). The first-pass audit's recharts-in-main-bundle problem is gone.

### Graph rendering at scale — honest assessment (NOT benchmarked)

d3-force simulation on SVG DOM nodes. No browser-harness benchmark ran in this
environment, so call these architecture-based estimates:

| Nodes | Expected behaviour |
| --- | --- |
| ≤ 1k | **fine** — d3 uses a quadtree internally for many-body forces; per-node `<g>` DOM is OK |
| 3–5k | **janky** — SVG DOM updates + main-thread simulation ticks compete; frame drops on drag/zoom |
| 20k | **unusable in SVG** — needs canvas/WebGL rendering + simulation in a Web Worker + zoom-culled node drawing |

Recommendation (Phase 2): keep the current d3/SVG path for ≤ ~2k files, add a
canvas renderer + worker simulation for larger repos, and progressive (settle →
interact) rendering. Also: `snapshot.files` payloads grow with file count — a
dedup/trim policy is needed (§8 R6).

### Latency & caching

- Render free cold start ~50 s (no keep-alive); `POST /analyze` returns 202
  instantly and runs in the background, so the UI already has a good loading model.
- `GET /snapshots/latest` re-serves the full JSON each poll; **no ETag /
  If-None-Match / cache headers** — fine today, wasteful as history grows.
- Webhook reviews are async; the review row is committed before broadcast, so
  UI refresh is eventually consistent.

## 5. Accuracy — the one finding that touches the product promise

### Scoring: sound and documented ✅

Formulas live in one place and are deterministic + unit-tested:

```
complexity_score = min(100, fn_count + class_count*2 + max_nesting*2)   # analysis.py:10-12
churn_score      = min(100, log1p(commits)*30 + log1p(changes)*8)       # analysis.py:348-352
file health      = clamp(100 - 0.55*complexity - 0.45*churn, 0, 100)    # analysis.py:354
snapshot health  = LOC-weighted mean of file health                     # analysis.py:366-371
```

Honest labels to keep: complexity is a **proxy** (fn/class/nesting counts), not
cyclomatic complexity; JS/TS imports are regex-based (`analysis.py:178-186`);
only 7 languages supported. Scoring is deterministic — same commit → same
numbers, which is what makes trend charts meaningful. Live runs match: clauseit
67.36, SWARM 61.16.

### PR-review citations: **findings are not cited to a line, and nothing stops the model inventing files** ⚠️

Evidence chain:

1. `ReviewFlag` is `{file, severity, note}` — **no line number, no line range**
   (`services/schemas.py:28-31`). The pitch "citations, not vibes" is therefore
   structurally weaker than claimed: a "citation" is a bare file path.
2. `updated_files` is **produced by the model** (`prompts.py:31`) and persisted
   as-is (`orchestrator.py:177-184`) — the server never cross-checks it against
   the actual diff.
3. The diff is truncated head+tail at 120k chars (`ai_review.py:132-140`), so
   the middle of large diffs is invisible to the reviewer; with no validation,
   a flag can reference a file whose hunks were truncated away.
4. The prompt instructs "Do not invent issues" (`prompts.py:34`) — a wish, not
   a check.

### Proposed fix (concrete, Phase 2 scope — implements "drop uncited findings")

1. **Derive changed files server-side** from the diff (`diff --git a/X b/Y`
   header regex) in `orchestrator.review_pull_request`; ignore the model's
   `updated_files` entirely (or accept it, but validate against the derived set).
2. **Drop uncited flags**: any flag whose `file` is not in the derived changed
   set is discarded; persist `dropped_flags` (count) on the review row so the UI
   can honestly say "2 of 5 findings dropped: not in the diff".
3. **Add optional line citations** to the schema: `line_start`/`line_end` on
   `ReviewFlag`. When present, validate against the diff hunks
   (`@@ -a,b +c,d @@` maps) — a cited line must fall inside a changed hunk;
   otherwise the flag is dropped or the line is stripped.
4. **Cap flags** at e.g. 15 and strip flags with empty/non-enum severity
   (severity already `Literal`, validated).
5. **UI**: file chips show `path:line–line` ranges (already have `ReviewBanner`)
   and the dropped-count line, making the "receipts" claim visible and honest.

This converts "the model says so" into "the diff proves it", which is the exact
credibility step this product sells.

## 6. Accessibility & responsiveness

### Measured strengths (good surprise)

- Semantic landmarks: `nav aria-label`, labelled sections (`Landing.tsx:92,149,175`), footer nav.
- Graph: `role="img"` + descriptive aria-label (`ForceDirectedGraph.tsx:328-329`);
  legend `role="group"` + full colour-scale description (`GraphLegend.tsx:16-29`).
- Comments: `aria-live="polite"` + per-comment labels (`CommentLayer.tsx:52,66`).
- `prefers-reduced-motion: reduce` handled (`index.css:160`).
- Descriptive `alt` on the landing screenshot (`Landing.tsx:137`); skeleton/status roles on loading states (`StateViews.tsx`, `TrendChart.tsx:54`).

### Gaps (Phase 3)

- Graph nodes are **not keyboard-focusable** and there is **no table/list
  alternative view** of the codebase (a11y screen-reader story for the map).
- No full keyboard navigation for graph interactions (hover inspector).
- Dark theme absent today (Phase 3, per the decided system-preference policy).

## 7. Dependencies

| Item | Verdict |
| --- | --- |
| `axios` | **used** — `http-client.ts:1` (interceptors: JWT + 401 event); old audit's "redundant" claim is **wrong** |
| `@radix-ui/react-dropdown-menu` | **used** — user menu in `Navbar.tsx:6-65`; old audit's "unused" claim is **wrong** |
| `recharts` | **used, lazy** — only `TrendChart`, on-demand chunk |
| npm advisories | 13 total; prod-relevant = react-router 6 open-redirect (app-guarded); rest dev/build-time (see §3) |
| pip advisories | pytest dev-only (PYSEC-2026-1845) |
| Stray manifest | `backend/app/services/requirements.txt` — delete |

## 8. Prioritized fix list (what remains)

Severity: **high** = user-visible breakage or exploitable; **medium** =
correctness/credibility; **low** = polish/dev hygiene.

| ID | Issue | Sev | Effort | Fix |
| --- | --- | --- | --- | --- |
| R1 | PR-review findings carry no line citation + model can invent files | **high** (credibility) | M | §5: server-side changed-file derivation, drop uncited flags, optional validated line ranges, flags cap, UI honesty line |
| R2 | react-router 6 open-redirect advisory; only v7 fixes it | medium | M | Upgrade to react-router-dom v7 (route API migration) + re-run guard tests |
| R3 | Dev-only audit noise: tinypool/vitest criticals, pytest advisory | low | S | Bump vitest ≥4.1.11, pytest ≥9.0.3 in dev deps |
| R4 | Stale `backend/app/services/requirements.txt` | low | S | Delete |
| R5 | Unused `ConnectionManager.throttle_submit/due` | low | S | Delete both, keep `throttle_for` |
| R6 | Snapshot JSON grows unbounded per repo | medium | M | Trim job: keep last N snapshots per repo (e.g. 20) |
| R7 | No `/health` liveness endpoint | low | S | Add `GET /health` (includes `APP_VERSION` for ops) |
| R8 | Graph not keyboard-accessible, no list alternative | medium | M | Phase 3: focusable nodes + table/list view |
| R9 | OAuth `state` replayable (P2 carryover) | low | M | Spent-nonce store + expiry timestamp |
| R10 | Snapshot API no conditional GET | low | S | ETag/`If-None-Match` on `GET /snapshots/latest` |
| R11 | `VITE_SITE_URL` unset → canonical/`og:url` not absolute | medium | S | Set in Vercel dashboard (build already warns) |
| R12 | No E2E / Lighthouse CI (first-audit gap, still open) | medium | M | Phase 5: Playwright smoke + Lighthouse CI job |

**Totals: 1 high, 6 medium, 5 low. No criticals.**

## 9. Phase 1 status

**Audit: done.** Every gate re-verified green; fresh bundle, coverage, npm/pip
audit, and a11y greps recorded. First-pass criticals/highs confirmed fixed; the
remaining list is R1-R12 above. One new high (R1) is the product's credibility
core, which Phase 2 should schedule first.

Verified: `pytest --cov` (160 @ 80%), `ruff check`/`format --check`, `mypy app`,
`tsc -b --noEmit`, `eslint`, `npm audit`, `pip install pip-audit && pip_audit`,
`npm run build` (chunk table), source line counts, a11y greps — output recorded
above.

Not verified: real-browser Lighthouse/CWV on the deployed site; graph frame-rate
benchmarks at 1k/5k/20k (no browser harness in this environment — handled as
architecture estimates); Playwright E2E (not present).