# 12 — CI/CD & GitHub Actions

Status: 🟡 DRAFT

## Branch Strategy

- Main branch: `main` (always deployable)
- Working branches: `feature/[task-id]-short-name`, `fix/[task-id]-short-name`
- Merge strategy: [squash merge / rebase / merge commit]
- Rule: no direct pushes to `main` — always via pull request, even solo.

## Pipeline Stages

1. **Lint** — run formatter/linter, fail build on errors (see `19_CODING_STANDARDS.md`)
2. **Test** — run unit + integration tests (see `13_TESTING.md`)
3. **Build** — compile/build the app or bundle
4. **Deploy** — deploy to staging automatically on merge to `main`; deploy to
   production [manually / automatically] via [ ]

## Example Workflow Skeleton (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up environment
        run: [setup commands, e.g. install runtime]
      - name: Install dependencies
        run: [e.g. npm ci / pip install -r requirements.txt]
      - name: Lint
        run: [lint command]
      - name: Run tests
        run: [test command]
      - name: Build
        run: [build command]
```

## Secrets in CI

- Store all secrets in GitHub Actions "Encrypted Secrets", never in the workflow file.
- Naming convention: [e.g. `PROD_API_KEY`, `STAGING_DB_URL`]

## Required Checks Before Merge

- [ ] Lint passes
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No secrets detected in diff (consider a secret-scanning action)
