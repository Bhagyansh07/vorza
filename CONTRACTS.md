# CONTRACTS.md — v0.1 (living document)

This is the single source of truth for shapes every agent codes against.
**Edit this file the moment you change any of these** — and say so in
`STATUS.md`. Anyone who built against the old shape needs to know.

## Core data models (owned by Agent 1)

```
User        { id, email, github_username, created_at }
Repo        { id, owner_id, github_full_name, connected_at, default_branch }
AnalysisSnapshot {
  id, repo_id, created_at,
  files: [ FileNode ],
  overall_health_score: float  # 0-100, higher = healthier
}
FileNode    { path, loc, complexity_score, churn_score, health_score, imports: [path] }
Comment     { id, repo_id, snapshot_id, file_path, author_id, body, x, y, created_at }
```

## REST API surface (owned by Agent 1, consumed by Agents 2, 3, 4, 6)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/github/callback` | GitHub OAuth login |
| GET | `/me` | Current user |
| POST | `/repos` | Connect a new GitHub repo |
| GET | `/repos` | List connected repos |
| GET | `/repos/{id}/snapshots/latest` | Latest analysis snapshot (the graph data) |
| GET | `/repos/{id}/snapshots/history` | Trend data for charts |
| POST | `/repos/{id}/analyze` | Trigger a manual re-analysis (Agent 2's job) |
| POST | `/webhooks/github` | GitHub PR webhook receiver → triggers Agent 2's review pipeline |
| GET/POST | `/repos/{id}/comments` | List / create comment pins |

## AI review output shape (owned by Agent 2, consumed by Agent 1 + Agent 4)

```json
{
  "pr_number": 42,
  "risk_score": 0-100,
  "summary": "one paragraph, plain English",
  "flags": [ { "file": "path", "severity": "low|medium|high", "note": "text" } ],
  "updated_files": [ "path1", "path2" ]
}
```

## WebSocket events (owned by Agent 5, consumed by Agent 4)

| Event | Direction | Payload |
|---|---|---|
| `presence:join` | client→server | `{repo_id, user_id}` |
| `presence:cursor` | client↔server | `{user_id, x, y}` |
| `comment:new` | client↔server | `Comment` (see above) |
| `snapshot:updated` | server→client | `{repo_id, snapshot: AnalysisSnapshot}` |
| `review:new` | server→client | AI review output shape above |

## Frontend route map (owned by Agent 3, consumed by Agent 4)

```
/login
/dashboard                  → list of connected repos
/repos/:id                  → the live graph (Agent 4's component mounts here)
/repos/:id/history          → trend charts
```

## Change log

- v0.1 — initial contract draft, ships with the kit. First agent to actually
  need a change: update this section with date + what changed + why.
