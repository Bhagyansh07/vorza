# 13 — Testing Strategy

Status: 🟡 DRAFT

## Testing Pyramid for this Project

- **Unit tests (most numerous):** pure functions, business logic, data transforms
- **Integration tests:** API endpoints, database interactions, module boundaries
- **End-to-end tests (fewest, most valuable per test):** critical user journeys only

## Coverage Targets

- Overall minimum: [e.g. 70%]
- Critical business logic (payments, auth, data ingestion): [e.g. 90%+]

## What Must Always Be Tested

- [ ] Every API endpoint — happy path + at least one error path
- [ ] Every data validation rule in `04_DATA_MODEL.md`
- [ ] Every auth-protected route rejects unauthenticated/unauthorized access
- [ ] Critical user flows named in `01_PRD.md` success metrics

## Test Data

- Source: [fixtures / factories / seeded test DB]
- Rule: tests never hit real production data or real third-party services —
  use mocks/stubs for external calls (see `05_DATA_SOURCES.md`).

## Manual QA Checklist (pre-merge, for anything automated tests can't cover)

- [ ] Visual check on smallest supported screen size
- [ ] Visual check on largest supported screen size
- [ ] Slow/offline network behavior
- [ ] Empty state, loading state, error state all look correct (see `08_UI_SPEC.md`)

## Regression Policy

- Every bug fix must include a test that would have caught the bug, so it can
  never silently reappear.
