# Git workflow

How this repository is managed. The short version: small commits, one area per
commit, everything green before it lands.

## Branch model

- `master` is the only long-lived branch and is what deploys. Both Render
  (backend) and Vercel (frontend) auto-deploy from it.
- Feature work happens on a short-lived branch, then merges into `master` via a
  pull request. PRs run the CI workflow before they can merge.
- Never commit secrets, `.env` files, `node_modules/` or `__pycache__/` (see
  `.gitignore`).

## Commit conventions

- Commit messages follow `<area>: <short description>`, e.g.
  `backend: add repo model` or `frontend: render snapshot health colors`.
- One logical change per commit. If a change touches an API shape, update
  `CONTRACTS.md` in the same commit.
- Keep `master` deployable at every commit: run the checks in `README.md`
  before pushing if the change touches runtime code.

## Pull requests

- Open the PR against `master`. CI runs three jobs: backend (lint, format,
  mypy, pytest with coverage), frontend (typecheck, eslint, vitest) and a
  Docker build of the backend image.
- Do not merge a PR with red CI. The merge should be a clean, ideally
  squash-merged change so `master` history stays readable.

## Deploys

| Commit → | Target |
|---|---|
| `master` push | Render rebuilds the Docker backend (migrations run on boot), Vercel rebuilds the SPA |

There are no other change paths into production.