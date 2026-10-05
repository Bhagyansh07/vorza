/**
 * The graph feature must read through the shared, authenticated client.
 *
 * This file used to be an independent fetch layer with `API_BASE = ""` (so calls
 * went to the frontend origin), no Authorization header, no envelope unwrapping,
 * and a mock flag that defaulted to true because it read `VITE_USE_MOCK` -- a
 * variable nothing in the repo sets. The declared one is `VITE_USE_MOCKS`.
 *
 * These tests pin the delegation so that layer cannot grow back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    getMe: vi.fn(),
    listRepos: vi.fn(),
    getLatestSnapshot: vi.fn(),
    getSnapshotHistory: vi.fn(),
    listComments: vi.fn(),
    createComment: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

import {
  createComment,
  fetchComments,
  fetchLatestSnapshot,
  fetchMe,
  fetchRepos,
  fetchSnapshotHistory,
} from './index';

const mocked = vi.mocked(api);

describe('graph api delegations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never calls fetch directly', () => {
    // The whole point: one authenticated client, not a parallel one. Any raw
    // fetch here would carry no bearer token and hit the frontend origin.
    const globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);

    mocked.getLatestSnapshot.mockResolvedValue({
      id: 's1',
      repo_id: 'r1',
      created_at: '2026-01-01T00:00:00Z',
      files: [],
      overall_health_score: 80,
    });
    mocked.listComments.mockResolvedValue([]);
    mocked.listRepos.mockResolvedValue([]);
    mocked.getSnapshotHistory.mockResolvedValue([]);
    mocked.getMe.mockResolvedValue({
      id: 'u1',
      email: 'a@b.co',
      github_username: 'octocat',
      full_name: null,
      created_at: '2026-01-01T00:00:00Z',
    });

    return Promise.all([
      fetchLatestSnapshot('r1'),
      fetchComments('r1'),
      fetchRepos(),
      fetchSnapshotHistory('r1'),
      fetchMe(),
    ]).then(() => {
      expect(globalFetch).not.toHaveBeenCalled();
    });
  });

  it('reads the latest snapshot through the client', async () => {
    mocked.getLatestSnapshot.mockResolvedValue({
      id: 42,
      repo_id: 7,
      created_at: '2026-01-01T00:00:00Z',
      files: [
        {
          path: 'src/a.py',
          loc: 10,
          complexity_score: 1,
          churn_score: 2,
          health_score: 90,
          imports: [],
        },
      ],
      overall_health_score: 77.5,
    });

    const snapshot = await fetchLatestSnapshot('7');

    expect(mocked.getLatestSnapshot).toHaveBeenCalledWith('7');
    // Ids are stringified at the boundary so the graph's local strict types hold.
    expect(snapshot.id).toBe('42');
    expect(snapshot.repo_id).toBe('7');
    expect(snapshot.overall_health_score).toBe(77.5);
    expect(snapshot.files).toHaveLength(1);
  });

  it('reads comments as an array, not the {data,count} envelope', async () => {
    // The client unwraps the envelope. If this layer ever bypassed it again,
    // `.map` on the result would throw and the graph would show no comments.
    mocked.listComments.mockResolvedValue([
      {
        id: 1,
        repo_id: 2,
        snapshot_id: 3,
        file_path: 'src/a.py',
        author_id: 4,
        body: 'note',
        x: 0.1,
        y: 0.2,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const comments = await fetchComments('2');

    expect(mocked.listComments).toHaveBeenCalledWith('2');
    expect(Array.isArray(comments)).toBe(true);
    expect(comments[0].id).toBe('1');
    expect(comments[0].body).toBe('note');
  });

  it('sends the comment body to the server instead of inventing the row', async () => {
    mocked.createComment.mockResolvedValue({
      id: 'server-id',
      repo_id: 'r1',
      snapshot_id: 's1',
      file_path: 'src/a.py',
      author_id: 'u9',
      body: '  real note  ',
      x: 0.5,
      y: 0.5,
      created_at: '2026-01-02T00:00:00Z',
    });

    const created = await createComment({
      repo_id: 'r1',
      snapshot_id: 's1',
      file_path: 'src/a.py',
      body: '  real note  ',
      x: 0.5,
      y: 0.5,
    });

    expect(mocked.createComment).toHaveBeenCalledWith('r1', {
      snapshot_id: 's1',
      file_path: 'src/a.py',
      body: '  real note  ',
      x: 0.5,
      y: 0.5,
    });
    // id, author_id and created_at come from the response, so the optimistic
    // pin can be reconciled with what was actually stored.
    expect(created.id).toBe('server-id');
    expect(created.author_id).toBe('u9');
  });

  it('projects history to the two fields the chart reads', async () => {
    mocked.getSnapshotHistory.mockResolvedValue([
      {
        id: 1,
        repo_id: 2,
        created_at: '2026-01-01T00:00:00Z',
        overall_health_score: 60,
      },
      {
        id: 2,
        repo_id: 2,
        created_at: '2026-01-08T00:00:00Z',
        overall_health_score: 71,
      },
    ]);

    const history = await fetchSnapshotHistory('2');

    expect(mocked.getSnapshotHistory).toHaveBeenCalledWith('2');
    expect(history).toEqual([
      { created_at: '2026-01-01T00:00:00Z', overall_health_score: 60 },
      { created_at: '2026-01-08T00:00:00Z', overall_health_score: 71 },
    ]);
  });

  it('propagates a client failure rather than swallowing it', async () => {
    mocked.getLatestSnapshot.mockRejectedValue(new Error('401 Unauthorized'));
    await expect(fetchLatestSnapshot('r1')).rejects.toThrow('401 Unauthorized');
  });
});