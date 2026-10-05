# AGENT COMMUNICATION PROTOCOL — How 6 Agents Talk Without Talking

## The Core Principle

**Agents never DM each other. They communicate through immutable, version-controlled files in the repo.** This creates a permanent audit trail and eliminates "he said/she said" bugs.

---

## Three Communication Channels

### 1. CONTRACTS.md — The Law (Synchronous Contract)

**What it is:** The single source of truth for all shared interfaces — REST API endpoints, request/response shapes, WebSocket events, database models, error codes.

**Who writes:** The agent who **owns** that interface (see ownership table below).

**Who reads:** Everyone who consumes that interface.

**Workflow:**
```
Agent A (owner) edits CONTRACTS.md
       │
       ▼
Agent A appends to STATUS.md: "Changed X contract — see CONTRACTS.md:v42"
       │
       ▼
Agents B,C,D... read STATUS.md → see notification → read CONTRACTS.md → adapt
```

**Ownership Table:**

| Interface | Owner | Consumers |
|-----------|-------|-----------|
| REST API (repos, analysis, auth) | Agent 1 (Backend) | Agents 2,3,4,5,6 |
| AnalysisSnapshot / FileNode shapes | Agent 1 + Agent 2 | Agents 3,4,5 |
| AI Review output schema | Agent 2 (AI/Data) | Agents 1,4,5 |
| Frontend route map | Agent 3 (Frontend) | Agents 4,5,6 |
| Graph visualization data/events | Agent 4 (UI/UX) | Agents 3,5 |
| WebSocket events (cursors, comments, live updates) | Agent 5 (Realtime) | Agents 3,4 |
| Docker/CI/Infra config | Agent 6 (DevOps) | All (read-only) |

---

### 2. STATUS.md — The Bulletin Board (Async Log)

**What it is:** Append-only log where agents announce progress, blockers, needs, and completions.

**Format (every entry):**
```markdown
## [YYYY-MM-DD HH:MM] Agent N — <Area>
- **Done:** <what you shipped>
- **Exposed:** <new endpoints, events, fields added to CONTRACTS.md>
- **Blocked:** <what you need from whom, specific>
- **Next:** <what you're picking up next>
```

**Example:**
```markdown
## [2026-09-14 14:32] Agent 1 — Backend
- Done: POST /api/repos endpoint + Repo model
- Exposed: Added Repo model to CONTRACTS.md (id, name, url, default_branch)
- Blocked: Need Agent 2 to define AnalysisSnapshot.shape for /api/repos/{id}/analyze
- Next: Implement GET /api/repos/{id}/analysis
```

**Reading protocol:** Every agent reads `STATUS.md` at session start and after every commit. Grep for your agent number or keywords ("need Agent 3", "exposed", "ready").

---

### 3. Git PRs + Reviews — The Integration Layer

**What it is:** Formal code review and merge process. Agent 6 (DevOps) is the only one who merges to the default branch.

**Workflow:**
```
Agent N finishes task → pushes branch → opens PR → assigns Agent 6
       │
       ▼
Agent 6 reviews: code quality + CONTRACTS.md consistency + tests pass
       │
       ▼
Agent 6 merges → default branch updated → all worktrees `git pull origin master` to sync
```

**Conflict resolution:** If two agents' work conflicts on `CONTRACTS.md`, `CONTRACTS.md` wins. Agent 6 fixes the code that violates the contract (or updates contract + logs in STATUS.md if justified).

---

## Session Start Protocol (Every Agent, Every Time)

```bash
# 1. Enter your worktree
cd /path/to/CodeAtlas-agentN-xxx

# 2. Sync with the default branch
git pull origin master

# 3. Read the constitution
cat brain/00_MASTER_RULES.md
cat brain/01_PRD.md
cat brain/02_TRD.md

# 4. Check what's happening
cat STATUS.md
cat CONTRACTS.md
cat brain/15_MICROTASKS.md   # Find your next TODO
cat brain/16_CHANGELOG.md    # Last 5 entries

# 5. Start working on your task
```

---

## Real-World Scenarios

### Scenario A: Agent 3 (Frontend) needs a new API field
1. Agent 3 reads `CONTRACTS.md` → sees field missing
2. Agent 3 appends to `STATUS.md`: "Need `last_analyzed_at` on Repo model for dashboard"
3. Agent 1 (Backend) reads `STATUS.md` next session → adds field to model + CONTRACTS.md
4. Agent 1 appends to `STATUS.md`: "Added `last_analyzed_at` to Repo model — deployed"
5. Agent 3 reads `STATUS.md` → uses new field

### Scenario B: Agent 4 (UI/UX) needs a new WebSocket event
1. Agent 4 edits `CONTRACTS.md` (WebSocket section) → adds `analysis.progress` event
2. Agent 4 appends to `STATUS.md`: "Added analysis.progress event spec — need Agent 5 to emit"
3. Agent 5 reads `STATUS.md` → implements emission in analysis pipeline
4. Agent 5 appends to `STATUS.md`: "Emitting analysis.progress — payload matches CONTRACTS.md"
5. Agent 4 consumes event in graph components

### Scenario C: Breaking change detected
1. Agent 2 changes `AnalysisSnapshot` shape in `CONTRACTS.md` without backward compat
2. Agent 3's next session: reads `STATUS.md` + `CONTRACTS.md` → build breaks
3. Agent 3 appends to `STATUS.md`: "BREAKING: AnalysisSnapshot.shape changed — need migration or revert"
4. Agent 6 (DevOps) sees conflict in PR review → enforces: either revert + versioned endpoint, or all consumers update in same PR batch

---

## Emergency Escalation

If an agent is blocked > 2 sessions on another agent's deliverable:
1. Append to `STATUS.md`: "ESCALATION: Blocked on Agent X for Y since [date]"
2. Human (you) gets notified → unblocks manually or reprioritizes

---

## Summary: The Golden Rules

| Never Do | Always Do |
|----------|-----------|
| DM another agent | Write to `CONTRACTS.md` + `STATUS.md` |
| Assume a contract shape | Read `CONTRACTS.md` first |
| End session silently | Log to `STATUS.md` |
| Commit to the default branch directly | PR → Agent 6 reviews → merge |
| Guess missing specs | Add `[NEEDS INPUT]` to `STATUS.md` and stop |