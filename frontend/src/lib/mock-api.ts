/**
 * Mock adapter implementing ApiClient with in-browser fake data.
 *
 * Used while Agent 1's backend is still landing (see `.env.example`:
 * `VITE_USE_MOCKS=true`). All shapes match CONTRACTS.md exactly. Swap the env
 * flag to `false` and these are never called.
 */

import type {
  AnalysisSnapshot,
  CommentPin,
  FileNode,
  Repo,
  User,
} from '@/types';
import type {
  ApiClient,
  AuthResponse,
  ConnectRepoInput,
  CreateCommentInput,
  LoginWithGitHubCodeInput,
} from '@/lib/api-types';

import { setAccessToken } from '@/lib/token';

const MOCK_TOKEN = 'mock-jwt-token';

const delay = (ms = 350): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const mockUser: User = {
  id: 'u_1',
  email: 'dev@codeatlas.dev',
  github_username: 'codeatlas-dev',
  created_at: new Date().toISOString(),
};

const mockRepos: Repo[] = [
  {
    id: 'r_1',
    owner_id: 'u_1',
    github_full_name: 'facebook/react',
    connected_at: '2026-08-02T09:00:00Z',
    default_branch: 'main',
  },
  {
    id: 'r_2',
    owner_id: 'u_1',
    github_full_name: 'axios/axios',
    connected_at: '2026-08-14T15:30:00Z',
    default_branch: 'v1.x',
  },
  {
    id: 'r_3',
    owner_id: 'u_1',
    github_full_name: 'vitejs/vite',
    connected_at: '2026-09-01T11:20:00Z',
    default_branch: 'main',
  },
];

function buildFileNodes(): FileNode[] {
  return [
    { path: 'src/app.tsx', loc: 420, complexity_score: 28, churn_score: 42, health_score: 72, imports: ['src/lib/api.ts'] },
    { path: 'src/lib/api.ts', loc: 310, complexity_score: 44, churn_score: 61, health_score: 48, imports: ['src/types.ts'] },
    { path: 'src/lib/utils.ts', loc: 95, complexity_score: 8, churn_score: 12, health_score: 94, imports: [] },
    { path: 'src/components/dashboard.tsx', loc: 260, complexity_score: 22, churn_score: 33, health_score: 81, imports: ['src/app.tsx', 'src/lib/api.ts'] },
    { path: 'src/lib/api.ts', loc: 310, complexity_score: 44, churn_score: 61, health_score: 48, imports: ['src/types.ts'] },
  ];
}

function buildSnapshot(repoId: string | number, offsetDays: number): AnalysisSnapshot {
  const created = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  const drift = (offsetDays * 3) % 20;
  const files = buildFileNodes().map((f, i) => ({
    ...f,
    health_score: Math.max(15, 100 - drift * 2 - i * 7),
    complexity_score: Math.max(5, f.complexity_score - drift),
    loc: f.loc + i * 4,
  }));
  return {
    id: `snap_${repoId}_${offsetDays}`,
    repo_id: repoId,
    created_at: created.toISOString(),
    files,
    overall_health_score: Math.max(
      20,
      100 - drift * 3
    ),
  };
}

const mockComments: CommentPin[] = [
  {
    id: 'c_1',
    repo_id: 'r_1',
    snapshot_id: 'snap_r_1_0',
    file_path: 'src/lib/api.ts',
    author_id: 'u_1',
    body: 'This module is getting hard to reason about — worth a refactor.',
    x: 120,
    y: 80,
    created_at: '2026-09-10T10:00:00Z',
  },
];

export const mockApiClient: ApiClient = {
  async loginWithGitHubCode(
    _input: LoginWithGitHubCodeInput
  ): Promise<AuthResponse> {
    await delay();
    setAccessToken(MOCK_TOKEN);
    return {
      access_token: MOCK_TOKEN,
      token_type: 'bearer',
      expires_in: 3600,
      user: mockUser,
    };
  },

  async getMe(): Promise<User> {
    await delay(200);
    return mockUser;
  },

  async logOut(): Promise<void> {
    await delay(100);
  },

  async listRepos(): Promise<Repo[]> {
    await delay();
    return [...mockRepos];
  },

  async connectRepo(input: ConnectRepoInput): Promise<Repo> {
    await delay();
    const repo: Repo = {
      id: `r_${Date.now()}`,
      owner_id: 'u_1',
      github_full_name: input.github_full_name,
      connected_at: new Date().toISOString(),
      default_branch: 'main',
    };
    mockRepos.push(repo);
    return repo;
  },

  async getLatestSnapshot(
    repoId: string | number
  ): Promise<AnalysisSnapshot> {
    await delay();
    return buildSnapshot(repoId, 0);
  },

  async getSnapshotHistory(
    repoId: string | number
  ): Promise<AnalysisSnapshot[]> {
    await delay();
    return [14, 7, 3, 0].map((days) => buildSnapshot(repoId, days));
  },

  async analyzeRepo(
    _repoId: string | number
  ): Promise<{ status: string }> {
    await delay(600);
    return { status: 'queued' };
  },

  async listComments(repoId: string | number): Promise<CommentPin[]> {
    await delay();
    return mockComments.filter((c) => c.repo_id === repoId);
  },

  async createComment(
    repoId: string | number,
    input: CreateCommentInput
  ): Promise<CommentPin> {
    await delay();
    const comment: CommentPin = {
      id: `c_${Date.now()}`,
      repo_id: repoId,
      snapshot_id: input.snapshot_id,
      file_path: input.file_path,
      body: input.body,
      x: input.x,
      y: input.y,
      author_id: 'u_1',
      created_at: new Date().toISOString(),
    };
    mockComments.push(comment);
    return comment;
  },
};