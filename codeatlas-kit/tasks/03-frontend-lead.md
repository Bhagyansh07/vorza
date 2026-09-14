# Agent 3 — Frontend Lead

## Mission

Build the app shell everything else lives inside: routing, auth, the API
client, and the pages that aren't the graph itself (that's Agent 4's).

## Build this

1. Scaffold `frontend/` with Vite + React + TypeScript + TailwindCSS +
   shadcn/ui.
2. Adopt bulletproof-react's feature-folder structure (see
   `docs/REFERENCE_REPOS.md`): `src/features/auth/`, `src/features/repos/`,
   and an empty `src/features/graph/` folder left for Agent 4.
3. Auth pages: login (GitHub OAuth redirect flow against Agent 1's backend),
   logout, protected-route wrapper.
4. API client: generate or hand-write typed functions for every endpoint in
   `CONTRACTS.md`'s REST table, using TanStack Query for caching/loading/error
   states.
5. Pages per the route map in `CONTRACTS.md`: `/dashboard` (list connected
   repos, a "connect new repo" button), `/repos/:id` (mounts Agent 4's graph
   component — you just provide the route, layout, and pass `repoId` as a
   prop), `/repos/:id/history` (mounts Agent 4's chart component similarly).
6. Global layout: nav bar, loading/error boundaries, toast notifications for
   API errors.

## Do

- Build the auth + dashboard flow against Agent 1's real API as soon as it
  exists (check `STATUS.md`); use mock responses only until then.
- Keep design tokens (colors, spacing, type scale) in one Tailwind config
  file so Agent 4's visualization can reuse the same palette.
- Write a couple of Vitest + React Testing Library tests for the auth flow
  and the dashboard list.

## Don't

- Don't build the graph, charts, or comment-pin UI — leave
  `src/features/graph/` for Agent 4. You only provide the page/route that
  mounts it.
- Don't touch `backend/` at all.
- Don't invent your own design system from scratch — shadcn/ui components +
  Tailwind, per the reference repo.

## Definition of done

- [ ] `npm run dev` boots a working app: login → dashboard → click a repo →
      empty `/repos/:id` page (graph slot ready for Agent 4).
- [ ] API client covers every `CONTRACTS.md` REST endpoint with correct
      TypeScript types.
- [ ] Tests pass.
- [ ] `STATUS.md` entry noting the exact prop/route contract Agent 4 should
      mount against (e.g. "GraphView component should accept `repoId: string`
      and render inside the `<div id='graph-slot'>` in RepoPage").

## First 3 steps

1. Scaffold the Vite/React/Tailwind/shadcn app, get a blank page running.
2. Build the auth flow against Agent 1's OAuth endpoints (use mocks first if
   backend isn't ready, swap in real calls once it is).
3. Build the dashboard + repo page shell, then log the graph-mounting
   contract in `STATUS.md` for Agent 4.
