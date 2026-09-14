# 20 — Environment Setup

Status: 🟡 DRAFT

## Prerequisites

- [Runtime, e.g. Node.js version / Python version / Flutter SDK version]
- [Package manager, e.g. npm / pnpm / pip / poetry]
- [Database, e.g. PostgreSQL locally or via Docker]
- [Other tools, e.g. Docker, ngrok, CLI tools]

## First-Time Setup

```bash
# 1. Clone the repo
git clone [repo url]
cd [project folder]

# 2. Install dependencies
[install command]

# 3. Copy environment template
cp .env.example .env
# then fill in the values below

# 4. Set up the database (if applicable)
[migration/seed command]

# 5. Run the app locally
[dev run command]
```

## `.env.example` Template

Keep this file in the repo (with placeholder values only — never real secrets).
Real values go in `.env`, which is git-ignored.

```
# App
APP_ENV=development
APP_PORT=3000

# Database
DATABASE_URL=

# Auth
AUTH_SECRET=

# Third-party APIs (see 05_DATA_SOURCES.md)
[SERVICE]_API_KEY=

# Monetization (see 11_MONETIZATION_SPEC.md)
ADMOB_APP_ID=
```

## Common Commands

| Task | Command |
|---|---|
| Run dev server | [ ] |
| Run tests | [ ] |
| Run lint | [ ] |
| Build for production | [ ] |
| Run database migrations | [ ] |

## Troubleshooting

- [Common issue 1]: [fix]
- [Common issue 2]: [fix]
