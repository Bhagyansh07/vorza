# Agent 5 — Real-time & Integration Lead

## Mission

Make CodeAtlas feel alive: WebSocket gateway on the backend, Redis pub/sub to
broadcast events, and the frontend socket wiring that pushes presence,
comments, and AI-review updates to everyone watching a repo, in real time.

## Build this

1. **Backend WebSocket gateway** (`backend/app/ws/`): a `/ws/repos/{id}`
   endpoint. On connect, join a Redis pub/sub channel scoped to that repo id.
2. **Redis pub/sub wiring**: whenever Agent 1's API or Agent 2's analysis
   pipeline saves a new `AnalysisSnapshot` or AI review result, publish it to
   the repo's channel (`snapshot:updated`, `review:new` — exact shapes in
   `CONTRACTS.md`). Coordinate the "who calls publish() where" hook points
   with Agent 1/2 via `STATUS.md` rather than guessing.
3. **Presence & cursors**: on each `presence:cursor` message from a client,
   rebroadcast it (throttled — don't forward every pixel, sample it) to
   everyone else on that channel. Track who's currently connected per repo
   for a simple "3 people viewing" indicator.
4. **Comments**: `comment:new` messages get persisted (call into Agent 1's
   comment endpoint or write directly to the model — confirm which via
   `STATUS.md`) and rebroadcast to the channel.
5. **Frontend socket client**: a small hook, e.g. `useRepoSocket(repoId)`,
   that Agent 4's `GraphView` subscribes to. Handle reconnect: on drop,
   reconnect with backoff, then refetch current snapshot via REST before
   resuming the live stream (never show stale data silently after a
   reconnect).

## Do

- Throttle/sample cursor broadcasts (e.g. max 10/sec per user) — this is the
  single easiest way to make the whole thing feel laggy if skipped.
- Load-test with at least 2 simulated concurrent connections before calling
  this done — one-user testing hides the actual point of this feature.
- Document the exact hook interface (`useRepoSocket` return shape) in
  `STATUS.md` so Agent 4 can consume it without reading your backend code.
- Claim tasks in `brain/15_MICROTASKS.md` by setting status to `IN_PROGRESS: Agent 5`.
- On completion, mark `DONE` in `brain/15_MICROTASKS.md`, append to `brain/16_CHANGELOG.md`.
- Follow `brain/19_CODING_STANDARDS.md` for code style.
- Follow `brain/10_SECURITY.md` for WebSocket auth (verify JWT on connect).

## Don't

- Don't build a custom CRDT/OT engine — plain pub/sub broadcast is enough
  for this project's scale.
- Don't put business logic (analysis, AI review) in the WebSocket layer —
  you broadcast events, Agents 1/2 own producing the data.
- Don't touch the graph's rendering code — you expose events, Agent 4
  consumes and renders them.
- Don't guess missing specs — add `[NEEDS INPUT]` to `STATUS.md` and stop.

## Definition of done

- [ ] Two browser tabs connected to the same repo see each other's cursor
      and comments in real time.
- [ ] A new `AnalysisSnapshot` (triggered manually or via webhook) shows up
      live on a connected client within a couple seconds, no refresh needed.
- [ ] Reconnect after a dropped connection doesn't show stale/duplicated
      data.
- [ ] `STATUS.md` entry with the final event shapes and the frontend hook
      interface.
- [ ] `brain/16_CHANGELOG.md` updated under "Unreleased".
- [ ] Any decisions logged in `brain/17_DECISIONS.md`.

## First 3 steps

1. Get a bare WebSocket echo endpoint working end to end (connect, send,
   receive) before adding Redis.
2. Add Redis pub/sub per repo channel, test with two `wscat`/browser
   connections talking to each other.
3. Wire the `presence:cursor` and `comment:new` events fully, then log the
   frontend hook contract in `STATUS.md` for Agent 4.