# 01 — Code and Project Audit

> Phase 1 deliverable. Every finding cites a file:line or the exact command that
> produced it. Where something could not be checked, it says **NOT VERIFIED**.

Baseline measurements are in `docs/audit/00-recon.md` §5. Nothing here is
estimated except the completion percentages, and those are justified below.

## 1. Completion estimate

The `brain/01_PRD.md` template was never filled in, so "intended features" is
reconstructed from three sources: the pitch in `README.md:26-28`, the feature list
in `HANDOVER.md:15-21`, and the actual routes/components on disk.

### Core features

| # | Feature | Status | Evidence for the verdict |
| --- | --- | --- | --- |
| 1 | Connect a GitHub repo via OAuth | **complete** | `services/github.py:39-111` HMAC-signed state, constant-time verify at `:77`; `api/routes/auth.py`; ownership enforced in `api/deps.py:50-59` |
| 2 | Repo architecture / visual map | **partial** | Data is real (`services/analysis.py` → `orchestrator.analyze_repo` → `models/snapshot.py`), rendering is real (`ForceDirectedGraph.tsx`), but 12 colour utilities it depends on are undefined (`00-recon.md` §6) so it renders colourless |
| 3 | AI repo health analysis snapshot | **complete** | `analysis.py` is pure and testable; `orchestrator.py:45-79` persists results |
| 4 | Health history over time | **complete** | `api/routes/analysis.py`, `RepoHistory.tsx`, `TrendChart.tsx` |
| 5 | Comments / pins on code | **partial** | UI complete (`CommentLayer.tsx`, `FileSidePanel.tsx`); REST persistence exists (`api/routes/comments.py`, `ws/comment_store.py`), but the gateway runs `DummyCommentStore` by default — `ws/gateway.py:46`, and `init_runtime()` is called with no argument at `main.py:26`, so **comments raised over the socket are never persisted** |
| 6 | Dashboard of connected repos | **complete** | `api/routes/repos.py`, `Dashboard.tsx`, covered by tests |

### Headline features from the pitch

| Feature | Status | Evidence |
| --- | --- | --- |
| "teammates see each other's cursors like Figma" | **stub** | No WebSocket code exists in the frontend at all. `RepoDetail.tsx:143` hardcodes `realtime={mockRealtimeSource}`; `features/graph/mocks/events.ts:142-162` invents two cursors that drift on a `setInterval`. The backend gateway is genuinely implemented (`ws/gateway.py:90-202`). |
| "updates the map live" | **stub** | Same source. Snapshot pulses at `mocks/events.ts:82-94` and fake AI reviews at `:95-133` are timer-driven fiction. |
| "an AI agent auto-reviews every new PR" | **partial — cannot run** | `pyproject.toml` has no `openai` dependency; `ai_review.py:85` lazy-imports it. `OPENAI_API_KEY` is read via `os.getenv` (`ai_review.py:77`) and appears in no `.env.example`. Every call raises `LLMError` → `AiReviewError` → swallowed at `orchestrator.py:126-131`. The webhook still answers `{"status":"ok"}`. |
| Public demo with sample data | **missing** | No route, no seed endpoint. `features/graph/mocks/seed.ts` exists but is mock-layer only. |
| Marketing/landing surface (SEO) | **missing** | `router.tsx:19-30` has 4 routes, all app-shell. `/` redirects straight to `/dashboard` (`:29`). Nothing indexable. |

### Test, CI and release engineering

| Claimed | Actual |
| --- | --- |
| "Testing: Pytest, Vitest, Playwright" (`README.md:41`) | Pytest ✅ (23), Vitest ✅ (26), **Playwright: not present.** No E2E, no accessibility test, no link checker, no Lighthouse CI. |
| GitHub Actions CI | Present but **red on 10/10 runs**, backend job failing at `Lint (ruff)`. |
| Coverage gate 60% (`CI.yml:37`) | Cannot run — `pytest-cov` is not a declared dependency. |

### Honest percentages

| Dimension | % | Reasoning |
| --- | --- | --- |
| Backend feature completeness | **~85%** | Auth, analysis, snapshots, history, webhooks and the realtime gateway are all real and reasonably designed. Held back by the undeclared `openai` dependency, the `DummyCommentStore` default, and 47 strict-mode type errors. |
| Frontend feature completeness | **~70%** | Every screen exists and routes work, but the two flagship realtime features are mocked and the graph's design tokens are missing. |
| Test coverage of the brief | **~20%** | Unit tests exist for auth/store/health/http. Nothing for the graph, analysis, comments, websocket client, or any user journey. |
| SEO / marketing readiness | **0%** | No sitemap, no robots.txt, no canonical, no OG, no JSON-LD, no indexable page. |
| Production readiness | **~35%** | Deploys today, but data is wiped on every free-tier restart, the webhook secret is committed, CI is red, and 6 high-severity dependency advisories are open. |

**Overall: ~55% complete.** The honest summary is that this is a well-architected
**backend with a well-architected frontend skeleton**, whose two most impressive
features are not yet connected to each other, and whose entire public-facing
surface (the part a recruiter sees first) does not exist yet.

That last point is the crux. The brief asks for a project that is
"recruiter-impressive". Right now the first thing a recruiter sees is a redirect
to a login screen.

## 2. Architecture

### Structure

```
backend/app/
  main.py          FastAPI app, CORS, lifespan, create_all
  api/routes/      auth, repos, analysis, comments, webhooks  (HTTP layer)
  core/            config, db, security
  models/          user, repo, snapshot, comment   (SQLModel)
  services/        analysis, ai_review, github, pipeline, orchestrator, prompts
  ws/              gateway, manager, pubsub, throttler, comment_store, events
frontend/src/
  app/             router, ProtectedRoute, providers
  components/      layout/, ui/ (shadcn), errors/
  features/        auth/, repos/, graph/, comments/  (feature-sliced)
  lib/             api-client, http-client, config, health, token, errors
```

This is a genuinely good structure. Feature-sliced frontend, thin routes, a
separate orchestrator owning I/O so the pure services stay testable
(`orchestrator.py:1-17` explains this explicitly), and a realtime layer split into
gateway / manager / pubsub / throttler. The separation is real, not aspirational.

### What is wrong with it

| Issue | Severity | Detail |
| --- | --- | --- |
| Two competing HTTP client layers | medium | `frontend/src/lib/api-client.ts` (axios) and `lib/http-client.ts` (fetch) both exist. `features/graph/api/index.ts` uses one, `features/repos/api/repos.ts` the other. Axios is a 1.x dependency carrying ~13 kB gzip for what `fetch` already does. |
| Undeclared runtime dependency | **critical** | `openai` is imported by shipped code but absent from `pyproject.toml`. The package installs clean and then fails at the moment it is needed. |
| `services/requirements.txt` | low | A stray requirements file alongside `pyproject.toml`. Two sources of truth for dependencies; it is not referenced by any script. |
| `orchestrator.py` imports private names | medium | `:31-35` imports `_ensure_checkout` and `_resolve_repo_and_token` — underscore-prefixed internals of `pipeline.py`. A rename inside `pipeline.py` silently breaks the orchestrator. |
| Comment persistence is dead by default | medium | `ws/gateway.py:46` sets `DummyCommentStore`; `main.py:26` calls `init_runtime()` with no argument. The real store in `ws/comment_store.py` is therefore never bound in production. |
| Dead code | low | `ConnectionManager.throttle_submit` / `throttle_due` (`ws/manager.py:104-109`) have no callers, and both are broken (see §5). |

### God files

`backend/app/services/training`-scale problems do not exist here. Largest files by
line count are `analysis.py` (309) and `services/ai_review.py` (199) — both within
the project's own ~200-line convention. `src/features/graph/components/GraphView.tsx`
is 310 lines, slightly over its own stated limit. **No god files.** Credit where due.

## 3. Code quality

### Measured

| Tool | Result |
| --- | --- |
| `ruff check .` | **66 errors**, 50 auto-fixable |
| `ruff format --check .` | **36 files** unformatted |
| `mypy app` (strict) | **47 errors in 17 files** |
| `tsc -b --noEmit` | 0 errors |
| `eslint .` | 0 errors, **4 warnings** |

Representative mypy failures, all real type-safety gaps rather than pedantry:

- `app/api/routes/repos.py:57`, `comments.py:59` — functions declared to return
  `RepoPublic` / `CommentPublic` actually return the ORM model. The response schema
  is a lie; `created_at`/`id` are exposed by accident and the declared shape is not
  what ships.
- `app/api/routes/repos.py:66`, `comments.py:22`, `analysis.py:27` —
  `Item "datetime" of "datetime | None" has no attribute "desc"`. Nullable columns
  are dereferenced without a guard.
- `app/services/orchestrator.py:64` — `List[dict[str, Any]]` passed where
  `List[FileNode]` is expected; snapshot file payloads are unvalidated dicts on the
  way into the DB.
- `app/ws/manager.py:106,109` — `ConnectionManager has no attribute "_throttle_for"`.
  A real `AttributeError`, caught by mypy only because the methods are unused.

### Error handling, states, hardcoding

| Area | Verdict |
| --- | --- |
| Backend error handling | Good. Central `HTTPException` use, `GithubOAuthError` / `RepoCheckoutError` / `AiReviewError` hierarchy, orchestrator logs-and-continues rather than crashing the worker. |
| Frontend loading/empty/error states | **Good.** `RepoDetail.tsx:91-136` has distinct skeleton / error / success branches; `StateViews.tsx` provides dedicated loading, empty and error components; `ErrorBoundary.tsx` and `ErrorState.tsx` exist; sonner toasts on every mutation. |
| Input validation | Good. Pydantic models throughout; `file_validation` equivalent on the frontend; webhook payload validated before use (`webhooks.py:41-51`). |
| Hardcoded values | Mostly good. `DEFAULT_USERNAMES` in `GraphView.tsx:33-38` hardcodes four fake teammate names — acceptable **only** because the caller passes mocks; it would be a bug the moment real presence arrives, since the real roster (`presence:roster`) is ignored. `ai_review.py:38-43` hardcodes an OpenAI price table that will silently rot. |
| Naming / comments | Strong. Comments explain *why*, not *what* — e.g. `manager.py:1-9`, `orchestrator.py:1-17`, `index.css:5-9`. |

## 4. Security

### OWASP pass

| Area | Finding | Severity |
| --- | --- | --- |
| **Secrets** | `core/config.py:47` ships `GITHUB_WEBHOOK_SECRET = "vorza-wbhook-58f2b1e0-9c4d-4f7a-a3de-ok"` as a **committed default**. The guard `_check_default_secret` (`config.py:57-66`) only rejects the literal string `"changethis"`, so this value passes validation and is used in production. | **critical** |
| **Secrets in history** | Scanned every blob in every ref for `gh[pousr]_…`, `sk-…`, `AKIA…`, PEM headers. **Zero matches.** `git log --diff-filter=A` shows no real `.env` was ever committed. | pass |
| **Env file hygiene** | `.gitignore` covers `.env` and `.env.*` with `!.env.example`. But `frontend/.env.production` **is tracked** (added by `0328ebb`), so the rule does not protect it. Contents **NOT VERIFIED** — deliberately not read. | medium |
| **Broken access control** | `api/deps.py:50-59` enforces ownership and returns 404 (not 403) for other users' repos, so ids cannot be enumerated. Sound. | pass |
| **Token handling** | HS256 JWT, 8-day expiry (`config.py:22`). No `aud`, no `iss`, no `jti`, no revocation list. `deps.py:41` does `uuid.UUID(token_data.sub)` with no try/except — a non-UUID `sub` yields a 500 instead of a 403. | low |
| **OAuth CSRF** | `state` is HMAC-signed and compared with `hmac.compare_digest` (`github.py:77`) — good. But it is **stateless**, so the docstring claim at `github.py:43` that it is "single-use" is false; a captured state replays until `SECRET_KEY` rotates. | low |
| **Webhook verification** | `verify_webhook_signature` (`github.py:168-180`) uses `hmac.compare_digest` — constant-time, correct. | pass |
| **Injection** | SQLAlchemy/SQLModel parameterised throughout; no string-built SQL found. No `eval`, no `exec`, no `dangerouslySetInnerHTML` anywhere in the frontend. | pass |
| **CORS** | `main.py:42-48` allows exactly one origin (`settings.FRONTEND_HOST`), credentials on, methods/headers wildcarded. Correct shape. | pass |
| **Rate limiting** | **Absent on all HTTP routes.** Only the AI analysis endpoint's cost is bounded by OpenAI's own limits. Login and connect-repo are unthrottled. `lib/rate-limit.ts` exists in *other* repos of this owner but not here. | **high** |
| **Security headers** | **None.** No CSP, no HSTS, no `X-Content-Type-Options`, no `Referrer-Policy`, no `X-Frame-Options`. `frontend/vercel.json` sets only a rewrite. | **high** |
| **Dependency vulns** | `npm audit`: **10 — 6 high, 4 moderate.** Runtime-reachable: `react-router` open redirect via backslash in `<Link>`/`useNavigate` (GHSA-wrjc-x8rr-h8h6) and `deserializeErrors()` constructor injection (GHSA-337j-9hxr-rhxg). Dev-only: `tailwindcss`→`chokidar`→`braces` stack-exhaustion DoS, `brace-expansion` quadratic DoS, `@vitest/mocker` traversal. | **high** |
| **Python deps** | `pip-audit` **NOT VERIFIED** — not run in this phase. | — |

### The `openai` dependency hole, in detail

This is the finding that matters most, because it is a security *and* a
functionality problem wearing the same coat.

`pyproject.toml:6-17` lists runtime deps. `openai` is not among them. But
`orchestrator.py:29` imports `OpenAIReviewClient`, whose `_connect()`
(`ai_review.py:81-88`) does `import openai` inside the function to keep the import
optional. In production that package is absent, so every review raises
`LLMError("OPENAI_API_KEY is not set")` → `AiReviewError` → caught and logged at
`orchestrator.py:126`.

Net effect: the webhook endpoint returns success, GitHub shows nothing, no
persisted review exists, and the only trace is a log line. This is exactly the
"fail quietly" pattern `ai_review.py:4-8` says it exists to prevent.

## 5. Bug: `ConnectionManager` cursor throttle

`ws/manager.py:97` defines `throttle_for`. Lines **106** and **109** call
`self._throttle_for(...)`. That method does not exist.

```python
def throttle_for(self, repo_id: RepoId) -> CursorThrottle:   # line 97
...
def throttle_submit(self, repo_id, user_id, x, y) -> bool:  # line 104
    return self._throttle_for(repo_id).submit(...)           # line 106  ← AttributeError
def throttle_due(self, repo_id):                             # line 108
    return self._throttle_for(repo_id).due()                 # line 109  ← AttributeError
```

`grep throttle_submit|throttle_due|_throttle_for` across `backend/` returns only
these four lines — **both methods are dead code**. The live path is unaffected:
`gateway.py:93` correctly calls `_manager.throttle_for(repo_id)` and passes the
resulting `CursorThrottle` around directly.

So this is a **medium**, not critical: a latent trap that will detonate the first
time anyone calls it, kept alive only because mypy is not enforced. Verified, not
inferred.

## 6. Dependencies

| Issue | Detail | Severity |
| --- | --- | --- |
| Missing runtime dep | `openai` imported by shipped code, undeclared (§4). | **critical** |
| High-severity advisories | 6 high, of which most are dev-only; 2 runtime-reachable in `react-router`. | **high** |
| Heavy but justified | `recharts` — 356 kB raw / 104 kB gzip, the single largest chunk, used only by `TrendChart` on one route. | medium |
| Redundant | `axios` (1.8.4) alongside `fetch`-based `http-client.ts`. | medium |
| Unused | `@radix-ui/react-dropdown-menu` is installed and a `dropdown-menu.tsx` exists; `npm run lint` and the build pass, but no graph/list component imports it. **NOT VERIFIED** by exhaustive import audit. | low |
| License | All dependencies are MIT/ISC/Apache-2.0/BSD. No GPL or copyleft found in `package-lock.json`. **NOT VERIFIED** exhaustively. | — |
| Stray manifest | `backend/app/services/requirements.txt` competes with `pyproject.toml`. | low |

## 7. Performance (code level)

| Issue | Evidence | Severity |
| --- | --- | --- |
| Recharts in the main bundle | `charts-*.js` 356 kB raw is loaded on `/dashboard` although only `/repos/:id/history` renders `TrendChart`. No route-level code splitting anywhere — `router.tsx` statically imports all four pages. | medium |
| No bundle splitting | One 284 kB app chunk + 356 kB charts chunk on first paint. | medium |
| Polling instead of pushing | Snapshot freshness relies on refetch; the WebSocket path that would push exists server-side and is unused by the client. | medium |
| `_cursor_flush_loop` | `gateway.py:75-87` ticks every 100 ms per repo with no `await asyncio.sleep` jitter and no shutdown flag other than task cancellation. On a free single-instance Render this is fine; it does not scale to many repos per instance. | low |
| `create_all` at boot | `main.py:25` runs `SQLModel.metadata.create_all` on every start, bypassing Alembic. Cheap on SQLite, and it is the documented reason free Render works without a prestart hook. Intentional. | low |
| No N+1 | `repos.py` / `comments.py` / `analysis.py` all use single `select` statements. No N+1 found. | pass |

## 8. Git hygiene

| Area | Verdict |
| --- | --- |
| Commit quality | Good. Conventional commits, descriptive bodies explaining *why*. `bd386a26 chore: rebrand UI + docs from CodeAtlas to Vorza` and `d05a644 infra: strip BOM from vercel.json + .env.production (BOM was breaking Vercel JSON parse & env)` are exactly the right granularity. |
| History hygiene | No large blobs, no committed secrets, no stray binaries found. |
| `.gitignore` | Correct and thorough — **except** two defects: (a) `frontend/.env.production` is tracked despite the `.env.*` rule; (b) line `# Env & secrets �?" never commit real credentials` contains a **mojibake byte** that corrupts the comment. `STATUS.md:48` carries the same corruption (`Wayand�"central repo`), so at least two files in the tree have broken encodings. |
| Branch state | Default branch is `master`. `AGENTS.md:104` says "Never commit directly to `main`" and `README.md:68` says `push -u origin main` — both wrong about a `master` default. Single-branch history, no stale branches. |
| Repo metadata | Private, **no description**, **no topics**, 0 stars. For a portfolio project that must be indexed and clicked, this is unfinished. |

## 9. Prioritized fix list

Severity: **critical** = ships broken or leaks; **high** = user-visible breakage or
exploitable; **medium** = correctness/maintainability; **low** = polish.

| ID | Issue | Sev | Effort | Fix |
| --- | --- | --- | --- | --- |
| C1 | Committed `GITHUB_WEBHOOK_SECRET` default bypasses the guard | critical | S | Remove default, make it required, and make the guard reject *any* shipped default |
| C2 | `openai` undeclared → AI PR review silently dead | critical | S | Add an `ai` extra + `OPENAI_API_KEY` in `.env.example`; surface degradation instead of swallowing |
| H1 | CI red on 100% of runs (`ruff` 66 errors) | high | S | `ruff check --fix`, then manual fixes; commit lint debt separately |
| H2 | CI installs the wrong dependency set (PEP 735) | high | S | Switch to `pip install -e . --group dev` |
| H3 | `pytest-cov` undeclared; `--cov` flag cannot run | high | S | Add `pytest-cov` to the dev group |
| H4 | 12 undefined Tailwind colour tokens break the flagship graph | high | M | Define the token set; wire `tailwind.config.ts` + `index.css` |
| H5 | Live cursors/map updates are mocked in the product path | high | L | Add a real `RealtimeSource` over `ws://…/ws/repos/{id}`; keep mocks for dev/tests |
| H6 | No security headers | high | S | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` |
| H7 | No HTTP rate limiting | high | M | Per-IP/per-user limiter on auth, connect and analyze routes |
| H8 | 10 npm advisories incl. 2 runtime-reachable in `react-router` | high | M | Patch transitive deps; evaluate `react-router` v7 |
| H9 | Data wiped on every free-tier restart | high | M | Neon Postgres via `DATABASE_URL` (already supported) |
| M1 | `DummyCommentStore` is the production default | medium | S | Bind the real store in `init_runtime` |
| M2 | `ConnectionManager._throttle_for` does not exist (dead code) | medium | S | Delete both unused methods |
| M3 | mypy strict: 47 errors | medium | M | Fix genuinely unsafe ones; narrow the rest explicitly |
| M4 | Routes declare `RepoPublic` but return ORM models | medium | M | Construct the public schema before returning |
| M5 | No route-level code splitting; recharts on every page | medium | S | `React.lazy` the routes, lazy-load the chart |
| M6 | `frontend/.env.production` tracked despite `.gitignore` | medium | S | Untrack it; rely on Vercel env vars |
| M7 | Redundant axios alongside fetch client | medium | M | Delete one layer |
| M8 | `deps.py:41` unhandled `ValueError` → 500 instead of 403 | medium | S | Wrap the UUID parse |
| M9 | Two HTTP clients split across features | medium | M | Consolidate |
| M10 | No health-check endpoint | medium | S | `GET /health` for Render + uptime checks |
| L1 | README describes a "kit", not the product | low | M | Rewrite (Phase 7) |
| L2 | `brain/*.md` are empty templates | low | M | Fill PRD or delete the fiction |
| L3 | No repo description or topics | low | S | Set both |
| L4 | `.gitignore` / `STATUS.md` mojibake | low | S | Fix encodings |
| L5 | Docs say `main`, branch is `master` | low | S | Align docs |
| L6 | `orchestrator` imports private `_`-prefixed names | low | S | Promote to public API |
| L7 | `services/requirements.txt` duplicates `pyproject.toml` | low | S | Delete |
| L8 | Hardcoded `DEFAULT_USERNAMES` ignores the real roster | low | S | Prefer server roster when present |
| L9 | OAuth `state` claimed single-use but is replayable | low | S | Correct the docstring; note the limitation |

**Totals:** 2 critical, 9 high, 10 medium, 9 low.

## 10. Phase 1 status

**Audit: done. Critical and high fixes: applied in the commits that follow this
file.**

Verified: ruff, ruff-format, mypy strict, eslint, tsc, vitest, pytest and
`npm audit` all executed with output recorded above; full-history secret scan run;
CI run history queried; `pip list` used to prove the `.[dev]` defect rather than
inferring it.

Not verified: `pip-audit` on Python dependencies; exhaustive unused-dependency
audit; exhaustive license scan; live behaviour of the deployed Render/Vercel
instances; Docker Compose stack (no Docker available); contents of
`frontend/.env.production`.