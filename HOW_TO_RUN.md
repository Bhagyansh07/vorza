# CodeAtlas — Complete Setup & Run Guide

## Project Status

✅ **Repo created**: https://github.com/Bhagyansh07/codeatlas
✅ **BRAIN specs integrated**: `brain/` folder with 20 spec files
✅ **6 Worktrees created** in `C:\Users\bhagy\OneDrive\Desktop\PROJECTS\`:
- `CodeAtlas-agent1-backend` → branch `agent-1-backend`
- `CodeAtlas-agent2-ai` → branch `agent-2-ai`
- `CodeAtlas-agent3-frontend` → branch `agent-3-frontend`
- `CodeAtlas-agent4-ui-ux` → branch `agent-4-ui-ux`
- `CodeAtlas-agent5-realtime` → branch `agent-5-realtime`
- `CodeAtlas-agent6-devops` → branch `agent-6-devops`

---

## How to Start the 6 Agents

### Step 1: Open 6 Terminals (PowerShell or CMD)

### Step 2: In each terminal, cd to the worktree and run opencode

**Terminal 1 — Backend Lead (Agent 1)**
```bash
cd "C:\Users\bhagy\OneDrive\Desktop\PROJECTS\CodeAtlas-agent1-backend"
opencode
```
→ Paste **Session 1 — Backend Lead** prompt from `docs/KICKOFF_PROMPTS.md`

**Terminal 2 — AI/Data Lead (Agent 2)**
```bash
cd "C:\Users\bhagy\OneDrive\Desktop\PROJECTS\CodeAtlas-agent2-ai"
opencode
```
→ Paste **Session 2 — AI / Data Lead** prompt

**Terminal 3 — Frontend Lead (Agent 3)**
```bash
cd "C:\Users\bhagy\OneDrive\Desktop\PROJECTS\CodeAtlas-agent3-frontend"
opencode
```
→ Paste **Session 3 — Frontend Lead** prompt

**Terminal 4 — UI/UX Lead (Agent 4)**
```bash
cd "C:\Users\bhagy\OneDrive\Desktop\PROJECTS\CodeAtlas-agent4-ui-ux"
opencode
```
→ Paste **Session 4 — UI/UX Lead** prompt

**Terminal 5 — Real-time Lead (Agent 5)**
```bash
cd "C:\Users\bhagy\OneDrive\Desktop\PROJECTS\CodeAtlas-agent5-realtime"
opencode
```
→ Paste **Session 5 — Real-time & Integration Lead** prompt

**Terminal 6 — DevOps/QA Lead (Agent 6)**
```bash
cd "C:\Users\bhagy\OneDrive\Desktop\PROJECTS\CodeAtlas-agent6-devops"
opencode
```
→ Paste **Session 6 — DevOps & QA Lead** prompt

---

## ⚡ Critical: Start Order

**Give Agent 1 (Backend) a 1-2 minute head start.**  
Agents 2, 3, 4, 5 depend on Agent 1's models and API contracts. Agent 6 reviews everyone.

---

## How Agents Communicate (The Protocol)

### Three Channels Only — No Direct Talk

| File | Purpose | Who Writes |
|------|---------|------------|
| **brain/00_MASTER_RULES.md** | Constitution — read first every session | Human (you) only |
| **brain/01_PRD.md → 20_ENV_SETUP.md** | Specs, tasks, decisions, standards | Human + Agent 6 via PR |
| **CONTRACTS.md** | Live API/data/WS shapes (the "law") | Owning agent when they change something |
| **STATUS.md** | Async log: done, blocked, needs, exposed | Every agent after each chunk |
| **Git PRs** | Code review + merge to main | Agent 6 merges; all open PRs |

### Example Flow: Agent 4 needs a new field from Agent 1

```
1. Agent 4 reads CONTRACTS.md → field missing
2. Agent 4 appends to STATUS.md:
   "Need `last_analyzed_at` on Repo model for dashboard timestamp"
3. Agent 1 (next session) reads STATUS.md → adds field to model + CONTRACTS.md
4. Agent 1 appends to STATUS.md:
   "Added `last_analyzed_at` to Repo model — deployed to /repos endpoint"
5. Agent 4 reads STATUS.md → uses new field immediately
```

### Golden Rules
- **Never DM another agent** — write to CONTRACTS.md + STATUS.md
- **Never assume a shape** — read CONTRACTS.md first
- **Never end a session silently** — log to STATUS.md
- **Never commit to main directly** — PR → Agent 6 reviews → merge
- **Never guess missing specs** — add `[NEEDS INPUT]` to STATUS.md and stop

---

## BRAIN System — The Project Constitution

The `brain/` folder contains 20 files that are the **single source of truth**:

| File | Role |
|------|------|
| `00_MASTER_RULES.md` | Constitution — read this first, every session |
| `01_PRD.md` | Product requirements — what we're building |
| `02_TRD.md` | Technical requirements — how we're building it |
| `03_ARCHITECTURE.md` | System architecture diagram + decisions |
| `04_DATA_MODEL.md` | Database schema details |
| `05_DATA_SOURCES.md` | External APIs (GitHub, LLM providers) |
| `06_DATA_INGESTION_SPEC.md` | How repo data flows in |
| `07_API_CONTRACT.md` | Detailed API specs (mirrors CONTRACTS.md) |
| `08_UI_SPEC.md` | Design system, colors, components |
| `09_ERROR_HANDLING.md` | Error strategy |
| `10_SECURITY.md` | Auth, secrets, OWASP compliance |
| `11_MONETIZATION_SPEC.md` | Future pricing (not MVP) |
| `12_CICD_GITHUB_ACTIONS.md` | CI/CD pipeline spec |
| `13_TESTING.md` | Unit/integration/E2E strategy |
| `14_PRODUCTION_CHECKLIST.md` | Go-live requirements |
| `15_MICROTASKS.md` | **Task board** — agents claim TODO tasks here |
| `16_CHANGELOG.md` | Version history |
| `17_DECISIONS.md` | Architectural decisions log |
| `18_AI_AGENT_LOOP.md` | The exact loop agents follow |
| `19_CODING_STANDARDS.md` | Naming, formatting, folder structure |
| `20_ENV_SETUP.md` | Environment variables template |

**Agents read these at session start. They don't edit them directly — they propose changes via PRs that you (human) approve.**

---

## Your Role as the Human

1. **Start**: Run the 6 terminals with prompts (above)
2. **Monitor**: Watch `STATUS.md` in the main repo to see progress
3. **Unblock**: If an agent logs `ESCALATION: Blocked on Agent X`, you can:
   - Nudge that agent in their terminal
   - Or make a decision and log it in `brain/17_DECISIONS.md`
4. **Approve merges**: Agent 6 opens PRs → you review on GitHub → approve
5. **Decide**: When specs conflict or are missing, you resolve

---

## Key Files to Watch

| File | Location | What to Look For |
|------|----------|------------------|
| `STATUS.md` | Main repo root | Real-time progress, blockers, needs |
| `CONTRACTS.md` | Main repo root | API/WS/data shape changes |
| `brain/15_MICROTASKS.md` | `brain/` | Task board — what's TODO/IN_PROGRESS/DONE |
| `brain/16_CHANGELOG.md` | `brain/` | What actually shipped |
| `brain/17_DECISIONS.md` | `brain/` | Architectural decisions |

---

## Troubleshooting

### "Agent says it's blocked on X"
→ Check `STATUS.md` for the blocker details
→ Go to that agent's terminal and nudge them
→ Or if it's a spec gap, add the decision to `brain/17_DECISIONS.md`

### "Two agents' work conflicts"
→ Agent 6 (DevOps) catches this in PR review
→ `CONTRACTS.md` is the tiebreaker
→ Fix the code that violates the contract

### "Agent went off-spec"
→ Check `brain/00_MASTER_RULES.md` Rule 1: No scope creep
→ Check `CONTRACTS.md` — if they drifted, they must fix it
→ Agent 6 rejects the PR until aligned

### "I want to change the product direction"
→ Edit `brain/01_PRD.md` or `brain/02_TRD.md`
→ Log the change in `brain/17_DECISIONS.md`
→ Agents will pick it up next session

---

## Quick Reference: Agent Territories

| Agent | Owns | Worktree Folder |
|-------|------|-----------------|
| 1 — Backend | `backend/`, REST API, DB models, auth, webhooks | `CodeAtlas-agent1-backend` |
| 2 — AI/Data | `backend/app/services/analysis.py`, `ai_review.py`, prompts | `CodeAtlas-agent2-ai` |
| 3 — Frontend | `frontend/` (except `features/graph/`), auth pages, API client, routing | `CodeAtlas-agent3-frontend` |
| 4 — UI/UX | `frontend/src/features/graph/` — GraphView, TrendChart, CommentPins, Cursors | `CodeAtlas-agent4-ui-ux` |
| 5 — Realtime | `backend/app/ws/`, Redis pub/sub, `useRepoSocket` hook | `CodeAtlas-agent5-realtime` |
| 6 — DevOps | `docker-compose.yml`, `.github/workflows/`, seed data, E2E, merge PRs | `CodeAtlas-agent6-devops` |

---

## Final Notes

- **All 6 agents run in parallel** — they coordinate through files, not chat
- **The BRAIN system** makes the project auditable and resumable — any agent (or human) can read the full history
- **Your GitHub repo** at https://github.com/Bhagyansh07/codeatlas is the source of truth
- **Worktrees** mean no merge conflicts from filesystem clashes — each agent has their own folder on their own branch

**Ready? Open 6 terminals, paste 6 prompts, watch the magic happen.** 🚀