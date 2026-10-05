/**
 * Graph feature's data access: typed delegations to the shared API client.
 *
 * This file used to be a second, independent fetch layer:
 *
 * - `API_BASE = ""`, so every non-mock call went to the *frontend* origin, not
 *   the backend. `/me`, `/repos/...` are backend paths; on Vercel they 404.
 * - raw `fetch` with no Authorization header, so even a correct URL would have
 *   been rejected by the API's bearer-token dependency.
 * - no envelope unwrapping, so `{data, count}` came back as an object where
 *   `AnalysisSnapshot[]` was declared.
 * - `const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false"`, which
 *   defaults to **true** when unset. Nothing in the repo sets `VITE_USE_MOCK`
 *   (the declared variable is `VITE_USE_MOCKS`), so in production this layer
 *   silently served fixtures -- a plausible-looking graph full of invented
 *   files.
 *
 * `useGraphView` read its snapshot and comments through all of that, so the
 * live graph never touched the real API.
 *
 * Now it delegates to `api`, which is the single switch: the HTTP client with
 * auth and envelope handling, or the mock adapter when `VITE_USE_MOCKS=true`.
 * Same pattern as `features/repos/api/repos.ts`.
 *
 * The conversions below are the one deliberate difference. This feature declares
 * its own stricter string-only types locally, while the shared contract types
 * allow `string | number` for ids. Coercing at the boundary keeps that
 * decision inside the feature instead of widening every consumer.
 */
import { api } from '@/lib/api-client';
import type {
  AnalysisSnapshot as ContractSnapshot,
  CommentPin,
  Repo,
  SnapshotSummary,
  User,
} from '@/lib/api-types';

import type {
  AnalysisSnapshot,
  Comment,
  SnapshotHistoryPoint,
} from '../types';

export async function fetchMe(): Promise<User> {
  const user = await api.getMe();
  return {
    id: String(user.id),
    email: user.email,
    github_username: user.github_username,
    created_at: String(user.created_at),
  };
}

export async function fetchRepos(): Promise<Repo[]> {
  const repos = await api.listRepos();
  return repos.map((repo) => ({
    id: String(repo.id),
    owner_id: String(repo.owner_id),
    github_full_name: repo.github_full_name,
    connected_at: String(repo.connected_at),
    default_branch: repo.default_branch,
  }));
}

export async function fetchLatestSnapshot(
  repoId: string
): Promise<AnalysisSnapshot> {
  const snapshot: ContractSnapshot = await api.getLatestSnapshot(repoId);
  return {
    id: String(snapshot.id),
    repo_id: String(snapshot.repo_id),
    created_at: String(snapshot.created_at),
    files: snapshot.files,
    overall_health_score: snapshot.overall_health_score,
  };
}

export async function fetchSnapshotHistory(
  repoId: string
): Promise<SnapshotHistoryPoint[]> {
  const history: SnapshotSummary[] = await api.getSnapshotHistory(repoId);
  return history.map((point) => ({
    created_at: String(point.created_at),
    overall_health_score: point.overall_health_score,
  }));
}

function toComment(pin: CommentPin): Comment {
  return {
    id: String(pin.id),
    repo_id: String(pin.repo_id),
    snapshot_id: String(pin.snapshot_id),
    file_path: pin.file_path,
    author_id: String(pin.author_id),
    body: pin.body,
    x: pin.x,
    y: pin.y,
    created_at: String(pin.created_at),
  };
}

export async function fetchComments(repoId: string): Promise<Comment[]> {
  const pins = await api.listComments(repoId);
  return pins.map(toComment);
}

export async function createComment(
  input: Omit<Comment, 'id' | 'created_at' | 'author_id'>
): Promise<Comment> {
  const pin = await api.createComment(input.repo_id, {
    snapshot_id: input.snapshot_id,
    file_path: input.file_path,
    body: input.body,
    x: input.x,
    y: input.y,
  });
  // id, author_id and created_at come from the server. The old implementation
  // invented them locally (`cmt-local-${Date.now()}`, author "you") before
  // posting, which meant a comment rendered optimistically could never be
  // reconciled with the row that was actually stored.
  return toComment(pin);
}