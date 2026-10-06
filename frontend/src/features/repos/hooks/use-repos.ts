import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  AnalysisSnapshot,
  AnalyzeQueuedResponse,
  CommentPin,
  ConnectRepoInput,
  CreateCommentInput,
  Repo,
  SnapshotSummary,
} from '@/lib/api-types';

import {
  connectNewRepo,
  fetchComments,
  fetchLatestSnapshot,
  fetchSnapshotHistory,
  listConnectedRepos,
  postComment,
  triggerAnalysis,
} from '@/features/repos/api/repos';

export const queryKeys = {
  repos: ['repos'] as const,
  repo: (repoId: string | number) => ['repos', String(repoId)] as const,
  repoSnapshot: (repoId: string | number) =>
    ['repos', String(repoId), 'snapshots', 'latest'] as const,
  repoHistory: (repoId: string | number) =>
    ['repos', String(repoId), 'snapshots', 'history'] as const,
  repoComments: (repoId: string | number) =>
    ['repos', String(repoId), 'comments'] as const,
};

export function useRepos(): UseQueryResult<Repo[]> {
  return useQuery({
    queryKey: queryKeys.repos,
    queryFn: listConnectedRepos,
  });
}

export function useConnectRepo(): UseMutationResult<
  Repo,
  Error,
  ConnectRepoInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: connectNewRepo,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos });
    },
  });
}

export function useLatestSnapshot(
  repoId: string | number | undefined
): UseQueryResult<AnalysisSnapshot> {
  return useQuery({
    queryKey: queryKeys.repoSnapshot(repoId ?? ''),
    queryFn: () => fetchLatestSnapshot(repoId as string | number),
    enabled: repoId !== undefined,
    // Until the first snapshot exists the endpoint 404s and the page sits on
    // "Map unavailable" with no way to learn the analyze task finished (the
    // realtime snapshot:updated event needs Redis, which the free Render tier
    // does not have). Poll every few seconds while the snapshot is missing so
    // "Analyze now" visibly flips the page to the map without a manual refresh.
    refetchInterval: (query) => (query.state.data ? false : 4000),
  });
}

export function useSnapshotHistory(
  repoId: string | number | undefined
): UseQueryResult<SnapshotSummary[]> {
  return useQuery({
    queryKey: queryKeys.repoHistory(repoId ?? ''),
    queryFn: () => fetchSnapshotHistory(repoId as string | number),
    enabled: repoId !== undefined,
  });
}

export function useAnalyzeRepo(
  repoId: string | number
): UseMutationResult<AnalyzeQueuedResponse, Error> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => triggerAnalysis(repoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repo(repoId) });
    },
  });
}

export function useRepoComments(
  repoId: string | number | undefined
): UseQueryResult<CommentPin[]> {
  return useQuery({
    queryKey: queryKeys.repoComments(repoId ?? ''),
    queryFn: () => fetchComments(repoId as string | number),
    enabled: repoId !== undefined,
  });
}

export function useCreateComment(
  repoId: string | number
): UseMutationResult<CommentPin, Error, CreateCommentInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => postComment(repoId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repoComments(repoId),
      });
    },
  });
}