# The Idea: CodeAtlas

## The problem

Every engineering team has a codebase that quietly rots. Complexity creeps in,
one module becomes a landmine nobody wants to touch, test coverage silently drops,
and nobody notices until something breaks in production. Code review happens
line-by-line in a diff view — nobody sees the *shape* of the damage.

## The product

CodeAtlas connects to a GitHub repo and gives it a face:

- A **force-directed graph** of the codebase — every file is a node, sized by
  complexity, colored by health (green → red), linked by import/dependency edges.
- **Live multiplayer**: open the map with a teammate and you see their cursor,
  like Figma. Anyone can drop a comment pin directly on a risky file.
- **An AI reviewer that never sleeps**: a GitHub webhook fires on every new PR.
  An LLM agent reads the diff, scores the risk, flags security/architecture
  smells in plain English, and the map updates live — the touched files pulse
  and re-color in real time for anyone watching.
- **Trend charts**: is this repo getting healthier or worse, sprint over sprint?
  A simple line chart answers that instantly.

## Why this, and not another to-do app / clone

- It is **not** a CRUD app, a chat-app clone, or an e-commerce clone — the three
  most over-submitted resume projects.
- It touches almost every hire-worthy skill in one coherent product:
  system design, real-time infrastructure, LLM/agentic integration, data
  visualization, auth, DevOps, and testing — without being a kitchen-sink mess,
  because every feature serves the same core loop.
- It is **genuinely useful** — this is close to real, funded products (e.g.
  CodeScene, Sourcegraph) but combined in a way that doesn't exist as one tool:
  live collaborative viewing + agentic PR review + a visual health map.
- It has a built-in, impressive live demo: open two browser tabs side by side,
  open a PR on the connected repo, and watch the map react in real time in
  front of the interviewer.

## The meta talking point (use this in interviews)

*"I designed the architecture and coordinated six parallel AI coding agents —
each with a scoped role and a shared contract file — to build this end to end.
I wrote the specs, the API contracts, and the coordination protocol; the agents
implemented against them."*

This is itself a legitimate, current, in-demand skill: **directing multi-agent
AI development workflows.** Say this out loud in interviews — it is 2026, and
"I can orchestrate AI agents to ship real systems" is a hiring signal, not a
shortcut to hide.

## Demo script (for the recruiter / interview)

1. Show the landing page → connect a GitHub repo (use a real public repo you
   picked ahead of time, ideally one with real history).
2. Watch the graph render — call out size = complexity, color = health.
3. Open the same URL in a second browser/incognito window → show the second
   cursor appear live, drop a comment together.
4. Push a small PR to the connected repo (or replay a captured webhook) → watch
   the AI review comment appear and the map re-color within seconds.
5. Show the trend chart — "this repo's average file complexity went up 12% this
   month, and here's the file that caused it."

## Scope discipline — what NOT to build (v1)

- No multi-language deep AST parsing for every language — start with
  JS/TS/Python import graphs plus language-agnostic metrics (file size, git
  churn). Add more languages only after the core loop works end to end.
- No custom CRDT engine for real-time — plain WebSocket + Redis pub/sub broadcast
  is enough for cursors/comments at demo scale.
- No multi-tenant billing, no payment integration, no mobile app.
- One LLM provider, done well, beats three providers done shallowly.
