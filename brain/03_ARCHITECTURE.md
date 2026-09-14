# 03 — Architecture

Status: 🟡 DRAFT

## High-Level Overview

[1-2 paragraphs describing the overall shape of the system: client-server?
monolith? serverless? mobile + backend API? Describe the main components and
how data flows between them.]

```
[Draw a simple text/ASCII diagram here, e.g.:]

  [Client App] --HTTPS--> [API Server] --SQL--> [Database]
                                |
                                +--> [3rd-party API]
                                +--> [Background Jobs / Scraper]
```

## Folder Structure

Document the intended folder layout so AI never invents a competing structure.

```
project-root/
├── brain/              # this folder — specs and rules
├── src/ or lib/         # application code
│   ├── [module_1]/
│   ├── [module_2]/
│   └── ...
├── tests/
├── .github/workflows/
└── ...
```

## Module Boundaries

| Module | Responsibility | Depends on |
|---|---|---|
| [ ] | [ ] | [ ] |
| [ ] | [ ] | [ ] |

Rule: modules should depend "downward" only (UI → business logic → data), never
sideways into unrelated modules, to keep the codebase testable.

## State Management (frontend, if applicable)

- Approach: [local state / Redux / Riverpod / Zustand / Context API / etc.]
- Where server state (API data) is cached: [ ]
- Where UI-only state lives: [ ]

## Background Jobs / Scheduled Tasks

- [Job name] — runs [frequency] — does [what] — see `06_DATA_INGESTION_SPEC.md`

## Key Design Principles for this project

- [e.g. "Prefer composition over inheritance"]
- [e.g. "All business logic must be UI-framework agnostic and unit-testable"]
- [e.g. "No direct DB calls from UI layer — always go through a service layer"]
