# 02 — Roadmap (Phase 3 → 7)

> Phase 2 deliverable. Re-validates the first-pass roadmap
> (`docs/audit/03-feature-roadmap.md`, the F-series) against current `master`
> (`865adc3`), closes out everything that shipped, then sequences the remaining
> work — Phase 1 fix list R1-R12 plus the Phase 3-7 build-out — into one
> verifiable plan. Every item has a measurable "done when". Nothing here is
> estimated except effort, and effort is a range, not a promise.

## 1. Where the first-pass roadmap landed

Status of the F-series as of today. Anything not listed here was verified done
during Phase 0/1.

| F-item | Status | Evidence |
| --- | --- | --- |
| F1 deploy end-to-end | **done** | live: vorza-sigma.vercel.app (frontend), codeatlas-qr0e.onrender.com, Neon Postgres |
| F2 empty states that teach | **done** | `components/empty/EmptyState.tsx`, `graph/components/StateViews.tsx:66`, used at `RepoDetail.tsx:100`, `GraphView.tsx:204` |
| F3 graph legend | **done** | `GraphLegend.tsx` imports thresholds from `lib/health-thresholds.ts` (single source) |
| F4 analysis feedback | **done** | button pending state + disabled (`RepoDetail.tsx:124-126`), queued toast, `last_analyze_error` surface (`:141`), `snapshot:updated` socket refresh |
| F5 lazy-load charts + bundle test | **done** | `TrendChart` lazy chunk; pinned by `index.test.ts` + `bundle-boundary.test.ts` |
| F6 graph loading skeleton | **done** | `StateViews.tsx` loading/skeleton + status roles |
| F7 delete repo | **done** | `DELETE /repos/{repo_id}` + cascade (`api/routes/repos.py:106`), owner-scoped |
| F8 snapshot comparison | **not built** | deferred — see §"Not now" |
| F9 public share link | **not built** | deferred — see §"Not now" |
| F10 cost/time budget for analysis | **not built** | limits exist implicitly (600 s git timeout, `pipeline.py:54`); user-facing budget surfaced later (stretch) |
| F11 OAuth `state` single-use | **not built** | = R9 in this plan |
| F12 react-router 6 → 7 | **not built, guarded** | = R2; `safe-redirect.ts` guard (11 tests) stays regardless |
| F13 clear dev-tree advisories | **not built** | = R3 + optional Tailwind 4 (see §5 note) |
| F14 GitHub App read-only scoping | **not built** | deliberately not now (see §"Not now") |
| T6 quantitative bundle gate | **not built** | = D3 in this plan |

## 2. Sequencing logic — why things are in this order

1. **Hygiene first, but small.** R3/R4/R5/R7 are cheap, no-risk commits. They go
   first so every later phase runs against a clean tree and a quiet audit.
2. **R1 (PR-review citation validation) must land before the Phase 3 hero.**
   The design brief builds a PR-review card with citation chips into the
   landing hero. If R1 has not shipped, those chips show model-invented files —
   the one thing the product sells against. R1 is the hard dependency of Phase
   3's centrepiece.
3. **Phase 3 redesign → Phase 4 SEO → Phase 5 testing → Phase 6 branding/deploy
   → Phase 7 portfolio.** Each phase ends with a stop-and-wait-for-"go",
   per the master protocol, and each phase's acceptance criteria are
   re-checkable only if the previous phase deployed.
4. **R2 (react-router v7) inside Phase 5**, not earlier: it is a router-wide
   migration and the redesign churns the same routes; doing both at once
   invites a silently broken auth flow. Phase 5 is the calm slot.
5. **Phase 6 rename last-but-one**: nothing in Phase 3-5 needs the repo to be
   called `vorza`. Doing the rename before the portfolio packaging means every
   README link, screenshot alt and commit in Phase 7 points at the final name
   exactly once.

## 3. Phase 3 — Redesign (Vorza look, system-preference themes)

Design contract: `docs/DESIGN_SYSTEM.md` extended to light + dark
(`prefers-color-scheme`), **one accent**, 1 px hairlines, 12-col asymmetric
layout, mono data labels, charful serif/grotesk headings, Geist/HH UI,
JetBrains Mono. Banned: purple-pink gradients, glassmorphism, emoji icons,
centred-everything, "seamless/next-gen" copy, fade-up everywhere.

| ID | Item | Effort | Done when |
| --- | --- | --- | --- |
| W1 | **R1 — PR-review citation validation** (backend-first) | M | dropped uncited flags + persisted `dropped_flags` count; `ReviewFlag` carries optional validated `line_start`/`line_end`; changed files derived from diff, not the model; flags capped |
| W2 | System-preference themes: token set → `:root[data-theme]` + media query, every component token-driven | M | `prefers-color-scheme: dark` renders dark, light renders light; no hard-coded `bg-white`/`text-gray-*` left in `features/`; contrast passes for both themes |
| W3 | **done** — Landing redesign: hero with live demo-map embed, scroll-zoom story, blast-radius hover demo, PR review card with citation chips, animated metrics, mono labels | L | `frontend: cartographic demo map system (W3)` `73352c3` + `frontend: assemble the redesigned landing (W3)` `2827169`; hero renders the real force renderer + `encoding.ts` rules on the labelled demo dataset, scroll re-zooms the story, hover shows blast radius (`DemoMap.tsx` `blastRadius`), review card cites `file:line` chips (`ReviewDemo.tsx`), metrics animate to dataset-derived values |
| W4 | **done** — App chrome + dashboard polish to match tokens (Navbar, RepoCard, Login) | M | `frontend: chrome token drift fix (W4)` `c96ccfd`; sweep of every `src/**/*.tsx` found exactly one drift — `RepoCard` failure text used `text-amber-600 dark:text-amber-400` (a literal palette colour + a banned `dark:` variant); replaced with the canonical `text-signal-warn` token. Navbar/Login/Dashboard audited: their shadcn aliases all map onto the design tokens (`--border: var(--line)` etc.) so no changes. Screenshots: light verified live; dark needs the OS toggle (see gate) |
| W5 | Graph a11y: keyboard-focusable nodes + table/list alternative view (**R8**) | M | Tab reaches nodes, Enter opens inspector, a `<table>` view of files exists on `/repos/:id`, no axe violations on graph + landing |
| W6 | **done** — "How I built it" section + 60 s demo video (asset) | M | section shipped in W3 landing (`2827169`, 06 Field notes) with the real-number strip: 172 backend tests, 142 frontend tests, 81% backend coverage, Render + Vercel + Neon (counts refreshed again in Phase 4, `e2c85e8`); script written to `docs/DEMO_VIDEO.md` (60 s, real demo flow, seeded repos); shooting/editing is P3 (Phase 7) |
| W7 | Hygiene batch: **R3** vitest ≥4.1.11 + pytest ≥9.0.3 + **R4** delete stale `services/requirements.txt` + **R5** delete dead throttle methods + **R7** `GET /health` | S | `npm audit` crits cleared; `pip-audit` 0; `npm run build` clean; `/health` returns `{status, version}` |

Phase 3 gate (live results): build green; Lighthouse a11y on the live landing
**100/100, zero binary failures** (`npx lighthouse --only-categories=accessibility
https://vorza-sigma.vercel.app`, run 2026-10-06); login page Lighthouse pending.
Repo page sits behind GitHub OAuth so a Lighthouse run on it needs the user's
authenticated browser (same OS-toggle rule as dark): both remain user-side
verification. Light verified in a real browser (harness), dark via the contrast
script (all >= 4.5:1) + user OS toggle. W1 tests green. Also fixed live: the
production build pointed every canonical/`og:url` at the retired
`frontend-bhagyansh.vercel.app` via `VITE_SITE_URL`; the env var now holds the
real origin and the next deploy carries it.

## 4. Phase 4 — SEO / static marketing

| ID | Item | Effort | Done when |
| --- | --- | --- | --- |
| S1 | **done** — **R11 — set `VITE_SITE_URL`** + wire canonical/`og:url`/sitemap to it | S | `VITE_SITE_URL` set in the Vercel dashboard; the build absolutizes the canonical, all `og:url`/`og:image` and the JSON-LD `url`/`image` against it (`338cbb9`); live-verified: every URL on `/` points at `https://vorza-sigma.vercel.app` |
| S2 | **done** — Crawlable landing without SSR | M | committed pre-render + build injection: `frontend/prerender/landing-root.html` (regenerated by `scripts/seo-render.mjs`) is injected into `dist/index.html` (`d0af1ec`, `338cbb9`, `8e52483`, `5b14432`); Vercel serves `/` as the full landing (97 kB, JSON-LD, no empty `#root`); app deep links stay shells via `dist/shell.html`. Hydration deliberately rejected because React 18.3 hard-fails on post-simulation DOM mismatches, see `src/main.tsx` |
| S3 | **done** — JSON-LD + OG correctness pass | S | static `application/ld+json` `SoftwareApplication` with absolute `url`/`image` (`338cbb9`), parses clean; `og-image.png` re-rendered 1200x630 Vorza lockup (`d0af1ec`); `og:image`/`twitter:image`/JSON-LD `image` live-verified absolute. Social unfurl eyeball stays a manual step (needs a browser) |
| S4 | **done** — Post-deploy crawl verification | S | live 2026-10-07: `/` = full landing; `/login`, `/dashboard`, `/repos/:id` = 200 shell with correct head; robots disallows `/dashboard` + `/repos/` with an absolute sitemap URL; `sitemap.xml` lists `/` + `/login` absolute; Lighthouse a11y 100/100 on landing + login |

Phase 4 gate (live results, 2026-10-07): a crawler sees the full landing
content (no `<div id="root">`-only shell), JSON-LD + OG + sitemap all absolute,
robots correct, no dead internal links, Lighthouse a11y 100/100 on landing and
login. Search Console submission stays a manual step (`docs/MANUAL_STEPS.md`
section 7; indexing itself takes days-weeks).

## 5. Phase 5 — Testing / CI+

| ID | Item | Effort | Done when |
| --- | --- | --- | --- |
| T1 | **done** — Playwright smoke E2E: login(mocked GitHub), connect, analyze, see graph, post comment, review card | M | 5-8 E2E specs green locally + in CI (chromium only, 3 parallel shards). Shipped: test-double server (`frontend/e2e/server.mjs`, `1de5bc1`), 7 specs (`c10a6be`), 3-shard workflow (`a0a821f`). 7/7 green locally and in the E2E workflow on every subsequent master push |
| T2 | **done** — Lighthouse CI on the public origin (landing + login, mobile + desktop) | S-M | LHCI gate green via `.github/workflows/Lighthouse.yml` (`d3dfea7`, `92630d4`): a11y >= 95 and perf >= 85 on landing, a11y >= 95 (perf floor 70) on login, both presets, measured live first (landing perf 90 mobile / 99 desktop; login 80 / 96; a11y 100/100 all). PR comments not wired: needs the Lighthouse CI GitHub app on this private repo (`docs/MANUAL_STEPS.md` section 9) |
| T3 | **R2 — react-router v6 → v7** | M | `npm audit --omit=dev` clean; `safe-redirect.ts` tests still green; router suite passes |
| T4 | **D3 — quantitative bundle gate**: `vite build` emits size report, script fails on regression > 5% | S | CI fails if initial JS gzip grows > 5% vs baseline |
| T5 | **R6 — snapshot trimming** job (keep latest N = 20 per repo) + **R10 — ETag/`If-None-Match`** on `GET /snapshots/latest` | M | oldest snapshots pruned with test; conditional GET returns 304; dashboard polls 304 after first fetch |
| T6 | **R9 — OAuth `state` single-use** (TTL cache, atomic check-and-insert) | M | a twice-redeemed `state` fails verification (test exists); docstring claim matches behaviour |

Phase 5 gate: E2E + LHCI green, audits clean, router migration shipped with
guards intact, trimming/conditional-GET tested.

Phase 5 status (2026-10-08): T1 E2E green locally (7/7, chromium, 3 shards) and
in CI; T2 Lighthouse green on the public origin (landing perf 90 mobile / 99
desktop, a11y 100/100; login perf 80 mobile / 96 desktop, a11y 100/100). T3-T6
shipped earlier (react-router 7, bundle gate, snapshot trim + ETag, OAuth state
single-use). PR-comment mode in the Lighthouse workflow still needs the
Lighthouse CI GitHub app install (`docs/MANUAL_STEPS.md` section 9).

## 6. Phase 6 — Free deploy plan + branding (`vorza`)

| ID | Item | Effort | Done when |
| --- | --- | --- | --- |
| D1 | Repo rename `codeatlas` → `vorza` (GitHub rename + local folder + remote update) + sweep of stale `codeatlas` names in docs/scripts/README | M | fresh clone of `vorza` builds; `grep -ri codeatlas` finds only historical/audit citations that are labelled as such |
| D2 | Domain consolidation: `vorza.dev`-style domain on Vercel (canonical), Render backend host stays; update `.env.production` + dashboards; DNS + certs on free tier | M | `https://<domain>` serves the app, `og:url`/sitemap use it, backend URL unchanged, no mixed-content warnings |
| D3 | Post-domain verification: crawl, OG unfurl, sitemap resubmit, robots | S | S1-S4 checks re-run green against the final domain |
| D4 | Guard rail for `frontend/.env.production` staleness (comment + dashboard-first rule already documented; verify both agree) | S | `.env.production` values == dashboard values; comment updated with new domain. Parity **verified 2026-10-08**: served bundle inlines `VITE_API_URL=https://codeatlas-qr0e.onrender.com`, live canonical/og:url resolve to `https://vorza-sigma.vercel.app/` (dashboard `VITE_SITE_URL`); a dated re-verification note added to the file. Comment gets the new domain after D2 lands |

Phase 6 gate: fresh clone of renamed repo deploys to both hosts; canonical
domain crawls green; audit still clean.

## 7. Phase 7 — Portfolio packaging

| ID | Item | Effort | Done when |
| --- | --- | --- | --- |
| P1 | README rewrite (Vorza): what/why, live links, screenshot + video embed, quickstart, architecture map, honest limits, licence | M | a stranger reproduces the stack from README alone; no stale `codeatlas`/old numbers |
| P2 | `RESUME_BULLETS.md` refresh to current measurements (160/110 tests, 80% coverage, live URLs, W1 receipts) — old "170 tests/69.5%" numbers replaced | S | every bullet cites a commit or path:line; no metric that can't be reproduced |
| P3 | Demo video cut to 60 s (from W6 script) + `og-image` re-render | M | video hosted (free: YouTube unlisted / Vercel blob), embedded in README + landing |
| P4 | Launch-visible checklist: repo topic/description, licence, screenshots in both themes, issue template, security section | S | repo page shows topics, description, cover image, licence |
| P5 | Visibility decision (user's call): keep private / make public — offer git-history rewrite first to drop legacy `brain/` names and old embarrassments | — | decision recorded; history rewritten if going public, then verified 2x |

Phase 7 gate: portfolio tour takes 60 s and every claim has a receipt.

## 8. Carry-over fixes mapped (all R-items)

| R-item | Phase | Item |
| --- | --- | --- |
| R1 | 3 (W1) | citation validation — **first** |
| R2 | 5 (T3) | react-router v7 |
| R3 | 3 (W7) | dev audit noise |
| R4 | 3 (W7) | stale manifest |
| R5 | 3 (W7) | dead throttle methods |
| R6 | 5 (T5) | snapshot trimming |
| R7 | 3 (W7) | `/health` |
| R8 | 3 (W5) | graph a11y + list view |
| R9 | 5 (T6) | OAuth state single-use |
| R10 | 5 (T5) | conditional GET |
| R11 | 4 (S1) | VITE_SITE_URL |
| R12 | 5 (T1-T2) | E2E + Lighthouse CI |

## 9. Not now (explicit)

| Item | Why not now |
| --- | --- |
| F8 snapshot comparison | nice-to-have; no recruiter signal; data exists — cheap to add later |
| F9 public share link | best backlink play, but Phase 6 domain must land first; defer to post-launch |
| F10 cost/time budget UI | internal limit exists; free-tier budget story is already honest in docs |
| F14 GitHub App read-only scoping | real work + new GitHub app; current OAuth app works; revisit if write-access is ever a concern for a public deploy |
| Tailwind 3 → 4 (part of old F13) | build-time-only advisories; redesign (W2-W4) touches the same tokens — do it after W2 if at all, not before |
| WebGL/canvas graph renderer | most repos ≤ 2k files where SVG is fine; stated honest limit beats unverifiable perf work on a free build |
| Vector DB, MQ, teams, mobile graph, plugin system | carried over from first-pass roadmap §"Explicitly not planned" |

## 10. Order at a glance

```
Phase 3:  W7 hygiene (S) → W1 citations (M) → W2 themes (M) → W5 a11y (M)
          → W3 hero + story (L, depends on W1) → W4 chrome (M) → W6 video script (M)
Phase 4:  S1-S4 (S,M,S,S)
Phase 5:  T1-T6 (M,S,M,S,M,M)
Phase 6:  D1-D4 (M,M,S,S)
Phase 7:  P1-P5 (M,S,M,S,–)
```

Total remaining: ~1 high, 6 medium, 5 low (Phase 1); plus redesign/SEO/CI
workstreams above. Every phase ends with a stop — no phase starts until the
previous one's gate is green and the "go" is given.