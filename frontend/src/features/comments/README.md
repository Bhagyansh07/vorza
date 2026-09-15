# features/comments — owned by Agent 4 (UI/UX Lead) + Agent 5 (Real-time)

Comment-pin UI (dropping pins on the graph) lives here. Not built by Agent 3.

Available to consume from Agent 3's layer:

- REST: `GET/POST /repos/{id}/comments` via
  `useRepoComments(repoId)` / `useCreateComment(repoId)` in
  `src/features/repos/hooks/use-repos.ts`.
- Realtime: the `comment:new` event from `CONTRACTS.md` arrives through
  Agent 5's socket client.

Follow the feature-folder convention: `api/`, `components/`, `hooks/`,
`routes/`, `types/`.