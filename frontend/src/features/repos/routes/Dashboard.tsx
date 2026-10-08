import { AlertTriangle, CircleCheck, GitFork } from 'lucide-react';

import { ErrorState } from '@/components/errors/ErrorState';
import { BentoCard, BentoGrid } from '@/components/ui/bento-grid';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ConnectRepoDialog } from '@/features/repos/components/ConnectRepoDialog';
import { RepoCard } from '@/features/repos/components/RepoCard';
import { RepoListSkeleton } from '@/features/repos/components/RepoListSkeleton';
import { useRepos } from '@/features/repos/hooks/use-repos';
import type { Repo } from '@/lib/api-types';
import { useDocumentMeta } from '@/lib/seo';

/**
 * Honest dashboard strip: every number is derived from the connected repo
 * list, never invented. `mapped` and `needingAttention` are mutually exclusive
 * partitions of the same list, so the three cards always sum consistently.
 */
function RepoMetrics({ repos }: { repos: Repo[] }) {
  const total = repos.length;
  const needingAttention = repos.filter((repo) => repo.last_analyze_error).length;
  const mapped = total - needingAttention;

  return (
    <BentoGrid className="mb-8 auto-rows-[9rem]">
      <BentoCard
        title="Repositories"
        description="Connected to GitHub and mapped"
        icon={<GitFork className="h-5 w-5" />}
        stat={<NumberTicker value={total} />}
        className="col-span-3 sm:col-span-1"
      />
      <BentoCard
        title="Mapped without issues"
        description="Analyses completed, nothing pending"
        icon={
          <span className="text-signal-good">
            <CircleCheck className="h-5 w-5" />
          </span>
        }
        stat={<NumberTicker value={mapped} />}
        className="col-span-3 sm:col-span-1"
      />
      <BentoCard
        title="Re-analysis needed"
        description="Last analysis reported a problem"
        icon={
          <span className="text-signal-warn">
            <AlertTriangle className="h-5 w-5" />
          </span>
        }
        stat={<NumberTicker value={needingAttention} />}
        className="col-span-3 sm:col-span-1"
      />
    </BentoGrid>
  );
}

export function Dashboard() {
  // Authed: no standalone value in a search result, and it renders nothing
  // for a crawler because it sits behind ProtectedRoute.
  useDocumentMeta({
    title: 'Connected repositories',
    description: 'Your connected repositories in Vorza.',
    path: '/dashboard',
    noindex: true,
  });

  const { data: repos, isPending, isError, error, refetch, isRefetching } =
    useRepos();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Connected repositories</h1>
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
        <>
          <RepoMetrics repos={repos} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map((repo) => (
              <RepoCard key={String(repo.id)} repo={repo} />
            ))}
          </div>
        </>
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