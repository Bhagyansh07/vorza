import type {
  AnalysisSnapshot,
  AnalyzeQueuedResponse,
  CommentPin,
  Repo,
  SnapshotSummary,
  User,
} from '@/types';

/** Re-export the contract model types so features can import them from one place. */
export type {
  AnalysisSnapshot,
  AnalyzeQueuedResponse,
  CommentPin,
  FileNode,
  ListEnvelope,
  Repo,
  SnapshotSummary,
  User,
  AiReviewFlag,
  AiReviewResult,
  ComplexityTone,
  HealthTone,
} from '@/types';

/**
 * Auth contract (Agent 1 owns the backend side — see CONTRACTS.md).
 * POST /auth/github/callback — Auth0-style code exchange.
 */
export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in?: number;
  user: User;
}

export interface LoginWithGitHubCodeInput {
  code: string;
  /** Signed by the backend via GET /auth/github/login; must be echoed back. */
  state?: string;
}

export interface ConnectRepoInput {
  /**
   * `github_full_name` from the Repo contract, e.g. "facebook/react".
   * Matches what the backend stores on Repo.
   */
  github_full_name: string;
}

export interface CreateCommentInput {
  snapshot_id: string | number;
  file_path: string;
  body: string;
  x: number;
  y: number;
}

/**
 * Server data-access interface. Implemented by the HTTP client (Agent 1's
 * backend) and by the mock adapter in src/lib/mock-api.ts.
 *
 * Covers every endpoint in the CONTRACTS.md REST table. `/webhooks/github` is
 * intentionally absent — it is a server-side receiver (GitHub → backend), the
 * frontend never calls it.
 */
/**
 * Server data-access interface. Implemented by the HTTP client (Agent 1's
 * backend) and by the mock adapter in src/lib/mock-api.ts.
 *
 * Covers every endpoint in the CONTRACTS.md REST table. `/webhooks/github` is
 * intentionally absent — it is a server-side receiver (GitHub → backend), the
 * frontend never calls it.
 *
 * Collection endpoints return unwrapped arrays. The backend serves a
 * `{data, count}` envelope on the wire (`ListEnvelope`); unwrapping happens
 * once, inside the client, so no feature has to know about it. The backend
 * contract is pinned by `backend/tests/test_frontend_contract.py`.
 */
export interface ApiClient {
  // auth
  loginWithGitHubCode(input: LoginWithGitHubCodeInput): Promise<AuthResponse>;
  getMe(): Promise<User>;
  logOut(): Promise<void>;

  // repos
  listRepos(): Promise<Repo[]>;
  connectRepo(input: ConnectRepoInput): Promise<Repo>;

  // snapshots / analysis
  getLatestSnapshot(repoId: string | number): Promise<AnalysisSnapshot>;
  /** Summaries, not full snapshots — the history endpoint omits `files`. */
  getSnapshotHistory(
    repoId: string | number
  ): Promise<SnapshotSummary[]>;
  analyzeRepo(repoId: string | number): Promise<AnalyzeQueuedResponse>;

  // comments
  listComments(repoId: string | number): Promise<CommentPin[]>;
  createComment(
    repoId: string | number,
    input: CreateCommentInput
  ): Promise<CommentPin>;
}