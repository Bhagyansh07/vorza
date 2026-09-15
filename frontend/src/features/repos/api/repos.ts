import { api } from '@/lib/api-client';
import type {
  AnalysisSnapshot,
  CommentPin,
  ConnectRepoInput,
  CreateCommentInput,
  Repo,
} from '@/lib/api-types';

/** Feature API module — typed delegations to the shared client. */

export function listConnectedRepos(): Promise<Repo[]> {
  return api.listRepos();
}

export function connectNewRepo(input: ConnectRepoInput): Promise<Repo> {
  return api.connectRepo(input);
}

export function fetchLatestSnapshot(
  repoId: string | number
): Promise<AnalysisSnapshot> {
  return api.getLatestSnapshot(repoId);
}

export function fetchSnapshotHistory(
  repoId: string | number
): Promise<AnalysisSnapshot[]> {
  return api.getSnapshotHistory(repoId);
}

export function triggerAnalysis(
  repoId: string | number
): Promise<{ status: string }> {
  return api.analyzeRepo(repoId);
}

export function fetchComments(repoId: string | number): Promise<CommentPin[]> {
  return api.listComments(repoId);
}

export function postComment(
  repoId: string | number,
  input: CreateCommentInput
): Promise<CommentPin> {
  return api.createComment(repoId, input);
}