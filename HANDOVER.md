# Project background and operating notes

Vorza is a SaaS that turns a GitHub repository into a live, force-directed map:
every file is a node sized by complexity and coloured by health, teammates see
each other's cursors on the same canvas, and every new pull request gets an AI
review with a risk score.

## Live environment

| Thing | Where |
|---|---|
| App | https://frontend-bhagyansh.vercel.app |
| API | https://codeatlas-qr0e.onrender.com |
| OpenAPI | https://codeatlas-qr0e.onrender.com/openapi.json (also the deploy health check) |
| Repository | https://github.com/Bhagyansh07/codeatlas |
| Database | Neon Postgres (free tier, no expiry clock) |

Both apps auto-deploy from `master`. The backend runs Alembic migrations on
boot (see `backend/app/core/schema.py`), so pushing a new revision is enough —
no dashboard step.

## Accounts and secrets

Credentials never live in the repository. They are set as environment
variables in the respective hosting dashboards:

- Render: `SECRET_KEY`, `DATABASE_URL`, `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `FRONTEND_HOST`, `CORS_ORIGINS`*,
  optionally `OPENAI_API_KEY`.
- Vercel: `VITE_API_URL` (the backend URL), `VITE_USE_MOCKS=false`.

\* `CORS_ORIGINS` is also declared in `backend/app/core/config.py` and must stay
in sync with the app's live origins; a preview origin that is missing it gets
CORS-blocked at the GitHub OAuth grant fetch.

## Free-tier constraints that shape the code

- **Render free tier has no Redis** — the realtime publish helpers degrade to
  in-process, so the frontend polls for the first snapshot instead of relying
  on the `snapshot:updated` WebSocket event. The polling lives in
  `frontend/src/features/repos/hooks/use-repos.ts`.
- **Render cold starts take ~50 s** — the first request to the API after idle
  can hang; a retry a minute later succeeds.
- **AI review needs `OPENAI_API_KEY`** — without it the webhook receiver still
  accepts and verifies PR events, but the review is skipped and logged.

## Deployment story

The deploy was originally configured by hand in the Render dashboard, which is
how a data-loss bug (DB wiped on every restart) stayed invisible for a while.
It has since been moved to a managed Postgres and the Dockerfile installs `git`
(the base image ships without it, which silently broke analysis cloning at one
point). Deploy config lives in `render.yaml`, `vercel.json` and the GitHub
Actions workflow; a click-by-click narrative is in `docs/MANUAL_STEPS.md`.