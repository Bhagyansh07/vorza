import { GitFork, LayoutDashboard } from 'lucide-react';

import { ErrorState } from '@/components/errors/ErrorState';
import { ConnectRepoDialog } from '@/features/repos/components/ConnectRepoDialog';
import { RepoCard } from '@/features/repos/components/RepoCard';
import { RepoListSkeleton } from '@/features/repos/components/RepoListSkeleton';
import { useRepos } from '@/features/repos/hooks/use-repos';

export function Dashboard() {
  const { data: repos, isPending, isError, error, refetch, isRefetching } =
    useRepos();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Connected repositories
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a repo to open its live map.
          </p>
        </div>
        <ConnectRepoDialog />
      </div>

      {isPending || (isRefetching && !repos) ? (
        <RepoListSkeleton />
      ) : isError ? (
        <ErrorState
          title="Couldn't load your repositories"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : repos && repos.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <RepoCard key={String(repo.id)} repo={repo} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <GitFork className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No repos connected yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Connect your first GitHub repository and Vorza will analyze its
            shape and health.
          </p>
          <ConnectRepoDialog />
        </div>
      )}
    </div>
  );
}