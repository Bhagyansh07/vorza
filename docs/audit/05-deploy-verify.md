# 05 — Deploy and verification

Phase 5. What is live, what is dead, what the repo now guarantees, and what still
needs a human with browser access.

---

## Live status, verified 2026-10-05

Every URL below was actually requested.

| Component | URL | Status |
|---|---|---|
| Backend | `https://codeatlas-qr0e.onrender.com/openapi.json` | **200.** Live. |
| Backend | `https://codeatlas-qr0e.onrender.com/health` | **404** — there is no `/health` route |
| Frontend | `https://frontend-bhagyansh.vercel.app` | **404** |
| Frontend | `https://frontend-mu-jet-18.vercel.app` | **404** |
| Database | — | none; the live backend is SQLite on an ephemeral disk |

### Two findings from that table

**The frontend deployment is gone.** Both hostnames recorded in the repo return
404, so the Vercel project no longer serves. This resolves the ambiguity recorded
in `docs/audit/00-recon.md:217` — not by picking the right URL, but by showing
that *neither* candidate is live. A new project has to be created.
`docs/MANUAL_STEPS.md` section 3 covers it.

**The backend is running old code.** Its `/openapi.json` describes
`/repos/{repo_id}/analyze` as "Agent 2 implements `services.analysis.analyze_repo`;
for now the stub just logs", which predates the orchestrator. Render has not
redeployed recent `master`.

This also means the security headers and rate limiting added in `a5aba61` are
**not** on the live service yet. Verified absent before the change; still absent
now.

---

## What the repo now guarantees

Both deploy targets are configuration-as-code and reviewable in a diff.

### Backend: `render.yaml`

| Property | Value | Reason |
|---|---|---|
| Runtime | Docker, context `./backend` | Render's native Python runtime needs a `requirements.txt`; this repo uses `pyproject.toml`. |
| Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | |
| Pre-deploy | `alembic upgrade head` | Runs against the *new* release before it takes traffic, so a failing migration stops the deploy instead of racing the code. |
| Health check | `/openapi.json` | Verified 200 on the live service. There is no `/health`. |
| Region | `oregon` | Match the database region. |
| Plan | `free` | |

**`render.yaml` deliberately declares no `databases:` block.** Verified against
vendor docs on 2026-10-05:

| | Render free web service | Render free Postgres | Neon Free |
|---|---|---|---|
| Persistent disk | **No** | Yes | n/a |
| Expiry | none | **30 days after creation**, then 14-day grace, then data deleted | **No expiry** |
| Storage | container layer only | 1 GB | 1 GB/project |
| Instances | 750 hrs/workspace/month | **1 per account** | 100 projects |
| Exceeding limits | — | database deleted | compute suspended |

Sources: [Render free tier](https://render.com/docs/free),
[30-day expiry changelog](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90),
[Neon plans](https://neon.com/docs/introduction/plans).

Render's free Postgres expires on a clock measured from *creation*. It does not
reset with use, so a weekly ping does not keep it alive. I had this wrong in an
earlier revision of the blueprint and corrected it in `2ee4816` after checking the
docs rather than trusting memory.

For this project it is strictly worse than the ephemeral disk: the disk already
loses data on every restart, and this would lose it again after 30 days from a
service that looks perfectly durable until the day it is not.

**Neon Free has no expiry** and suspends compute rather than deleting data when
you exceed a limit. That is the recommendation, and the manual steps have the
click-by-click.

#### URL normalisation verified

Neon hands out a pooled URI with query parameters, and people paste the legacy
`postgres://` scheme. All four real shapes normalise correctly:

| Input | Result |
|---|---|
| `postgresql://u:p@ep-x.us-west-2.aws.neon.tech/vorza?sslmode=require&channel_binding=require` | `postgresql+psycopg://...`, query preserved |
| same without the pooler parameter | `postgresql+psycopg://...` |
| `postgres://u:p@h:5432/vorza` | `postgresql+psycopg://...` |
| `postgresql://u:p@h:5432/vorza` | `postgresql+psycopg://...` |

The rewrite is prefix-only, which is why the parameters survive. `psycopg[binary]`
is already a main dependency, which matters because `Dockerfile:13` runs
`pip install --no-cache-dir .` — main dependencies only.

### Frontend: `vercel.json`

```json
{ "rootDirectory": "frontend",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [ /* assets immutable, index.html no-cache, HSTS + nosniff */ ] }
```

The rewrite was **missing before this pass** — the file was just
`{"rootDirectory":"frontend"}` — so every deep link was a 404 in production.
`/login` was only reachable because the OAuth redirect happened to land before a
route change.

### CI: `.github/workflows/CI.yml`

Three jobs, all passing on `master` at `2ee4816`:

| Job | Steps |
|---|---|
| `backend` | `pip install -e . --group dev`, `ruff check`, `ruff format --check`, `mypy app`, `pytest --cov --cov-fail-under=60` |
| `frontend` | `npm ci`, `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build` |
| `docker-build` | builds the backend image from `backend/Dockerfile` and the frontend image |

The backend install uses `--group dev`, not `.[dev]`. The dev tools are a PEP 735
dependency-group; `.[dev]` resolves to an extra that does not exist, which is why
CI was installing neither ruff nor pytest.

---

## The data-loss bug, closed

This was the deployment's real defect and it is worth stating separately.

Render free web services have **no persistent disk**. It is wiped on every
restart, redeploy and instance move. The backend fell back to
`sqlite:///./data/vorza.db`, so every connected repository vanished — documented in
`HANDOVER.md:51-62`.

Two independent causes, both fixed:

**1. The database.** `DATABASE_URL` now points at an external Postgres. The
backend already supported it (`app/core/db.py`, with a scheme normaliser); nothing
needed changing except the deploy config.

**2. The migration history, which would have failed on first contact.** Found by
building the schema both ways and diffing them:

- `0001_initial` created `analysesnapshot`; SQLModel derives `analysissnapshot`
  from the class name `AnalysisSnapshot`. So on any migrated database, every
  snapshot read hit `no such table: analysissnapshot`.
- `AiReviewRow` (`aireviewrow`) was never migrated at all, so every PR review
  insert failed.

Both were invisible because the lifespan called
`SQLModel.metadata.create_all(engine)` unconditionally, which creates tables
under the *models'* names and papered over the wrong one.

Verified against revision `0001` directly: `analysissnapshot` absent, `aireviewrow`
absent. Fixed by `0002`, and `tests/test_migrations.py` now fails CI if the two
ever drift again.

**And `create_all` no longer runs where it would mask a missing migration.**
`app/core/schema.py` decides who owns the schema: a stamped database is left
completely alone; one with no revision gets `create_all` and is then stamped, so a
later `alembic upgrade head` is a no-op rather than a crash on `CREATE TABLE user`
for a table that already exists.

Pointing this app at a managed database would have failed on the first snapshot
read. It is fixed, and the fix is verified rather than assumed.

---

## Free-tier limits, stated honestly

| Limit | Consequence for Vorza |
|---|---|
| Backend sleeps after 15 min idle, ~1 min to wake | Every visitor after a quiet period waits. Affects crawlers too. |
| 750 instance-hours per workspace per month | Two always-on services would exceed this. One is fine. |
| 512 MB RAM, 0.1 CPU | Analysis over a large repo may be slow or OOM. F10 in the roadmap. |
| Neon 100 CU-hours/project/month | Adequate. Scale-to-zero after 5 min keeps it low. |
| Neon 1 GB storage | ~1,000 repos with snapshots. Not a near-term concern. |
| Vercel Hobby | Fine. Bandwidth caps exist and are not currently close. |
| Ephemeral checkouts | Analysis clones go to the container layer and are lost on restart. Acceptable: only *results* are persisted, not clones. |

None of these is a blocker. All of them are a ceiling, and pretending otherwise
would be the dishonest choice.

---

## Still requires a human

Not simulated, not faked. Click-by-click in `docs/MANUAL_STEPS.md`.

| Step | Why it cannot be automated |
|---|---|
| Create the Neon project | Needs an account and a password |
| Apply the Render blueprint | Needs Render account access |
| Set the 6 secret env vars | Needs the values |
| Create the Vercel project | Needs Vercel account access |
| Create the GitHub OAuth app | Needs a GitHub account; the callback URL must match exactly |
| Create the GitHub webhook | Needs repo admin |
| Search Console property | Needs ownership verification |
| Custom domain + DNS | Needs a registrar |

---

## Verification commands

After deploying:

```bash
FRONTEND="https://<your-frontend-domain>"
BACKEND="https://<your-render-service>.onrender.com"

# 1. Backend up, not on SQLite (check the Logs tab for the schema line).
curl -s -o /dev/null -w '%{http_code}\n' "$BACKEND/openapi.json"     # 200

# 2. Hardening headers present (they were absent before a5aba61).
curl -sI "$BACKEND/openapi.json" | grep -iE 'x-content-type|x-frame|strict-transport|referrer-policy'

# 3. Rate limiting answers rather than locking you out.
curl -s -o /dev/null -w '%{http_code}\n' "$BACKEND/me"                # 401

# 4. Webhook is fail-closed: unsigned payload must NOT be 200.
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BACKEND/webhooks/github" \
  -H 'Content-Type: application/json' -d '{"action":"opened"}'       # 401/503

# 5. Deep link resolves (the SPA rewrite that used to be missing).
curl -s -o /dev/null -w '%{http_code}\n' "$FRONTEND/login"            # 200

# 6. Landing page has real HTML a crawler can read.
curl -s "$FRONTEND/" | grep -c 'force-directed'                      # non-zero

# 7. Canonical is the deployed origin.
curl -s "$FRONTEND/" | grep -o '<link rel="canonical" href="[^"]*"'

# 8. Sitemap and robots agree with that origin.
curl -s "$FRONTEND/robots.txt"
curl -s "$FRONTEND/sitemap.xml"

# 9. The bundle points at the backend, not at itself.
curl -s "$FRONTEND/" | grep -o '/assets/index-[^"]*\.js' | head -1
```

Then confirm the data actually persists — the bug this phase closed:

1. Connect a repo through the UI.
2. Render -> your service -> **Restart** (or wait for an idle spin-down).
3. Sign in again. The repo should still be there.

If it is not, `DATABASE_URL` is wrong or unset, and the service is silently on
SQLite again. Check the Logs tab.

---

## Status

**Partial.**

| Item | Status |
|---|---|
| Backend deploy config as code | **done** — `render.yaml` |
| Frontend deploy config as code | **done** — `vercel.json` |
| CI green on `master` | **done** — 3 jobs passing |
| Postgres persistence | **done in code**, **blocked** on creating the Neon project |
| Migration history correct | **done** — verified against revision 0001 |
| Live frontend | **blocked** — needs a new Vercel project |
| Live deploy after these changes | **blocked** — needs account access |
| Data survives a restart | **NOT VERIFIED** — can only be confirmed on a live deploy |
| Docker Compose stack | **blocked** — no Docker on this machine. The Dockerfile itself is built by CI. |

The honest summary: the configuration is correct and reviewable, and the two bugs
that would have broken the deploy are fixed and tested. What cannot be done from
here is the deploy itself.