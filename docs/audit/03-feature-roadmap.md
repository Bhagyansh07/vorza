# 03 — Feature roadmap

Phase 3. What Vorza should build next, ordered so each item is verifiable before
the next one starts.

**Constraint that shapes everything here:** the app must stay deployable on free
tiers, and the backend must remain small enough to read in an afternoon. That is
a deliberate product boundary, not a limitation to apologise for.

**Important scope note.** `brain/01_PRD.md` and `brain/02_TRD.md` are unfilled
templates. I did not invent PRD content to fill this roadmap, and I did not
guess at features the specs imply. Everything below is derived from what the code
already does, what the audit measured, or what is a visible gap in the running
product.

---

## Shipped in this pass

Listed so the roadmap starts from the current state, not a stale one.

| ID | Item | Commit |
|---|---|---|
| F0 | Real WebSocket client replacing the mock realtime source | `05ccbe7` |
| F0 | `SqlCommentStore` bound at startup (comments were broadcast then discarded) | `05ccbe7` |
| F0 | `snapshot:updated` / `review:new` published from the orchestrator | `05ccbe7` |
| F0 | Gateway impersonation hole closed | `05ccbe7` |
| F0 | Envelope unwrapping matching the real backend | `f768b33` |
| F0 | Public indexable landing page, sitemap, OG card, manifests | `f2e5710` |
| F0 | Migration history aligned with models + Postgres deploy | `b5c314c` |
| F0 | 403 instead of 500 on an unusable token subject | `74e4fa3` |
| F0 | One API layer instead of three | `74e4fa3` |

---

## Next: P0 — makes the product actually usable

### F1 — Verify the deploy end to end

**Why first:** every other feature is unverifiable until there is a live frontend.
Both previously-recorded Vercel URLs return 404, so there is currently no live
frontend at all.

**Scope:** follow `docs/MANUAL_STEPS.md` sections 1-5. This is mostly not code.

**Done when:**
- `GET /openapi.json` on Render returns 200
- Render logs show `Alembic owns the schema` or a stamped `create_all`
- A cold `GET /` on Vercel returns the landing page HTML
- Sign in with GitHub end to end, connect a repo, see the graph
- A repo survives a backend restart (this is the data-loss bug, closed)

**Risk:** the whole point is that it is untested. Keep a rollback path — the
existing `codeatlas-qr0e.onrender.com` service should keep running until the new
one is proven.

---

### F2 — Empty states that teach

**Why:** a new user's second screen is `/dashboard`, and it currently shows
nothing. The `ConnectRepoDialog` is one click away but nothing says so.

**Scope:**
- `/dashboard` with no repos: explain what Vorza does, one primary button that
  opens `ConnectRepoDialog`, and one sentence on what permissions it asks for.
- `/repos/:id/history` with no snapshots: "run an analysis to start tracking
  health" with a button that triggers one.
- `/repos/:id` with no snapshot: same, plus a note that the map appears after
  the first analysis.

**Done when:** every route has a distinct, useful empty state, and none of them
contains the word "loading".

**Explicitly not:** a generic "No data" string with an illustration. The empty
state is the highest-leverage teaching surface in the product.

**Blocked on:** F1, because copy should be written against the real thing.

---

### F3 — Graph legend

**Why:** the graph colours nodes by health and nothing explains it. First-time
viewers see a pretty picture with no read on what the colours mean.

**Scope:** a compact legend — the three status swatches with their labels, and one
line stating that radius is LOC-weighted while colour is health.

**Done when:** the thresholds in the legend are the *same constants* the renderer
uses. Do not retype `70` and `45` into a legend component; import them. Otherwise
the legend becomes a second source of truth that silently drifts.

**Note:** the thresholds currently live inline in the graph's colour mapping.
Extracting them to a shared module is part of this task, not an optional extra.

---

## P1 — makes it feel finished

### F4 — Analysis feedback

**Why:** `analyze_repo` is a background task. Clicking the button gives no
progress and no completion signal, so the natural thing a user does is click
again.

**Scope:**
- Disable the trigger while a run is in flight
- Show queued → running → done, driven by the `snapshot:updated` socket event
  that already exists
- Surface a real error when the run fails

**Done when:** the button reflects state and a completed run produces a visible
change without a manual refresh.

**Note:** this is mostly free — `publish_snapshot_updated` is already wired and
`websocket.ts` already dispatches `snapshot:updated`. The work is UI.

---

### F5 — Lazy-load the chart bundle

**Why, measured:** `charts-*.js` is **356.24 kB raw / 103.75 kB gzip** —
25% larger than the entire app bundle (`292.35 kB / 94.19 kB`) — and it is used
by one component on one route.

**Scope:** `React.lazy` + `Suspense` for `TrendChart`, plus a skeleton that
matches the chart's dimensions so the layout does not jump.

**Done when:** `charts-*.js` is not requested when loading `/` or `/dashboard`,
and bundle sizes are checked in CI so this cannot regress silently.

**Blocked on:** the bundle-size check in `docs/audit/04-test-strategy.md`.

---

### F6 — Graph loading skeleton

**Why:** `/repos/:id` is the slowest perceived load (snapshot fetch, D3 layout,
render) and shows a spinner.

**Scope:** a skeleton approximating the graph area, respecting the overlay recipe
from `docs/DESIGN_SYSTEM.md`.

---

### F7 — Repo deletion

**Why:** a connected repo cannot be disconnected. Every account accumulates
repos forever, and there is no way to remove access.

**Scope:** a delete endpoint plus a confirm dialog. This is a **new API surface**,
so per `AGENTS.md` it must be added to `CONTRACTS.md` in the same commit, with the
ownership check — deleting must be scoped to the owner, or it is a
vulnerability rather than a feature.

**Done when:** a user can remove a repo they connected, and *only* a repo they
connected.

---

## P2 — makes it worth returning to

### F8 — Snapshot comparison

**Why:** history plots one line. A diff between two snapshots — which files got
worse, which got better — is the thing a reviewer actually wants.

**Scope:** pick two snapshots, show added/removed/changed files with deltas in
health and complexity.

**Note:** `AnalysisSnapshot` stores `files` as JSON per snapshot, so the data is
already there. This is mostly a diff algorithm and a UI.

---

### F9 — Public share link for a map

**Why:** the strongest backlink play, and it compounds. A shareable map with OG
tags earns links that a landing page cannot.

**Scope:** a read-only tokenised URL per repo, excluded from the sitemap, marked
`noindex`, with its own OG tags generated per repo.

**Security requirement:** read-only, single-repo, expiring, and explicitly *not*
derived from the auth token. Deriving it from the JWT would produce a URL that
expires when the session does, which defeats the point.

---

### F10 — Cost and time budget for an analysis

**Why:** analysis clones a repo and runs complexity scoring over every file. On a
large repo that is slow, and on the free tier it can exhaust the 512 MB.

**Scope:** surface file count, per-phase timing, and a clear failure when a repo
exceeds a sane limit — instead of a silent timeout or an OOM.

---

## P3 — polish

| Item | Value | Cost |
|---|---|---|
| Keyboard navigation for the graph | Real accessibility win, and the graph is keyboard-hostile today | High |
| Saved views / filters | Useful once you have >5 repos | Low |
| Webhook retry visibility | GitHub retries silently; you cannot tell if a review failed | Medium |
| `llms.txt` | Vanity file; skip unless there is real content | Trivial |
| Light theme | The tokens are ready for it. Only worth it if asked for | Medium |

---

### F11 — Make the OAuth `state` genuinely single-use

**Why:** `services/github.py` documents the `state` as "opaque, single-use", and
it is neither. It is `<nonce>.<hmac>` with no timestamp and no record of spent
nonces, so a captured state verifies forever and can be replayed. The docstring
now says so; the behaviour does not.

**Practical impact is low but the gap is real.** The `code` is single-use on
GitHub's side, so a captured `(state, code)` pair cannot mint a second session,
and pairing a valid state with an attacker's own code only logs the attacker in
as themselves. So this is not an account-takeover path today. It is a claim the
code does not back up, which is worse than the bug it describes.

**Scope:** store spent nonces with a TTL, check-and-insert atomically in
`verify_oauth_state`, and let a periodic task or the insert itself expire them.
A cache with a TTL is enough; it does not need to be a table.

**Done when:** a `state` that has already been redeemed fails verification, and
there is a test that reuses the same `state` twice and asserts the second
attempt is rejected. The security value of `state` is CSRF protection, and that
part already works — this closes the mismatch between the code and its
documentation.

**Why P2 and not P0:** the current behaviour is not exploitable, so nothing is
at risk while this waits. It is filed because leaving a false security claim in a
docstring is how a real one gets missed later.

---

## Explicitly not planned

Stating what is deliberately absent, with the reason, is more useful than a
backlog that grows forever.

| Not building | Why |
|---|---|
| Vector database for embeddings | No retrieval problem yet. Adding one is architecture for its own sake. |
| Message queue | Background tasks run in-process. At hobby scale that is correct. |
| Multi-tenant teams | The auth model is GitHub OAuth, single-user. Teams is a different product. |
| Self-hosted Docker Compose "one command" | The compose stack is unverifiable here (no Docker). Documented as a gap rather than claimed. |
| Mobile-first graph | A force-directed graph on a phone is a bad experience. Landing page is responsive; the graph is not, and pretending otherwise would be worse. |
| A plugin system | No third-party demand yet. |

---

## Suggested order

```
F1  deploy and verify        <- blocks everything observable
F3  graph legend             <- small, self-contained, no dependency
F2  empty states             <- highest teaching value
F4  analysis feedback        <- mostly free, socket events already exist
F5  lazy-load charts         <- verified by the CI bundle check from phase 5
F6  graph skeleton           <- small
F7  delete repo              <- new API surface, needs care
--- from here, product-led ---
F8  snapshot comparison
F9  public share link        <- the best backlink play
F10 cost and time budget
F11 single-use OAuth state   <- not exploitable today; closes a false security claim
```

F1 is not a feature and it is first because without it none of the rest can be
checked by anyone but the author.