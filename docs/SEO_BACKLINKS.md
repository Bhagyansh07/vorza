# SEO and backlinks

Status as of **2026-10-05**, with the measurement that backs each line.

---

## Part 1 — What was wrong

Measured, not guessed:

| Check | Before | After |
|---|---|---|
| Indexable pages | **0** | 2 (`/`, `/login`) |
| `/` behaviour | 302/redirect to `/dashboard` | serves public HTML |
| HTML a crawler receives from `/` | `<div id="root"></div>` and nothing else | full page content |
| `<title>` | `Vorza` | templated per route |
| `<meta description>` | 1, on the root only | per route |
| `<link rel="canonical">` | absent | per route, absolute |
| Open Graph tags | absent | 9 tags |
| Twitter card | absent | 6 tags |
| `robots.txt` | absent | generated at build |
| `sitemap.xml` | absent | generated at build, 2 URLs |
| Web app manifest | absent | present, 4 icons |
| `theme-color` | absent | `#0b0d14` |
| `og-image.png` | referenced by nothing, file absent | generated, 1200x630 |
| Icons beyond a 32px SVG | absent | 192/512/maskable/apple-touch |
| SPA rewrite in `vercel.json` | absent -> deep links 404'd in production | present |

The root cause of the first two rows is worth stating plainly: `/` redirected
into `ProtectedRoute`. A crawler fetched the site, got an empty root div, and
left. There was nothing to index and nothing to unfurl, because the only page
that existed required an OAuth login.

---

## Part 2 — What was built

### The landing page

`frontend/src/features/landing/routes/Landing.tsx` — real copy, six feature
cards, a stack table, JSON-LD (`SoftwareApplication`).

This is a deliberate change to the meaning of `/`: it used to be a redirect to
the dashboard. `/dashboard` is unchanged and still does exactly what it did.

### Head tags that do not execute JavaScript

`frontend/src/lib/seo.ts` exports `useDocumentMeta`, which keeps title,
description, robots, canonical, `og:*` and `twitter:*` in sync per route.

The tags are **deliberately duplicated** in `index.html`. Social crawlers
(Twitter/X, Facebook, LinkedIn, Slack, Discord) do not execute JavaScript, so
`index.html` is the only version of the head they will ever see. `useDocumentMeta`
is for the live SPA experience, not a substitute for `index.html` being correct
on its own. If you change one, change both.

### Index vs noindex

| Route | Directive | Why |
|---|---|---|
| `/` | `index, follow` | the only page with standalone search value |
| `/login` | `index, follow` | real intent behind "github oauth login"; thin but honest |
| `/dashboard` | `noindex, nofollow` | behind auth; a crawler sees a redirect to `/login` |
| `/repos/:id` | `noindex, nofollow` | authed and UUID-keyed; competes with the landing page for crawl budget |
| `/repos/:id/history` | `noindex, nofollow` | same |
| 404 | `noindex, nofollow` | a 404 must not be indexed or the URL keeps getting re-submitted |

`robots.txt` mirrors the `Disallow` list. Belt and braces: the meta directive is
what actually stops indexing, the robots directive stops the crawl.

### One origin, never two

Canonicals and `og:url` resolve from `window.location` when `VITE_SITE_URL` is
unset, so a preview build cannot claim to be production.

`robots.txt` and `sitemap.xml` are static and cannot do that, so they are emitted
at build time by a small Vite plugin from the same `VITE_SITE_URL`. Verified both
ways:

- set -> emits the configured origin
- unset -> the build **warns loudly** and emits `http://localhost:5173`

A sitemap with a wrong origin fails silently once indexed, so the unset case is a
build warning, not a shrug. This also settles the stale-hostname problem recorded
in `docs/audit/00-recon.md:217` — there is now nowhere for a hardcoded Vercel URL
to hide.

---

## Part 3 — Keyword and intent map

| Intent | Query shape | Target | Realistic? |
|---|---|---|---|
| Category | "codebase visualization tool", "code health dashboard" | `/` | Yes. This is the whole pitch. |
| Competitor comparison | "codebase map vs CodeSee / Sourcetrail" | `/` | Yes, once there is a comparison section. |
| Problem-first | "how do I find circular dependencies in a large repo" | `/` | Weak. The product answers this but does not say so. |
| Free/OSS | "open source codebase visualization" | `/` | Yes, and the badge already claims it. |
| Branded | "vorza", "vorza codebase map" | `/` | Yes, once the domain resolves. |

### Honest gaps

Not claiming these:

- **No volume data.** I have not run keyword research, so I cannot say which of
  these has search volume. That needs Google Keyword Planner or an equivalent,
  which needs an account.
- **No competing-page analysis.** So no "we beat X on Y" claims.
- **No existing authority.** The repo has 0 stars, no description, no topics. The
  domain does not exist yet.

---

## Part 4 — Backlinks

Ranked by effort-to-value, with the honest ceiling stated.

### 4.1 The repo itself — highest value, lowest effort

The GitHub repo is the only asset with any existing surface, and it currently has
no description and no topics, which means it is invisible to GitHub search.

1. **Description** (Settings -> General):
   > Force-directed map of your codebase. Every file scored on complexity,
   > churn and health; pull requests reviewed by AI before they ship.
2. **Topics**: `code-visualization`, `d3`, `force-directed-graph`, `code-health`,
   `code-review`, `ai`, `fastapi`, `react`, `websocket`, `developer-tools`
3. **A README that is worth a star.** Currently the single highest-leverage change
   in this document. See below.
4. **Social preview image**: GitHub reads `og:image` from the repo's
   `opengraph.githubassets.com` generated card by default. You can pin a specific
   one by uploading it in the repo's social preview settings. `og-image.png`
   already exists at the right size.

### 4.2 Launch platforms — real, one-time, permanent

| Platform | URL | Notes |
|---|---|---|
| Hacker News | news.ycombinator.com | Show HN. A force-directed codebase map with a real graph is the kind of thing Show HN rewards. Write the post for people who like graphs. |
| Reddit r/programming | reddit.com/r/programming | Read the rules; a self-promo-only account gets removed. Comment first. |
| Reddit r/webdev, r/devops | | Feedback on the graph interaction specifically. |
| Product Hunt | producthunt.com | Needs 3-5 launch-day upvotes to rank. Pre-arrange. |
| Indie Hackers | indiehackers.com | Post the numbers, including the free-tier limits. |
| Lobsters | lobste.rs | Invite-requested, technical, low ego. Good fit. |

### 4.3 Write-ups — the compounding kind

These are the only backlinks that keep working after they are posted:

1. **"I built a force-directed map of my own codebase"** with the actual
   screenshot, the real algorithm choices, and what surprised you. Dev.to,
   Hashnode, Medium, or a `docs/BLOG/` folder in the repo.
2. **"What I got wrong: a codebase visualizer that silently showed mock data."**
   This is a genuinely good post. The shadow API layer computed
   `import.meta.env.VITE_USE_MOCK !== "false"`, which defaults to true, so
   production served fixtures behind a plausible-looking UI. Write it up; it is
   the kind of post that gets shared, and it makes the fix legible rather than
   looking like a chore.
3. **"SQLModel table names will bite you."** The migration created
   `analysesnapshot`; SQLModel derives `analysissnapshot` from the class name.
   Invisible behind `create_all`, fatal on a managed database. Small, specific,
   and searchable.
4. **"Free-tier hosting: what actually costs you data."** Render free web services
   have no disk, and Render free Postgres expires 30 days after *creation* while
   Neon Free does not expire. This is useful to a lot of people and you have the
   receipts.

### 4.4 Deliberately skipped

| Tactic | Why not |
|---|---|
| Link farms, PBNs, reciprocal-link schemes | They do not work and they make the domain worse |
| Comment links on generic dev blogs | Manual-action risk, no durable value |
| Paying for links | Free-tier-only project, and paid links violate most program terms |
| Automated directory submissions | Low quality, and several are outright spam |

---

## Part 5 — Verification checklist

Run these after the frontend is live at a real origin.

```bash
FRONTEND="https://<your-domain>"

# 1. The landing page has real HTML a crawler can read.
curl -s "$FRONTEND/" | grep -c 'force-directed'

# 2. Canonical is the deployed origin, not localhost or a preview URL.
curl -s "$FRONTEND/" | grep -o '<link rel="canonical" href="[^"]*"'

# 3. robots.txt points at the right sitemap.
curl -s "$FRONTEND/robots.txt"

# 4. Sitemap origin matches the canonical origin.
curl -s "$FRONTEND/sitemap.xml"

# 5. og:image resolves and is the right size.
curl -sI "$FRONTEND/og-image.png" | head -1

# 6. Deep links resolve (the SPA rewrite).
curl -s -o /dev/null -w '%{http_code}\n' "$FRONTEND/login"

# 7. The authed routes are not indexable.
curl -s "$FRONTEND/dashboard" | grep -o 'name="robots" content="[^"]*"'
```

Expect:

1. non-zero
2. `<link rel="canonical" href="https://<your-domain>/">`
3. `Sitemap: https://<your-domain>/sitemap.xml`
4. the same origin, 2 `<url>` entries
5. `200`
6. `200`
7. `noindex, nofollow`

### Then, in Search Console

Full walkthrough in `docs/MANUAL_STEPS.md` section 7. The two checks that
actually matter:

- **URL Inspection -> Test live URL.** Expect "URL is on Google" and
  "Google-selected canonical" equal to your domain. If Google picks a different
  canonical, `VITE_SITE_URL` and the deployed origin have diverged.
- **Crawl stats.** This tells you whether the Render free-tier spin-down is
  costing you crawls. A cold-start failure is a bad crawler experience and it
  will show up here as elevated 5xx.

---

## Part 6 — What is not done

| Not done | Why |
|---|---|
| Keyword volume research | Needs an account (Keyword Planner) and I cannot create one |
| Structured data validation | Rich Results Test needs the live URL |
| Lighthouse SEO score | Needs the live URL |
| `hreflang` | Single-language. Adding it would be noise. |
| Analytics / privacy-respecting tracking | Needs a policy decision from you. Adding a tracker without asking was not appropriate. |
| `llms.txt` | Cheap, but it is a vanity file. Worth it only alongside real content. |
| Indexing of authed routes | Deliberately not wanted. |

---

## Part 7 — Honest assessment

**The technical SEO is done and correct.** Canonicals are absolute and
self-consistent, the origin cannot drift, the sitemap matches the canonical, the
OG card is a real generated image, deep links resolve, and authed routes are
excluded deliberately rather than by accident.

**The off-site half is not started, and off-site is where ranking comes from.** A
technically perfect page on a zero-authority domain with no backlinks ranks
nothing. The highest-value action in this document is not any of the code above
— it is writing the README, setting the GitHub description and topics, and
posting the write-ups in section 4.3. Those are hours of work, and they matter
more than any further on-page work.

One structural constraint worth knowing: the free-tier backend sleeps after 15
minutes of inactivity and takes ~1 minute to wake. That affects crawlers as much
as users. A search engine that gets a cold-start timeout may simply not come
back. If indexing looks patchy after a few weeks, that is the first thing to
suspect, and the fix is a paid always-on instance — not more SEO work.