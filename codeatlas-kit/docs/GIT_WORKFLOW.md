# Running 6 agents on one repo without them colliding

**Never point 6 OpenCode sessions at the same folder at the same time.** Two
agents editing the same working directory simultaneously will overwrite each
other's uncommitted changes — this is a filesystem, not a merge tool.

The fix is one repo, six **git worktrees** — each is a separate folder on disk
checked out to its own branch, all pointing at the same underlying `.git`
history. Every agent gets an isolated folder to work in, but they all share
the same `AGENTS.md`, `CONTRACTS.md`, and `STATUS.md` once they pull `main`.

## One-time setup

```bash
cd codeatlas          # your main clone, on branch `main`
bash setup_worktrees.sh
```

This creates:

```
../codeatlas-agent1-backend      (branch: agent-1-backend)
../codeatlas-agent2-ai           (branch: agent-2-ai)
../codeatlas-agent3-frontend     (branch: agent-3-frontend)
../codeatlas-agent4-ui-ux        (branch: agent-4-ui-ux)
../codeatlas-agent5-realtime     (branch: agent-5-realtime)
../codeatlas-agent6-devops       (branch: agent-6-devops)
```

## Running the 6 sessions

Open 6 terminal tabs. In each one:

```bash
cd ../codeatlas-agent1-backend   # (or agent2, agent3, ... — one per tab)
opencode
```

Then paste the matching prompt from `docs/KICKOFF_PROMPTS.md` into that
session.

## Keeping everyone in sync

Contracts and status only help if everyone reads the latest version. A few
times a day (or whenever an agent reports something in `STATUS.md` that
affects others), from your main clone:

```bash
git checkout main && git pull
# for each worktree that needs the update:
cd ../codeatlas-agent3-frontend && git merge main
```

This is manual on purpose for a solo-person project — it gives you (the
human) a natural checkpoint to skim `STATUS.md` and catch conflicts early,
instead of six agents silently diverging for days.

## Merging back to main

Agents open PRs from their branch; they do not merge themselves (rule in
`AGENTS.md`). The **DevOps & QA Lead (Agent 6)** is the one who reviews and
merges PRs into `main`, resolving any contract mismatches using
`CONTRACTS.md` as the tiebreaker. As the human, you're the final approver —
skim each PR before it merges, especially early on.
