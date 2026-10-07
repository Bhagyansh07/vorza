# Manual steps

Everything in this file needs a browser, an account or a DNS record, so it cannot
be done from a commit. It is written click-by-click on purpose.

**Nothing here is invented.** Every claim about a provider's limits was checked
against that provider's own documentation on **2026-10-05** and is linked. Where
something could not be verified, it says so.

Current state, verified 2026-10-07:

| Thing | State |
|---|---|
| Backend on Render | **Live** at `https://codeatlas-qr0e.onrender.com` (Free tier, ~50 s cold start after idle) |
| Frontend on Vercel | **Live** at `https://vorza-sigma.vercel.app` (project `vorza`, linked to `master`, auto-deploy on push) |
| Database | **Neon Postgres** (Free); the live DB URL is a Render env var (`DATABASE_URL`), not committed |
| Deploy config | `render.yaml` (backend) and Vercel project settings (frontend, root dir `frontend`) |
| Site origin | `VITE_SITE_URL=https://vorza-sigma.vercel.app` on Vercel prod; canonical/`og:url`/JSON-LD follow it |
| `/` for crawlers | **Pre-rendered** (no JS): the build injects the committed `frontend/prerender/landing-root.html` snapshot into `index.html` (the file `/` serves), and keeps the untouched built entry as `shell.html` for SPA deep links. The SPA mounts over the static landing with `createRoot`. Snapshot regenerated with `npm run build && npm run prerender:root` whenever landing markup changes; `public/og-image.png` (1200x630) via `npm run prerender:og`. See section 3.3. |
| Indexable pages | `/` and `/login` (`frontend/vite.config.ts` `seoFiles()`); `/dashboard` and `/repos/*` are disallowed in `robots.txt` |

> The old domains `frontend-bhagyansh.vercel.app` and `frontend-mu-jet-18.vercel.app`
> 404 or serve stale builds. Do not link, log in, or deploy against them.

---

## Order of operations

These have dependencies. Do them in this order or you will be editing
environment variables for URLs that do not exist yet.

1. Neon database (section 1) -- you need a `DATABASE_URL` string.
2. Render backend via the blueprint (section 2) -- needs the Neon URL.
3. Vercel frontend (section 3) -- needs the Render URL, to build.
4. Back into Render, set `FRONTEND_HOST` to the new Vercel origin (section 2.5).
5. GitHub OAuth app (section 5) -- needs the Vercel and Render URLs.
6. GitHub webhook (section 6).
7. Search Console (section 7).
8. Custom domain, if you want one (section 8).
9. (Optional) Lighthouse CI comments on PRs (section 9).

---

## 1. Create the Neon database

### Why Neon and not Render's own Postgres

This was checked, not assumed:

| | Render free web service | Render free Postgres | Neon Free |
|---|---|---|---|
| Persistent disk | **No** -- wiped on restart, redeploy and instance move | Yes (it is a database) | n/a |
| Expiry | none | **30 days after creation**, then 14-day grace, then data deleted | **No expiry** |
| Storage | container layer only | 1 GB | 1 GB/project (20 GB account) |
| Instances allowed | 750 hrs/workspace/month | **1 per account** | 100 projects |
| Cold start | ~1 minute after 15 min idle | — | scale-to-zero after 5 min |
| Exceeding limits | — | database deleted | compute suspended |

Sources: [Render free tier](https://render.com/docs/free),
[Render free Postgres 30-day expiry changelog](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90),
[Neon plans](https://neon.com/docs/introduction/plans).

Render's free Postgres is a trap for this project specifically: the ephemeral
disk already loses data on every restart, and this would lose it again after 30
days, from a clock that does not reset with use. Neon Free does not delete data
when you exceed a limit -- it suspends compute until the next billing period.

### Steps

1. Go to <https://console.neon.tech> and sign up (GitHub sign-in is fine).
2. **Create a project.** Name it `vorza`. Choose the region closest to your
   Render region -- Render free is `oregon`, so pick **US West (Oregon)**.
   Cross-region to a compute that has just scaled to zero is a reliable source of
   timeouts.
3. Neon creates a `neondb` database and a `neondb_owner` role automatically.
   **Set the password** when prompted. Without it you cannot connect from
   outside, and the auto-generated password is not shown again.
4. **Connection string.** Open **Connect** in the sidebar. Choose:
   - **Pooled connection** -- yes. Neon gives you a `-pooler.` host in the
     hostname. Use this one.
   - Branch: `main`
   - **Application** driver: **Psycopg 3** (not psycopg2). The backend depends
     on `psycopg[binary]>=3.3.4`, already a main dependency, and the URL is
     normalised to the `postgresql+psycopg://` driver automatically.
5. Copy the string. It looks like:

   ```
   postgresql://vorza_owner:AbCdEf...@ep-shy-name-a1b2c3.us-west-2.aws.neon.tech/vorza?sslmode=require&channel_binding=require
   ```

   **Verified:** all four URL shapes this project might receive normalise
   correctly -- pooled with `channel_binding`, pooled without it, the legacy
   `postgres://` scheme, and a bare `postgresql://`. The scheme rewrite in
   `backend/app/core/config.py` is prefix-only, so query parameters survive.

6. Keep it safe. A Neon connection string is a password. Put it in Render's
   environment variables (section 2), never in a commit.

---

## 2. Deploy the backend on Render from the blueprint

`render.yaml` is committed, so this is configuration-as-code rather than
dashboard clicking. It was written because the previous deploy was set up by
hand, which is exactly why the data loss in `HANDOVER.md` was invisible to
anyone reading the repo.

### 2.1 Apply the blueprint

1. Go to <https://render.com> and sign in.
2. **Blueprints** in the left sidebar -> **New Blueprint Instance**.
3. Connect the repository: `Bhagyansh07/codeatlas`. It is private, so you need
   to grant Render access:
   - Either use the GitHub App install and pick only this repo, or
   - Render's "connect with a personal access token" path.
4. Fill in the values the blueprint marks `sync: false`:

   | Key | Where to get it |
   |---|---|
   | `DATABASE_URL` | The Neon string from section 1 |
   | `GITHUB_CLIENT_ID` | Section 5. Do this now if you have not made the app yet, and update it after. |
   | `GITHUB_CLIENT_SECRET` | Section 5 |
   | `GITHUB_WEBHOOK_SECRET` | Invent one: `openssl rand -hex 32`. You will paste the same value into the GitHub webhook in section 6. |
   | `OPENAI_API_KEY` | Optional. Without it, analysis still runs and PR review is skipped with an explicit warning in the logs. |
   | `FRONTEND_HOST` | Leave blank for now, then fill in section 2.5. |

   `SECRET_KEY` is `generateValue: true`, so Render creates it. Do not overwrite it
   later or every issued JWT becomes invalid and everyone is logged out.

5. **Apply**. First deploy takes several minutes: it builds the Docker image from
   `backend/Dockerfile`, then runs `alembic upgrade head` as a pre-deploy command
   before the release is allowed to take traffic.

### 2.2 Watch the deploy

- **Events** tab. You want `Running preDeployCommand` to succeed. If it fails,
  read the error: it will be a migration failure, and the deploy is stopped on
  purpose so a broken schema never takes traffic.
- **Logs** tab. On boot you should see one of:
  - `Alembic owns the schema; leaving it to the migrations` -- the database was
    migrated. Correct.
  - `no Alembic revision found; creating tables from the models` -- the database
    was empty, so the tables were created and the revision stamped. Also correct,
    and `alembic upgrade head` immediately after is a no-op.
- **Settings -> Health Check Path** should be `/openapi.json`. There is no
  `/health` route; requesting one returns 404.

### 2.3 Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<your-service>.onrender.com/openapi.json
```

Expect `200`. Also check that `/docs` renders the Swagger UI.

### 2.4 About the free-tier spin-down

The service sleeps after 15 minutes without traffic and takes about a minute to
wake. The first request after a sleep will be slow. That is the free tier, not a
bug. To keep it awake you would need a pinger, but a pinger does not protect the
*database* any more than it protected SQLite -- Neon does not expire, so the data
is safe regardless.

### 2.5 Set `FRONTEND_HOST` (do this after section 3)

CORS here is an explicit allowlist, and `FRONTEND_HOST` also builds
`GITHUB_OAUTH_CALLBACK_URL` as `{FRONTEND_HOST}/login`. If it does not match your
Vercel origin exactly, every browser request fails CORS and OAuth returns to the
wrong place.

1. Render -> your service -> **Environment**.
2. Set `FRONTEND_HOST` to `https://<your-vercel-domain>` -- scheme included, no
   trailing slash.
3. **Save and Deploy**. Changing an env var on Render triggers a redeploy.

---

## 3. Create the Vercel frontend project

The old Vercel deployment is gone, so this is a new project.

### 3.1 Create it

1. Go to <https://vercel.com> and sign in with GitHub.
2. **Add New -> Project**, then **Import** `Bhagyansh07/codeatlas`.
3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend` -- required. The repo root has no
     `package.json`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`
4. **Environment Variables** -- add these (they are `VITE_`-prefixed, so they are
   baked into the browser bundle at build time; they are not secret, but they must
   be set *before* the first build):

   | Key | Value | Why |
   |---|---|---|
   | `VITE_API_URL` | `https://<your-render-service>.onrender.com` | where the frontend calls the API |
   | `VITE_USE_MOCKS` | `false` | **must** be set, and `false` is the safe value. Unset means mocks. See below. |
   | `VITE_SITE_URL` | `https://<your-vercel-domain>` | builds the canonical URL, `robots.txt` and `sitemap.xml` |

   > **`VITE_USE_MOCKS` — read this before you skip it.** It is read once, in
   > `frontend/src/lib/config.ts:11`:
   >
   > ```ts
   > useMocks: raw('VITE_USE_MOCKS', 'true').toLowerCase() === 'true'
   > ```
   >
   > So **unset means mocks on**, because `'true'` is the fallback. Set it to
   > `false` explicitly. Anything that is not literally `true` disables mocks,
   > so `false` is the value to type — do not leave it out and do not guess that
   > `1` means on.
   >
   > This is not hypothetical. A graph fetch layer used to check a *different*
   > variable, `VITE_USE_MOCK !== "false"`, which nothing set, so it defaulted to
   > mocks and production served a map of invented repos behind a normal-looking
   > UI. CI was green throughout. That layer is gone; this is now the only
   > switch.

   > **Vercel dashboard values override this file.** So set `VITE_SITE_URL` in
   > the dashboard rather than hardcoding a hostname into
   > `frontend/.env.production`. That file is tracked and went stale before
   > (it is why the repo's docs carried two dead Vercel hostnames for months).
   > `docs/MANUAL_STEPS.md` section 3.1 is the place a hostname belongs.
   >
   > `VITE_SITE_URL` is required at build time even though the app falls back to
   > `window.location.origin` in the browser. `robots.txt` and `sitemap.xml` are
   > static files and cannot know the hostname, so an unset value makes the build
   > **warn** and emit both files pointing at `http://localhost:5173`. That fails
   > silently once indexed. Watch the build log for `[vorza] VITE_SITE_URL is
   > unset`.

5. **Deploy**.

### 3.2 Verify

| Check | Expected | How |
|---|---|---|
| Deep link works | 200, not 404 | open `/login` directly. `vercel.json` has the SPA rewrite; before this pass it did not, so deep links 404'd in production. |
| Landing page is public | 200 with real text | `curl -s https://<domain>/ \| grep -i "force-directed"` |
| Robots is right origin | points at your domain | `curl -s https://<domain>/robots.txt` |
| Sitemap is right origin | your domain, 2 URLs | `curl -s https://<domain>/sitemap.xml` |
| Mocks are off | no fixtures | DevTools -> Network: the requests must go to `onrender.com`. If they do not, the bundle is serving fixtures -- see the `VITE_USE_MOCKS` note above. |
| OG image loads | 200, 1200x630 | `curl -sI https://<domain>/og-image.png` |
| Bundle points at Render | yes | `curl -s https://<domain>/assets/index-*.js \| grep -o 'https://[a-z0-9-]*\.onrender\.com'` |
| Landing is pre-rendered, not a shell | full marketing copy + `application/ld+json`, no empty `#root` | `curl -s https://<domain>/ \| grep -c "force-directed"` (expect ≥ 1) and the same for `application/ld+json`; View source shows the text, it is not JS-rendered |
| Deep links stay shells | `/login` returns the app shell, not the landing body | `curl -s "https://<domain>/login" \| grep -c "force-directed"` (expect 0) |
| Canonical / OG / JSON-LD are absolute | every URL points at your frontend origin, no `localhost` | `curl -s https://<domain>/ \| grep -oE 'href="https://[^"]*"\|content="https://[^"]*"\|"url": "https://[^"]*"'`; each host equals `<your-vercel-domain>` |

```bash
# The single most useful one: does the built bundle contain your backend URL?
curl -s https://<your-domain>/ | grep -o '/assets/index-[^"]*\.js' | head -1
curl -s "https://<your-domain>$(curl -s https://<your-domain>/ | grep -o '/assets/index-[^\"]*\.js' | head -1)" | grep -c 'onrender.com'
```

Expect `1` or more. `0` means the frontend is calling itself.

### 3.3 Regenerate the pre-render (only after landing changes)

The `/` route for crawlers is a **committed snapshot**, not generated on Vercel
(the build machine has no browser). Two committed artifacts:

- `frontend/prerender/landing-root.html` — the rendered `#root` of the landing.
  The build injects it into `index.html`, which is the file Vercel serves at
  `/`. The untouched built entry is kept as `shell.html` and served for SPA
  deep links (`/login`, app routes) by the rewrite in `frontend/vercel.json`.
  A rewrite of `/` to a second file would not work: Vercel gives the
  filesystem precedence, so `/index.html` shadows it. Vercel's guidance for
  this case is to rename the static file, which is why the shell is not
  `index.html`.
- `frontend/public/og-image.png` — the 1200x630 social banner (`og:image`,
  `twitter:image`, JSON-LD `image`).

Change landing markup or the Field notes numbers (06 · Field notes strip)
**and** regenerate both, or crawlers keep serving the old text:

```bash
cd frontend
VITE_SITE_URL="https://<your-vercel-domain>" npm run build
npm run prerender   # rewrites both artifacts (or prerender:root / prerender:og)
```

`npm run prerender` opens the built SPA in the system Chrome (headless, via
`puppeteer-core`, `scripts/seo-render.mjs`) and asserts the page still carries
its markers before writing. It commits nothing; you commit the artifacts like
any other file. `frontend/src/features/landing/prerender-snapshot.test.ts` fails
CI if a snapshot is missing or becomes a shell, so a stale snapshot cannot slip
through.

---

## 4. (Optional) A custom domain

Only worth doing if you want the project to be findable by name. The Vercel
hostname works for everything else.

1. Buy a domain. Cheapest real options: Cloudflare Registrar (at-cost, no markup),
   or Porkbun.
2. Vercel -> project -> **Settings -> Domains** -> type the domain -> **Add**.
3. Vercel tells you the records to create. If the registrar is Cloudflare, set
   them there.
4. Wait for the certificate. Vercel provisions Let's Encrypt automatically; it
   takes minutes, occasionally an hour for the first issuance.
5. **Then** set `VITE_SITE_URL` to the custom domain and redeploy, and update
   `FRONTEND_HOST` on Render to match (section 2.5). If you skip this, the
   canonical URLs keep pointing at the Vercel hostname and you have two origins
   serving the same content, which is the exact split-canonical problem this
   setup was built to avoid.

---

## 5. GitHub OAuth app

The backend owns the OAuth flow. The frontend just redirects to
`GET /auth/github/login` and posts the code back.

1. <https://github.com/settings/developers> -> **OAuth Apps** -> **New OAuth App**.
2. Fill in:
   - **Application name**: `Vorza`
   - **Homepage URL**: `https://<your-frontend-domain>`
   - **Authorization callback URL**: `https://<your-frontend-domain>/login`
     -- **the path must be exactly `/login`**. The frontend reads `?code=` and
     `?state=` off that route. GitHub matches this string exactly.
3. **Generate a client secret**.
4. Put the **Client ID** and **client secret** into Render's environment
   variables (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) and redeploy.
5. Verify the authorize URL:
   ```bash
   curl -s "https://<render-service>.onrender.com/auth/github/login" | head -c 400
   ```
   Expect a JSON payload containing `github.com/login/oauth/authorize?...` with a
   `state` parameter. Then actually sign in through the browser and confirm you
   land back on `/login` with the app loaded.

---

## 6. GitHub webhook (PR review)

The webhook receiver is **fail-closed**: with `GITHUB_WEBHOOK_SECRET` unset,
`POST /webhooks/github` returns **503** rather than accepting a payload it cannot
verify. That is deliberate -- it used to ship a hardcoded fallback secret that
anyone who read the repo could use to forge a review.

1. Render env: `GITHUB_WEBHOOK_SECRET` must be set to the value from section 2.1
   (`openssl rand -hex 32`). Redeploy if you just added it.
2. On a repo you want reviewed: **Settings -> Webhooks -> Add webhook**.
   - **Payload URL**: `https://<render-service>.onrender.com/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: the same string
   - **Events**: select **Pull requests** only
3. GitHub sends a `ping` on creation. Green tick = the secret matches and the
   signature check is passing.
4. Open a PR. Check Render's **Logs** tab for the review job.

Verify it is actually enforcing the secret:

```bash
# No signature header -> must NOT be 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://<render-service>.onrender.com/webhooks/github \
  -H 'Content-Type: application/json' -d '{"action":"opened"}'
```

Expect `401` or `403`, never `200`.

---

## 7. Google Search Console

Only worth doing once the frontend is live at a real origin.

1. <https://search.google.com/search-console> -> **Add property**.
2. Choose **URL prefix** and enter the origin **including scheme**, e.g.
   `https://vorza.app`. Do not add a trailing slash. The `Domain` type requires
   DNS verification, which is more work than this needs.
3. Verify. Vercel serves `/.well-known/` from the deployment, so the **Automatic
   verification** tab usually works immediately. If not, use the **Manual**
   tab's meta tag and add it to `frontend/index.html` -- then commit and redeploy.
4. **Sitemaps** -> **Sitemap** field -> `sitemap.xml` -> **Submit**. Relative is
   fine, the domain is implied.
5. **URL Inspection** -> paste the landing URL -> **Test live URL**. Expect
   **URL is on Google** and **Google-selected canonical** matching your domain.
   If Google picks a different canonical, `VITE_SITE_URL` and the deployed origin
   have diverged -- fix section 3.1.
6. Optional but recommended: **Settings -> Crawl stats**. This tells you whether
   the free-tier spin-down is costing you crawls. A cold-start 503 is a bad
   crawler experience.

---

## 8. Verify the whole thing

```bash
FRONTEND="https://<your-frontend-domain>"
BACKEND="https://<your-render-service>.onrender.com"

# Backend is up and is not running on SQLite any more.
curl -s "$BACKEND/openapi.json" | head -c 80; echo
# Render -> Logs should show "Alembic owns the schema"

# Hardening headers are present (added in the security pass).
curl -sI "$BACKEND/openapi.json" | grep -iE 'x-content-type|x-frame|strict-transport|referrer-policy'

# Rate limiting answers, and does not lock out a single request.
curl -s -o /dev/null -w '%{http_code}\n' "$BACKEND/me"   # 401 without a token

# Frontend deep link (the SPA rewrite).
curl -s -o /dev/null -w '%{http_code}\n' "$FRONTEND/login"

# The landing page has real HTML a crawler can read.
curl -s "$FRONTEND/" | grep -c 'force-directed'

# Canonical is the deployed origin, not localhost.
curl -s "$FRONTEND/" | grep -o '<link rel="canonical" href="[^"]*"'
```

Expected: `401` on `/me`, `200` on `/login`, a non-zero grep count, and a
canonical equal to your frontend origin.

---

## 9. (Optional) Lighthouse comments on pull requests

`.github/workflows/Lighthouse.yml` runs Lighthouse against the **public** Vercel
origin (landing + login, mobile + desktop presets) on every push to `master`.
It gates on `performance >= 85` and `accessibility >= 95` for the landing, and
`accessibility >= 95` (performance floor 70) for the login shell. Reports are
uploaded as build artifacts on every run.

Commenting scores on pull requests is not wired by default, because that needs
a third-party GitHub App to be authorised on this private repo (a token cannot
be minted by CI). Two manual steps enable it:

1. Install the **Lighthouse CI** GitHub App (<https://github.com/apps/lighthouse-ci>)
   for this repository.
2. Add the generated token as the `LHCI_GITHUB_APP_TOKEN` secret, add
   `pull_request` to the `on:` block in `.github/workflows/Lighthouse.yml`, and
   set `temporaryPublicStorage: true` on the Lighthouse steps.

The repo page is deliberately not audited: it requires login, and Vercel
serves the SPA shell without a session, so scores there would not mean
anything.

---

## What I could not verify, and why

Stated plainly rather than glossed over.

| Not verified | Reason |
|---|---|
| Docker Compose stack | No Docker on this machine. The backend Dockerfile **is** built by CI on every push, so the image itself is verified. |
| `docker compose up` end to end | As above. |
| The live deploy after these changes | The Render service is configured by hand in a dashboard; applying the blueprint and setting secrets requires your accounts. |
| Search Console indexing | Takes days to weeks. Cannot be forced. |
| Neon connection from Render | Requires a real Neon project and a real Render service. The URL parsing and normalisation **was** verified with the four real Neon URL shapes. |
| Lighthouse / axe scores | Not run. See `docs/audit/04-test-strategy.md` for the plan. |
| Live WebSocket delivery in production | The client and the gateway contract are both unit-tested, and the gateway's impersonation hole is tested server-side, but an end-to-end socket test needs two live browsers. |