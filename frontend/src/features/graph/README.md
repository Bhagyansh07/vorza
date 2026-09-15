# features/graph — owned by Agent 4 (UI/UX Lead)

This folder is intentionally empty on the `agent-3-frontend` branch.

Mount contract (from Agent 3, also logged in `STATUS.md`):

- `/repos/:repoId` route already exists and renders a container:
  `<div id="graph-slot" data-repo-id={repoId}>` inside
  `src/features/repos/routes/RepoDetail.tsx`.
- Create `src/features/graph/components/GraphView.tsx` accepting
  `{ repoId: string }` and render it inside that slot.
- `/repos/:repoId/history` renders `<div id="history-slot">` in
  `src/features/repos/routes/RepoHistory.tsx` — same pattern, add a
  `HistoryCharts` component there.
- Follow the feature-folder convention: `api/`, `components/`, `hooks/`,
  `routes/`, `types/`.
- Reuse design tokens from `tailwind.config.ts` (`health.*`, `complexity.*`)
  and the helpers in `src/lib/health.ts`.
- TanStack Query hooks you can consume directly:
  `useLatestSnapshot(repoId)`, `useSnapshotHistory(repoId)`,
  `useRepoComments(repoId)` from `src/features/repos/hooks/use-repos.ts`.
- `comment:new` / `presence:*` websocket events are Agent 5's — subscribe via
  the socket client Agent 5 wires up.