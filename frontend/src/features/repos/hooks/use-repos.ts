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
  GithubRepoLite,
  Repo,
  SnapshotSummary,
} from '@/lib/api-types';

import {
  connectNewRepo,
  deleteConnectedRepo,
  fetchComments,
  fetchLatestSnapshot,
  fetchSnapshotHistory,
  listConnectedRepos,
  listGithubRepos,
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
  githubRepos: ['github', 'repos'] as const,
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

export function useGithubRepos(): UseQueryResult<GithubRepoLite[]> {
  return useQuery({
    queryKey: queryKeys.githubRepos,
    queryFn: listGithubRepos,
  });
}

export function useDeleteRepo(): UseMutationResult<
  void,
  Error,
  string | number
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteConnectedRepo,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos });
      void queryClient.invalidateQueries({ queryKey: queryKeys.githubRepos });
    },
  });
}

export function useLatestSnapshot(
  repoId: string | number | undefined
): UseQueryResult<AnalysisSnapshot> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.repoSnapshot(repoId ?? ''),
    queryFn: async () => {
      try {
        return await fetchLatestSnapshot(repoId as string | number);
      } catch (error) {
        // While the snapshot is missing, keep the connected-repo row in sync
        // too: the backend records WHY the latest analysis failed on
        // Repo.last_analyze_error, and refreshing the list surfaces that
        // reason in the "Map unavailable" state.
        void queryClient.invalidateQueries({ queryKey: queryKeys.repos });
        throw error;
      }
    },
    enabled: repoId !== undefined,
    // The dashboard polls the latest snapshot on a steady timer. While the
    // snapshot is missing the endpoint 404s and the page sits on "Map
    // unavailable", so polling is what flips it to the map when the analyze
    // task finishes (the realtime snapshot:updated event needs Redis, which
    // the free Render tier does not have). After the first fetch the polling is
    // cheap: http-client replays the stored ETag and the backend answers 304
    // (R10) instead of re-sending the bandwidth-heavy graph, so keeping the
    // timer running keeps the map fresh without a manual refresh.
    refetchInterval: 30000,
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
      // Refresh the repo row (clears/stale-picks last_analyze_error) and let
      // the snapshot poll pick up the new map.
      void queryClient.invalidateQueries({ queryKey: queryKeys.repo(repoId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos });
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