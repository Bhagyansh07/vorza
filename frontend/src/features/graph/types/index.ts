export interface User {
  id: string;
  email: string;
  github_username: string;
  created_at: string;
}

export interface Repo {
  id: string;
  owner_id: string;
  github_full_name: string;
  connected_at: string;
  default_branch: string;
}

export interface FileNode {
  path: string;
  loc: number;
  complexity_score: number;
  churn_score: number;
  health_score: number;
  imports: string[];
}

export interface AnalysisSnapshot {
  id: string;
  repo_id: string;
  created_at: string;
  files: FileNode[];
  overall_health_score: number;
}

export interface Comment {
  id: string;
  repo_id: string;
  snapshot_id: string;
  file_path: string;
  author_id: string;
  body: string;
  x: number;
  y: number;
  created_at: string;
}

export interface SnapshotHistoryPoint {
  created_at: string;
  overall_health_score: number;
}

export interface PresenceCursor {
  user_id: string;
  x: number;
  y: number;
}

export interface ReviewResult {
  pr_number: number;
  risk_score: number;
  summary: string;
  flags: Array<{
    file: string;
    severity: "low" | "medium" | "high";
    note: string;
  }>;
  updated_files: string[];
}

export interface GraphNode {
  id: string;
  path: string;
  loc: number;
  complexity_score: number;
  churn_score: number;
  health_score: number;
  imports: string[];
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface RealtimeScope {
  onSnapshotUpdated: (snapshot: AnalysisSnapshot) => void;
  onCursor: (cursor: PresenceCursor) => void;
  onComment: (comment: Comment) => void;
  onReview: (review: ReviewResult) => void;
}

export interface RealtimeSource {
  connect: (repoId: string, scope: RealtimeScope) => () => void;
}