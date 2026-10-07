# CONTRACTS.md — v0.2 (living document)

This is the single source of truth for the shapes the frontend and backend code
against. **Edit this file the moment you change any of them.** Anyone who built
against the old shape needs to know.

> **v0.2 corrects v0.1 in several places.** Where v0.1 was wrong about the live
> server, that is now stated below rather than quietly fixed. The changes that
> would break an existing consumer are listed in the change log.

## Core data models

```
User        { id, email, github_username, created_at }
Repo        { id, owner_id, github_full_name, connected_at, default_branch,
              last_analyze_error }  # null until the latest analyze attempt failed
AnalysisSnapshot {
  id, repo_id, created_at,
  files: [ FileNode ],
  overall_health_score: float  # 0-100, higher = healthier
}
FileNode    { path, loc, complexity_score, churn_score, health_score, imports: [path] }
Comment     { id, repo_id, snapshot_id, file_path, author_id, body, x, y, created_at }
AiReviewRow { id, repo_id, pr_number, risk_score, summary, flags, updated_files, dropped_flags, created_at }
```

### Corrections to v0.1

| Field | v0.1 said | Reality |
|---|---|---|
| `AiReviewRow` | **absent from this section entirely** | It is a real model (`app/models/snapshot.py`) and was missing from v0.1. Added above. |
| `health_score` | documented, no thresholds given | `>= 70` good, `>= 45` warn, below that bad. These thresholds are the single source of truth for node colour and for the graph legend. |
| `Comment.x` / `.y` | unlabelled | Normalised `0..1` fractions of the canvas, **not** pixels. A pin therefore survives a resize and a zoom change, and the gateway rejects non-finite coordinates. |
| `AnalysisSnapshot.files` | `[ FileNode ]` | Correct. Stored as JSON per snapshot, so historical snapshots each carry their own file set — which is what makes snapshot diffing possible later. |

## REST API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/github/login` | **New in v0.2.** Returns the GitHub authorize URL and a `state` value. The backend owns the whole OAuth flow. Each call mints a fresh single-use `state` (expires after 10 min; a redeemed state cannot be reused). |
| POST | `/auth/github/callback` | GitHub OAuth login. The `state` is spent once: a second redemption with the same `state` returns 400. |
| GET | `/me` | Current user |
| POST | `/repos` | Connect a new GitHub repo |
| GET | `/repos` | List connected repos |
| GET | `/github/repos` | **New in v0.3.** List the user's GitHub repos for the connect picker (small projection of `GET /user/repos`) |
| DELETE | `/repos/{id}` | **New in v0.3.** Disconnect a repo; snapshots, comments and reviews cascade-delete |
| GET | `/repos/{id}/snapshots/latest` | Latest analysis snapshot (the graph data). Sends a strong `ETag`; `If-None-Match` matching it returns `304` (R10) |
| GET | `/repos/{id}/snapshots/history` | Trend data for charts. Only the newest 20 snapshots per repo are kept; older rows are pruned on the analyze write path (R6) |
| POST | `/repos/{id}/analyze` | Trigger a manual re-analysis |
| POST | `/webhooks/github` | GitHub PR webhook receiver → triggers the AI review pipeline |
| GET/POST | `/repos/{id}/comments` | List / create comment pins |
| GET | `/openapi.json` | OpenAPI schema. **This is the deploy health check path** — there is no `/health` route. |

### List endpoints return an envelope

This is the most important change in v0.2. v0.1 implied
`GET /repos` returns `Repo[]`. **It does not.** Any endpoint returning a list
returns:

```json
{ "data": [ ... ], "count": 3 }
```

Each envelope is its own SQLModel response schema rather than a generic type:
`ReposPublic`, `CommentsPublic` and `SnapshotsList`, each `{ data: [...], count: int }`. The frontend unwraps exactly once, in
`lib/http-client.ts`, so no feature-level code sees the envelope. A previous
mismatch here meant the frontend read a bare array from an enveloped response
and rendered nothing.

Single-object endpoints (`/me`, `/snapshots/latest`) return the object directly,
**not** wrapped. Note the asymmetry that is easy to get wrong:
`/snapshots/history` returns a **summary** shape (`SnapshotSummary`:
`id`, `repo_id`, `created_at`, `overall_health_score`) and *not* full
`AnalysisSnapshot` objects — the per-file data is deliberately left out of the
trend endpoint, because it is chart data and the file set can be large.

### Auth and failure modes

- Every endpoint except `/openapi.json`, `/auth/github/*` and `/webhooks/github`
  requires `Authorization: Bearer <JWT>`.
- **403, not 500, for an unusable token.** If the token verifies but its `sub`
  claim is missing or not a UUID, the server returns **403**. It used to return
  500, which made an auth failure look like a server crash in the logs.
- **The webhook receiver is fail-closed.** With `GITHUB_WEBHOOK_SECRET` unset,
  `POST /webhooks/github` returns **503** rather than accepting a payload it
  cannot verify. There is no fallback secret. A v0.1-era hardcoded default was
  removed in `15a4b66`.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Strict-Transport-Security`) are on every response, and
  HTTP rate limiting returns **429** past the threshold.

## AI review output shape

```json
{
  "pr_number": 42,
  "risk_score": 0-100,
  "summary": "one paragraph, plain English",
  "flags": [
    { "file": "path", "severity": "low|medium|high", "note": "text",
      "line_start": 12, "line_end": 14 }
  ],
  "updated_files": [ "path1", "path2" ],
  "dropped_flags": 2
}
```

`line_start`/`line_end` and `dropped_flags` are optional in the model's raw
output. **The server sanitizes every review before persistence**
(`ai_review.sanitize_review`): a flag whose `file` is not among the files
visible in the (possibly truncated) diff is **dropped**; a line range that does
not intersect a changed hunk is **stripped** (the finding survives, the
invented line does not); the flag list is capped at 15. `dropped_flags` is set
to the number dropped so the UI can say "N findings dropped" honestly, and
`updated_files` is overwritten from the diff rather than trusted from the
model. The model cannot invent citations: files it never saw are rejected, and
lines are checked against the hunks it actually received.

Persisted as `AiReviewRow` above. With no `OPENAI_API_KEY` set, the orchestrator
**skips the review and logs an explicit warning** rather than failing the run.

## WebSocket events

| Event | Direction | Payload |
|---|---|---|
| `presence:join` | client→server | `{repo_id, user_id}` |
| `presence:cursor` | client↔server | `{user_id, x, y}` — `x`/`y` normalised `0..1` |
| `comment:new` | client↔server | `Comment` (see above) |
| `snapshot:updated` | server→client | `{repo_id, snapshot: AnalysisSnapshot}` |
| `review:new` | server→client | AI review output shape above |

### Behaviour that consumers must know

- **`comment:new` arrives both wrapped and bare** — as `{"comment": {...}}` and as
  the bare object. The client normalises both. This is deliberate: it matched two
  existing emitters, and forcing one shape would have broken whichever sender was
  not changed. **Changing one without the other reintroduces the bug.**
- **The gateway overwrites `repo_id` and `author_id` server-side.** A client
  cannot post a comment as another user, whatever it sends. That was an
  impersonation hole and it is closed and tested.
- **`snapshot:updated` and `review:new` are actually published.** The orchestrator
  emits both. Comments are actually persisted (`SqlCommentStore`, bound at
  startup) — before this, comments were broadcast and then discarded, so they
  appeared to save and vanished on refresh.
- Reconnection uses exponential backoff with jitter: 500 ms → 1 s → 2 s. The
  jitter window is applied to each value, so a retry is never exactly on the
  nominal delay.

## Frontend route map

```
/                       → public landing page. INDEXABLE.
/login                  → GitHub sign-in + OAuth callback handler. INDEXABLE.
/dashboard              → list of connected repos          noindex
/repos/:id              → the live graph                    noindex
/repos/:id/history      → trend charts                    noindex
*                       → 404                             noindex
```

### Route map changes in v0.2

`/` was previously a redirect into the protected dashboard. It is now a **public
landing page**, because a redirect into an auth wall serves crawlers an empty
`<div id="root">` — the site had zero indexable pages before this change. The
dashboard is unmoved; `/dashboard` behaves exactly as v0.1 described.

Authed routes are `noindex, nofollow`, including the 404. Indexing a page that
redirects to `/login` wastes crawl budget on a URL that can never rank.

## Database

Migrations are authoritative. **Do not rely on `create_all` to create anything in
a deployed environment.**

`app/core/schema.py` decides who owns the schema:

- a database with a stamped Alembic revision is left **entirely** to the
  migrations
- a database with no revision gets `create_all` and is then stamped at head, so a
  later `alembic upgrade head` is a no-op instead of crashing on an existing
  table

Migrations must match the models exactly. `backend/tests/test_migrations.py`
builds the schema both ways and diffs it, so a mismatch fails CI. This caught two
real defects that were invisible behind an unconditional `create_all` — see
`docs/audit/06-summary.md`.

## Change log

- **v0.2** — list-envelope wrapper (`ListEnvelope[T]`); 403 instead of 500 for an
  unusable token `sub`; fail-closed webhook (503, no fallback secret); security
  headers and rate limiting; `AiReviewRow` documented for the first time; `/`
  became a public indexable landing page; `x`/`y` documented as normalised; health
  score thresholds documented; `/openapi.json` documented as the health check
  path; realtime behaviour documented (persisted comments, published events,
  server-side `author_id`, dual-shape `comment:new`).
- **v0.1** — initial contract draft, ships with the kit.