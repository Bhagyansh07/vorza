# Agent 4 — UI/UX Lead

## Mission

Build the part of CodeAtlas that makes someone say "whoa" — the interactive
codebase graph, the trend charts, and the comment-pin/cursor visuals. This is
the demo. Make it beautiful and make it clear.

## Build this

1. Inside `src/features/graph/` (per Agent 3's contract in `STATUS.md`), a
   `GraphView` component:
   - Force-directed layout (react-force-graph or hand-rolled D3) of
     `AnalysisSnapshot.files` (`CONTRACTS.md`): node size ∝ `complexity_score`
     (or `loc`), node color on a green→red scale by `health_score`, edges
     from `imports`.
   - Zoom, pan, click-a-node → side panel with that file's metrics.
   - Smooth transition/pulse animation when a node's data updates (this is
     what sells the "live" feeling when Agent 5's WebSocket events land).
2. `TrendChart` component using Recharts: `overall_health_score` over time
   from `/repos/{id}/snapshots/history`.
3. Comment-pin UI: click anywhere on the graph canvas to drop a pin, small
   popover to write a comment, render other users' pins from the `Comment`
   shape. Live cursors: render other connected users' cursor positions
   (Agent 5 will feed you the coordinates over the WebSocket — build this
   against the `presence:cursor` event shape in `CONTRACTS.md` using
   mocked/simulated events until Agent 5's gateway is live).
4. Empty, loading, and error states for all of the above — a first-time user
   with zero repos connected should see something inviting, not a blank
   screen.

## Do

- Build against `CONTRACTS.md`'s shapes with **mock data first** so you're
  never blocked waiting on Agent 1 or Agent 2 — swap mocks for real data once
  `STATUS.md` says it's ready.
- Reuse Agent 3's Tailwind design tokens so the graph doesn't look like a
  different app.
- Keep the graph performant at a few hundred nodes — test with a
  medium-sized real repo, not just a 5-file toy example.

## Don't

- Don't touch `src/features/auth/`, `src/features/repos/` (Agent 3's), or any
  backend code.
- Don't build the WebSocket connection/reconnect logic itself — that's
  Agent 5's; you just consume the events they emit through a hook they
  expose (coordinate the hook's name/shape via `STATUS.md`).
- Don't let a single ugly default force-graph theme ship — this component is
  the whole point of the demo, spend real time on visual polish.

## Definition of done

- [ ] `GraphView` renders correctly against both mock data and (once ready)
      real snapshot data.
- [ ] Node color/size encoding is legible at a glance — a stranger should
      understand "red = bad" without being told.
- [ ] Trend chart renders real history data.
- [ ] Comment pins and live cursors work against Agent 5's real events (or
      clearly documented mocks if Agent 5 isn't ready yet).
- [ ] `STATUS.md` entry describing exactly what event/data shapes you ended
      up consuming, flagging any drift from `CONTRACTS.md`.

## First 3 steps

1. Get `GraphView` rendering against hardcoded mock `AnalysisSnapshot` JSON.
2. Add zoom/pan/click-for-detail and the color/size encoding polish.
3. Add the trend chart against mock history data, then log your mock shapes
   in `STATUS.md` so Agent 2's real output can match them.
