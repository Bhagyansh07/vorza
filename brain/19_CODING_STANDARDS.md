# 19 — Coding Standards

Status: 🟡 DRAFT — fill in per language/framework chosen in `02_TRD.md`.

## Naming Conventions

- Files: [kebab-case / snake_case / PascalCase — pick one and stick to it]
- Variables/functions: [camelCase / snake_case]
- Classes/Components: [PascalCase]
- Constants: [UPPER_SNAKE_CASE]
- Booleans read like questions: `isLoading`, `hasError`, `canSubmit`

## Formatting & Linting

- Formatter: [Prettier / Black / gofmt / etc.] — config file: [ ]
- Linter: [ESLint / Ruff / etc.] — config file: [ ]
- Rule: code must pass lint + format checks before being considered done
  (enforced in CI, see `12_CICD_GITHUB_ACTIONS.md`).

## File & Folder Organization

- One component/class/module per file, matching the structure in
  `03_ARCHITECTURE.md`.
- Keep files under roughly [300-500] lines; split when they grow past that.
- Co-locate tests with the code they test, or mirror the structure under `tests/`.

## Comments & Documentation

- Comment the *why*, not the *what* — code should be readable enough to show
  what it does.
- Every public function/exported module gets a short docstring/comment
  describing purpose, parameters, and return value.
- No commented-out dead code left in commits — delete it (git history keeps it).

## Commit Message Convention

Use Conventional Commits style:

```
feat: add search filter to results screen (T-014)
fix: correct off-by-one in pagination (T-021)
chore: update dependencies
docs: update API contract for /v1/results
```

## Pull Request Size

- Prefer PRs under ~400 changed lines where possible.
- One PR = one task from `15_MICROTASKS.md` (or a tightly related group).
- PR description references the task ID and links relevant brain files.

## Error Handling in Code

- Never silently swallow exceptions/errors — log or handle explicitly
  (see `09_ERROR_HANDLING.md`).
- Fail fast and loud in development; fail gracefully and informatively in production.

## Dependency Hygiene

- Before adding a new dependency, check `02_TRD.md`'s dependency table —
  add it there too, with license and reasoning.
- Prefer well-maintained, widely used libraries over obscure ones for
  anything security- or data-related.
