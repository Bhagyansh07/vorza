#!/usr/bin/env node
/**
 * E2E test-double backend for the Playwright suite.
 *
 * One process replaces Vercel + the FastAPI backend + the WebSocket gateway
 * for the duration of a test run:
 *
 *  - static: serves exactly what Vercel serves from `dist` (index.html is the
 *    pre-rendered landing at `/`, shell.html is the SPA shell for deep links,
 *    assets are served as files, see vite.config.ts `seoFiles` and
 *    vercel.json).
 *  - REST: answers every route CONTRACTS.md defines from an in-memory store.
 *  - gateway: accepts `ws://<host>/ws/repos/{id}` and broadcasts
 *    `snapshot:updated` / `review:new` frames, so the graph's realtime path
 *    is exercised for real instead of being stubbed at the browser level.
 *  - control: `POST /e2e/*` endpoints drive server state deterministically
 *    (complete an analysis, push a review) from a spec via the `request`
 *    fixture.
 *
 * The bundle is built with the API base pointing at this origin
 * (`.env.e2e`), so a missed route can never leak to a real backend.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const PORT = Number(process.env.PORT ?? 4173);
const HOST = '127.0.0.1';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const USER = {
  id: 'u_1',
  email: 'e2e@vorza.dev',
  github_username: 'vorza-e2e',
  created_at: '2026-01-01T00:00:00Z',
};

/** Small deterministic file map shared by every generated snapshot. */
const FILE_NODES = [
  {
    path: 'src/core/engine.ts',
    loc: 410,
    complexity_score: 22.4,
    churn_score: 0.9,
    health_score: 64,
    imports: ['src/hooks/useGraph.ts'],
  },
  {
    path: 'src/hooks/useGraph.ts',
    loc: 96,
    complexity_score: 4.1,
    churn_score: 0.3,
    health_score: 91,
    imports: [],
  },
  {
    path: 'src/app.tsx',
    loc: 142,
    complexity_score: 8.2,
    churn_score: 0.6,
    health_score: 88,
    imports: ['src/main.tsx'],
  },
  {
    path: 'src/lib/health.ts',
    loc: 54,
    complexity_score: 3.0,
    churn_score: 0.2,
    health_score: 83,
    imports: ['src/core/engine.ts'],
  },
];

const SNAPSHOT_R1 = {
  id: 's_1',
  repo_id: 'r_1',
  created_at: '2026-10-01T09:00:00Z',
  overall_health_score: 78,
  files: FILE_NODES,
};

const SEED_COMMENT = {
  id: 'c_1',
  repo_id: 'r_1',
  snapshot_id: 's_1',
  file_path: 'src/core/engine.ts',
  author_id: 'you',
  body: 'E2E seed comment on engine',
  x: 0.32,
  y: 0.41,
  created_at: '2026-10-02T10:00:00Z',
};

const GITHUB_REPOS = [
  {
    full_name: 'acme/widgets',
    private: false,
    default_branch: 'main',
    description: 'The internal widgets SDK',
    language: 'TypeScript',
    updated_at: '2026-09-28T00:00:00Z',
  },
  {
    full_name: 'acme/plumbing',
    private: true,
    default_branch: 'main',
    description: 'Internal services',
    language: 'Go',
    updated_at: '2026-09-20T00:00:00Z',
  },
  {
    full_name: 'octocat/Hello-World',
    private: false,
    default_branch: 'master',
    description: 'The classic tutorial repository',
    language: 'JavaScript',
    updated_at: '2025-12-01T00:00:00Z',
  },
];

/**
 * Shared mutable store. Specs only ever touch their own repo id, and every
 * assertion is against a value the spec itself created, so concurrent workers
 * on one server do not race. No reset endpoint by design: a global reset
 * fired from one worker could clobber another worker mid-test.
 */
const state = {
  repos: [
    {
      id: 'r_1',
      owner_id: 'u_1',
      github_full_name: 'vorza-demo/landing',
      connected_at: '2026-09-30T12:00:00Z',
      default_branch: 'main',
      last_analyze_error: null,
    },
    {
      id: 'r_analyze',
      owner_id: 'u_1',
      github_full_name: 'octocat/Spork',
      connected_at: '2026-09-30T12:00:00Z',
      default_branch: 'trunk',
      last_analyze_error:
        'git clone failed: could not resolve ref HEAD (simulated)',
    },
  ],
  snapshots: { r_1: SNAPSHOT_R1 },
  comments: { r_1: [SEED_COMMENT] },
  repoSeq: 10,
  commentSeq: 10,
  snapshotSeq: 4,
};

const REVIEW_PAYLOAD = {
  pr_number: 42,
  risk_score: 61,
  summary: 'Risky change behind a second chunk: the planner now rewrites state synchronously.',
  flags: [
    {
      file: 'src/core/engine.ts',
      severity: 'high',
      note: 'Synchronous rewrite in a hot path; consider batching.',
      line_start: 12,
      line_end: 14,
    },
    {
      file: 'src/lib/health.ts',
      severity: 'low',
      note: 'Repeated threshold lookups could be a constant.',
      line_start: 3,
      line_end: 3,
    },
  ],
  updated_files: ['src/core/engine.ts', 'src/lib/health.ts'],
  dropped_flags: 1,
};

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function sendJson(res, status, body, headers = {}) {
  const header = { 'Content-Type': 'application/json', ...headers };
  res.writeHead(status, header);
  res.end(JSON.stringify(body));
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function isAuthed(req) {
  return /^Bearer .+/.test(req.headers.authorization ?? '');
}

function etagOf(value) {
  return `"${createHash('sha1').update(JSON.stringify(value)).digest('hex')}"`;
}

/** Strong ETag + 304 handling for the snapshot payload (mirrors the backend). */
function sendSnapshot(req, res, snapshot) {
  const etag = etagOf(snapshot);
  if (req.headers['if-none-match'] === etag) {
    send(res, 304, '', { ETag: etag });
    return;
  }
  sendJson(res, 200, snapshot, { ETag: etag });
}

function makeSnapshot(repoId) {
  state.snapshotSeq += 1;
  return {
    id: `s_${state.snapshotSeq}`,
    repo_id: repoId,
    created_at: new Date().toISOString(),
    overall_health_score: 78,
    files: FILE_NODES,
  };
}

/* ------------------------------------------------------------------ */
/* WebSocket gateway twin                                              */
/* ------------------------------------------------------------------ */

const repoSockets = new Map();
/**
 * Last event broadcast per repo, replayed to sockets that connect later.
 * This makes spec ordering deterministic: a control endpoint that fires
 * before the socket finishes its handshake is still delivered on connect.
 */
const lastEvents = new Map();

function repoIdOfSocketPath(pathname) {
  const m = /^\/ws\/repos\/([^/]+)$/.exec(pathname);
  return m ? m[1] : null;
}

function broadcast(repoId, event) {
  lastEvents.set(repoId, event);
  const sockets = repoSockets.get(repoId);
  if (!sockets) return;
  const frame = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === 1 /* OPEN */) {
      socket.send(frame);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

function staticFileFor(pathname) {
  if (pathname === '/') {
    const index = path.join(distDir, 'index.html');
    if (existsSync(index)) return index;
    return null;
  }
  const candidate = path.join(distDir, pathname.replace(/^\/+/, ''));
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const shell = path.join(distDir, 'shell.html');
  return existsSync(shell) ? shell : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method ?? 'GET';

  try {
    // Control + fake GitHub page (spec-hosted flows; no bearer token yet).
    if (pathname === '/e2e/authorize') {
      return send(res, 200, FAKE_GITHUB_PAGE, {
        'Content-Type': 'text/html; charset=utf-8',
      });
    }
    if (method === 'POST' && pathname === '/e2e/analyze/r_analyze') {
      const snapshot = makeSnapshot('r_analyze');
      state.snapshots.r_analyze = snapshot;
      const repo = state.repos.find((r) => r.id === 'r_analyze');
      if (repo) repo.last_analyze_error = null;
      broadcast('r_analyze', { type: 'snapshot:updated', payload: { snapshot } });
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'POST' && pathname === '/e2e/review/r_1') {
      broadcast('r_1', { type: 'review:new', payload: REVIEW_PAYLOAD });
      return sendJson(res, 200, { ok: true });
    }

    // Auth grant (the login page calls this via raw fetch).
    if (method === 'GET' && pathname === '/auth/github/login') {
      return sendJson(res, 200, {
        authorize_url: `http://${HOST}:${PORT}/e2e/authorize?client_id=e2e-client&state=1&scope=read:user,repo`,
        scopes: ['read:user', 'repo'],
        write_access: true,
      });
    }
    if (method === 'POST' && pathname === '/auth/github/callback') {
      return sendJson(res, 200, {
        access_token: 'e2e-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: USER,
      });
    }

    // Everything below requires a bearer token, like the real backend. Two
    // shapes of request hit API-shaped paths:
    //   - JSON API calls (axios, which always sends `Accept: application/json`)
    //   - full-page navigations to client-side routes (`/repos/...`), which
    //     never carry an Authorization header and must get the SPA shell, not
    //     a 401 -- exactly how Vercel's rewrite treats them in production.
    // So a path only counts as an API request when the caller accepts JSON.
    const acceptsJson = (req.headers.accept ?? '*/*').includes('application/json');
    const isApiPath =
      pathname === '/me' ||
      pathname === '/repos' ||
      pathname.startsWith('/repos/') ||
      pathname === '/github/repos';
    const isApiRequest = isApiPath && acceptsJson;
    if (isApiRequest && !isAuthed(req)) {
      return sendJson(res, 401, { detail: 'Not authenticated' });
    }

    if (isApiRequest) {
      if (method === 'GET' && pathname === '/me') {
        return sendJson(res, 200, USER);
      }

      if (method === 'GET' && pathname === '/repos') {
        return sendJson(res, 200, { data: state.repos, count: state.repos.length });
      }

      if (method === 'POST' && pathname === '/repos') {
        const { github_full_name } = await readBody(req);
        if (!github_full_name) {
          return sendJson(res, 422, { detail: 'github_full_name is required' });
        }
        if (state.repos.some((r) => r.github_full_name === github_full_name)) {
          return sendJson(res, 409, { detail: 'Repository already connected' });
        }
        state.repoSeq += 1;
        const repo = {
          id: `r_${state.repoSeq}`,
          owner_id: 'u_1',
          github_full_name,
          connected_at: new Date().toISOString(),
          default_branch: 'main',
          last_analyze_error: null,
        };
        state.repos.push(repo);
        return sendJson(res, 201, repo);
      }

      if (method === 'GET' && pathname === '/github/repos') {
        // Bare array: this contract endpoint does not use the envelope.
        return sendJson(res, 200, GITHUB_REPOS);
      }

      const repoIdMatch = /^\/repos\/([^/]+)$/.exec(pathname);
      const analyzeMatch = /^\/repos\/([^/]+)\/analyze$/.exec(pathname);
      const snapshotMatch = /^\/repos\/([^/]+)\/snapshots\/latest$/.exec(pathname);
      const historyMatch = /^\/repos\/([^/]+)\/snapshots\/history$/.exec(pathname);
      const commentsMatch = /^\/repos\/([^/]+)\/comments$/.exec(pathname);

      if (repoIdMatch) {
        const repo = state.repos.find((r) => r.id === repoIdMatch[1]);
        if (!repo) return sendJson(res, 404, { detail: 'Repository not found' });
        if (method === 'DELETE') {
          state.repos = state.repos.filter((r) => r.id !== repoIdMatch[1]);
          return send(res, 204, '');
        }
        return sendJson(res, 200, repo);
      }

      if (method === 'POST' && analyzeMatch) {
        return sendJson(res, 202, {
          message: 'Analysis queued',
          repo_id: analyzeMatch[1],
        });
      }

      if (snapshotMatch) {
        const snapshot = state.snapshots[snapshotMatch[1]];
        if (!snapshot) return sendJson(res, 404, { detail: 'No snapshot yet' });
        return sendSnapshot(req, res, snapshot);
      }

      if (historyMatch) {
        const history = [
          { id: 's_1', repo_id: historyMatch[1], created_at: '2026-09-30T09:00:00Z', overall_health_score: 71 },
          { id: 's_2', repo_id: historyMatch[1], created_at: '2026-10-02T09:00:00Z', overall_health_score: 74 },
          { id: 's_3', repo_id: historyMatch[1], created_at: '2026-10-04T09:00:00Z', overall_health_score: 78 },
        ];
        return sendJson(res, 200, { data: history, count: history.length });
      }

      if (commentsMatch) {
        if (method === 'GET') {
          const list = state.comments[commentsMatch[1]] ?? [];
          return sendJson(res, 200, { data: list, count: list.length });
        }
        if (method === 'POST') {
          const input = await readBody(req);
          state.commentSeq += 1;
          const comment = {
            id: `c_${state.commentSeq}`,
            repo_id: commentsMatch[1],
            snapshot_id: input.snapshot_id ?? `s_${state.snapshotSeq}`,
            file_path: input.file_path ?? '',
            author_id: 'you',
            body: input.body ?? '',
            x: input.x ?? 0.5,
            y: input.y ?? 0.5,
            created_at: new Date().toISOString(),
          };
          state.comments[commentsMatch[1]] = state.comments[commentsMatch[1]] ?? [];
          state.comments[commentsMatch[1]].push(comment);
          return sendJson(res, 201, comment);
        }
      }
    }

    // Static / SPA fallback, mirroring vercel.json rewrites.
    const file = staticFileFor(pathname);
    if (!file || !existsSync(file)) {
      return sendJson(res, 404, {
        detail: `No built dist for ${pathname}. Run npm run build:e2e first.`,
      });
    }
    const ext = path.extname(file).toLowerCase();
    return send(res, 200, readFileSync(file), {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
  } catch (error) {
    console.error('[e2e-server]', error);
    return sendJson(res, 500, { detail: 'Internal test-double error' });
  }
});

const FAKE_GITHUB_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Simulated GitHub authorization</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 34rem; margin: 4rem auto; padding: 0 1rem; }
      code { background: #f0f0f0; padding: 0.15rem 0.3rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>Simulated GitHub authorization</h1>
    <p>This is the E2E stand-in for GitHub&apos;s consent page. It issues a
    <code>Vorza.access_token</code> and returns you to the app as the signed-in
    user, exactly where the real OAuth round trip lands.</p>
    <p>Authorizing automatically&hellip;</p>
    <script>
      setTimeout(function () {
        localStorage.setItem('Vorza.access_token', 'e2e-access-token');
        location.href = '/dashboard';
      }, 350);
    </script>
  </body>
</html>`;

const wss = new WebSocketServer({ server });

wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const repoId = repoIdOfSocketPath(url.pathname);
  if (!repoId) {
    socket.close();
    return;
  }
  if (!repoSockets.has(repoId)) repoSockets.set(repoId, new Set());
  repoSockets.get(repoId).add(socket);
  const pending = lastEvents.get(repoId);
  if (pending && socket.readyState === 1 /* OPEN */) {
    socket.send(JSON.stringify(pending));
  }
  socket.on('close', () => {
    repoSockets.get(repoId)?.delete(socket);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[e2e-server] test double listening on http://${HOST}:${PORT}`);
});