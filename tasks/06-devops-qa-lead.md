# Agent 6 — DevOps & QA Lead

## Mission

Be the glue. Own Docker, CI, seed data, and the final integration —
you're the one who merges the other five agents' branches into `master` and
makes sure the whole thing actually runs as one system, not five separate
demos.

## Build this

1. **Docker Compose** (`docker-compose.yml`): `postgres`, `redis`, `backend`,
   `frontend`, `adminer` — start from the FastAPI template's compose file
   (see `docs/REFERENCE_REPOS.md`) and extend it with Redis + the real
   frontend service.
2. **CI** (`.github/workflows/`): on every PR — lint + type-check + test for
   both `backend/` and `frontend/`. On merge to `master` — build both Docker
   images.
3. **Seed data + demo script**: a script that connects one real small public
   repo end to end (OAuth-free demo mode if needed — e.g. a pre-fetched
   snapshot fixture) so the demo works even without live GitHub credentials
   on stage.
4. **Integration**: as each agent opens a PR, you review it against
   `CONTRACTS.md`, run it against the others locally via Docker Compose, and
   merge. When two agents' work conflicts, `CONTRACTS.md` is the tiebreaker —
   fix whichever side drifted from it, and if the contract itself was wrong,
   update it and say why in `STATUS.md`.
5. **E2E tests** (Playwright): the full demo flow — login → connect repo →
   see graph render → open two tabs → see live cursor → simulate a webhook →
   see the AI review land.
6. **Deployment guide** (`docs/DEPLOYMENT.md`): steps to actually deploy
   (Render/Railway/Fly.io for backend+Postgres+Redis, Vercel for frontend).
7. **Final README pass**: once the others are done, make sure the root
   `README.md`'s quick-start actually works from a clean checkout.

## Do

- Merge in dependency order where it matters (Agent 1's models before Agent
  2's pipeline can be tested end to end, etc.) — check `STATUS.md` for what's
  actually ready, don't assume from task files alone.
- Keep CI fast — cache dependencies, don't re-run the whole suite on every
  tiny doc change.
- Be the one who actually runs `docker-compose up` from a totally clean
  clone regularly — that's the test that catches "works on my machine."
- Claim tasks in `brain/15_MICROTASKS.md` by setting status to `IN_PROGRESS: Agent 6`.
- On completion, mark `DONE` in `brain/15_MICROTASKS.md`, append to `brain/16_CHANGELOG.md`.
- Follow `brain/12_CICD_GITHUB_ACTIONS.md` for CI configuration.
- Follow `brain/13_TESTING.md` for testing strategy.
- Follow `brain/14_PRODUCTION_CHECKLIST.md` for production readiness.

## Don't

- Don't write the product features yourself — if something's missing,
  flag it in `STATUS.md` for the owning agent rather than quietly building it
  into their area.
- Don't merge a PR that breaks `CONTRACTS.md` compliance without fixing it
  first.
- Don't skip E2E tests to save time — this is the project's actual quality
  bar.
- Don't guess missing specs — add `[NEEDS INPUT]` to `STATUS.md` and stop.

## Definition of done

- [ ] `docker-compose up` from a clean clone brings up the full stack and
      the demo flow works.
- [ ] CI is green on `master`.
- [ ] Playwright E2E suite covers the full demo script from `docs/IDEA.md`.
- [ ] `docs/DEPLOYMENT.md` is accurate — you followed it yourself once.
- [ ] `STATUS.md` reflects the true final state of the project.
- [ ] `brain/16_CHANGELOG.md` updated under "Unreleased".
- [ ] Any decisions logged in `brain/17_DECISIONS.md`.

## First 3 steps

1. Get the Docker Compose skeleton running with just Postgres + Redis +
   empty backend/frontend stubs.
2. Set up the GitHub Actions CI skeleton (even before there's much to
   test) so every agent's first PR already runs lint/test.
3. Start merging PRs as they land, checking each against `CONTRACTS.md`,
   logging every merge and any conflict resolution in `STATUS.md`.