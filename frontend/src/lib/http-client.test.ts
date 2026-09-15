import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { httpApiClient, UNAUTHORIZED_EVENT } from '@/lib/http-client';
import { ApiError } from '@/lib/errors';

const API = 'http://localhost:8000';

const user = {
  id: 'u_1',
  email: 'dev@codeatlas.dev',
  github_username: 'codeatlas-dev',
  created_at: '2026-01-01T00:00:00Z',
};

const repo = {
  id: 'r_1',
  owner_id: 'u_1',
  github_full_name: 'facebook/react',
  connected_at: '2026-08-02T09:00:00Z',
  default_branch: 'main',
};

const snapshot = {
  id: 's_1',
  repo_id: 'r_1',
  created_at: '2026-09-01T00:00:00Z',
  files: [],
  overall_health_score: 82,
};

const comment = {
  id: 'c_1',
  repo_id: 'r_1',
  snapshot_id: 's_1',
  file_path: 'src/app.tsx',
  author_id: 'u_1',
  body: 'risky file',
  x: 10,
  y: 20,
  created_at: '2026-09-02T00:00:00Z',
};

const server = setupServer(
  // One handler per CONTRACTS.md endpoint the frontend calls.
  http.post(`${API}/auth/github/callback`, () =>
    HttpResponse.json({
      access_token: 'jwt-123',
      token_type: 'bearer',
      user,
    })
  ),

  http.get(`${API}/me`, ({ request }) => {
    if (request.headers.get('Authorization') !== 'Bearer jwt-123') {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json(user);
  }),

  http.get(`${API}/repos`, () => HttpResponse.json([repo])),

  http.post(`${API}/repos`, async ({ request }) => {
    const body = (await request.json()) as { github_full_name: string };
    return HttpResponse.json({ ...repo, id: 'r_2', ...body }, { status: 201 });
  }),

  http.get(`${API}/repos/r_1/snapshots/latest`, () => HttpResponse.json(snapshot)),

  http.get(`${API}/repos/r_1/snapshots/history`, () =>
    HttpResponse.json([snapshot])
  ),

  http.post(`${API}/repos/r_1/analyze`, () => HttpResponse.json({ status: 'queued' })),

  http.get(`${API}/repos/r_1/comments`, () => HttpResponse.json([comment])),

  http.post(`${API}/repos/r_1/comments`, async ({ request }) => {
    const body = (await request.json()) as { body: string };
    return HttpResponse.json({ ...comment, body: body.body }, { status: 201 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  window.localStorage.clear();
});
afterAll(() => server.close());

beforeEach(() => {
  window.localStorage.setItem('codeatlas.access_token', 'jwt-123');
});

describe('httpApiClient (Agent 1 contract endpoints)', () => {
  it('POST /auth/github/callback exchanges a code for a session', async () => {
    const result = await httpApiClient.loginWithGitHubCode({ code: 'abc' });
    expect(result.access_token).toBe('jwt-123');
    expect(result.user.github_username).toBe('codeatlas-dev');
  });

  it('GET /me sends the bearer token and returns the current user', async () => {
    await expect(httpApiClient.getMe()).resolves.toEqual(user);
  });

  it('GET /me with a bad token rejects with ApiError and clears the session', async () => {
    window.localStorage.setItem('codeatlas.access_token', 'expired');
    let unauthorizedFired = false;
    const listener = () => {
      unauthorizedFired = true;
    };
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await expect(httpApiClient.getMe()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    } satisfies Partial<ApiError>);

    expect(window.localStorage.getItem('codeatlas.access_token')).toBeNull();
    expect(unauthorizedFired).toBe(true);
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it('GET /repos lists connected repos', async () => {
    const repos = await httpApiClient.listRepos();
    expect(repos).toHaveLength(1);
    expect(repos[0].github_full_name).toBe('facebook/react');
  });

  it('POST /repos connects a new repo', async () => {
    const created = await httpApiClient.connectRepo({
      github_full_name: 'vitejs/vite',
    });
    expect(created.github_full_name).toBe('vitejs/vite');
  });

  it('snapshot, analyze and comment endpoints hit the right paths', async () => {
    const latest = await httpApiClient.getLatestSnapshot('r_1');
    expect(latest.overall_health_score).toBe(82);

    const history = await httpApiClient.getSnapshotHistory('r_1');
    expect(history).toHaveLength(1);

    const analyze = await httpApiClient.analyzeRepo('r_1');
    expect(analyze.status).toBe('queued');

    const comments = await httpApiClient.listComments('r_1');
    expect(comments[0].body).toBe('risky file');

    const created = await httpApiClient.createComment('r_1', {
      snapshot_id: 's_1',
      file_path: 'src/app.tsx',
      body: 'new note',
      x: 1,
      y: 2,
    });
    expect(created.body).toBe('new note');
  });
});