/**
 * Shared domain types.
 *
 * Every interface here mirrors a shape in `CONTRACTS.md` (the shared source of
 * truth). If a shape changes, CONTRACTS.md changes first — then this file.
 */

/** `User` in CONTRACTS.md. */
export interface User {
  id: string | number;
  email: string;
  github_username: string;
  created_at: string;
}

/** `Repo` in CONTRACTS.md — a GitHub repo the current user connected. */
export interface Repo {
  id: string | number;
  owner_id: string | number;
  github_full_name: string;
  connected_at: string;
  default_branch: string;
  /**
   * Set when the most recent analysis attempt failed, cleared on the next
   * success. `null` when there is nothing to report.
   */
  last_analyze_error?: string | null;
}

/**
 * One entry of the `GET /github/repos` connect picker — a small projection
 * of the user's GitHub repos (see CONTRACTS.md REST API surface).
 */
export interface GithubRepoLite {
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  language: string | null;
  updated_at: string | null;
}

/** `FileNode` in CONTRACTS.md. */
export interface FileNode {
  path: string;
  loc: number;
  complexity_score: number;
  churn_score: number;
  health_score: number;
  imports: string[];
}

/** `AnalysisSnapshot` in CONTRACTS.md. */
export interface AnalysisSnapshot {
  id: string | number;
  repo_id: string | number;
  created_at: string;
  files: FileNode[];
  overall_health_score: number; // 0-100, higher = healthier
}

/**
 * `SnapshotSummary` in CONTRACTS.md — one point on the health trend.
 *
 * Deliberately NOT AnalysisSnapshot: the history endpoint returns summaries
 * with no `files`, so typing it as a full snapshot claimed a field the server
 * never sends.
 */
export interface SnapshotSummary {
  id: string | number;
  repo_id: string | number;
  created_at: string;
  overall_health_score: number;
}

/**
 * List envelope served by every collection endpoint (`ReposPublic`,
 * `CommentsPublic`, `SnapshotsList` in CONTRACTS.md).
 *
 * The client unwraps `.data` at the boundary so features never handle the
 * envelope, but the wire type is named here because that is what axios sees.
 */
export interface ListEnvelope<T> {
  data: T[];
  count: number;
}

/** Response body of `POST /repos/{id}/analyze`. */
export interface AnalyzeQueuedResponse {
  message: string;
  repo_id: string;
}

/** `Comment` in CONTRACTS.md (renamed to avoid shadowing the DOM type). */
export interface CommentPin {
  id: string | number;
  repo_id: string | number;
  snapshot_id: string | number;
  file_path: string;
  author_id: string | number;
  body: string;
  x: number;
  y: number;
  created_at: string;
}

/** `AI review output shape` in CONTRACTS.md. */
export interface AiReviewResult {
  pr_number: number;
  risk_score: number; // 0-100
  summary: string;
  flags: AiReviewFlag[];
  updated_files: string[];
  /** Server-computed: findings dropped because the file was not in the diff. */
  dropped_flags?: number;
}

export interface AiReviewFlag {
  file: string;
  severity: 'low' | 'medium' | 'high';
  note: string;
  /** Optional; validated against the diff's hunks before persistence. */
  line_start?: number;
  line_end?: number;
}

/** Health tone derived from a 0-100 health score. Uses the health.* design tokens. */
export type HealthTone = 'good' | 'medium' | 'bad';

/** Complexity tone derived from a complexity score. */
export type ComplexityTone = 'low' | 'medium' | 'high';