#!/usr/bin/env bash
# Run this from inside your main "codeatlas" clone, on branch main,
# after your first commit + push. Creates one git worktree per agent so
# 6 OpenCode sessions can run in parallel without touching the same folder.
set -euo pipefail

if [ ! -d ".git" ]; then
  echo "Run this from the root of your codeatlas git repo (where .git lives)."
  exit 1
fi

declare -a AGENTS=(
  "1-backend"
  "2-ai"
  "3-frontend"
  "4-ui-ux"
  "5-realtime"
  "6-devops"
)

REPO_NAME=$(basename "$(pwd)")

for a in "${AGENTS[@]}"; do
  BRANCH="agent-${a}"
  DIR="../${REPO_NAME}-agent${a}"
  if [ -d "$DIR" ]; then
    echo "Skipping $DIR (already exists)"
    continue
  fi
  git branch "$BRANCH" main 2>/dev/null || true
  git worktree add "$DIR" "$BRANCH"
  echo "Created $DIR on branch $BRANCH"
done

echo ""
echo "Done. Open one terminal per folder below, cd into it, run 'opencode',"
echo "then paste the matching prompt from docs/KICKOFF_PROMPTS.md:"
echo ""
for a in "${AGENTS[@]}"; do
  echo "  ../${REPO_NAME}-agent${a}"
done
