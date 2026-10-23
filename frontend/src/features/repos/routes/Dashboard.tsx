import { AlertTriangle, CircleCheck, GitFork } from 'lucide-react';

import { ErrorState } from '@/components/errors/ErrorState';
import { BentoCard, BentoGrid } from '@/components/ui/bento-grid';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ConnectRepoDialog } from '@/features/repos/components/ConnectRepoDialog';
import { RepoCard } from '@/features/repos/components/RepoCard';
import { RepoListSkeleton } from '@/features/repos/components/RepoListSkeleton';
import { useRepos } from '@/features/repos/hooks/use-repos';
import { LazyGuidedTour } from '@/features/tour/LazyGuidedTour';
import { DASHBOARD_TOUR } from '@/features/tour/steps';
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
  useDocumentMeta({
    title: 'Connected repositories',
    description: 'Your connected repositories in Vorza.',
    path: '/dashboard',
    noindex: true,
  });

  const { data: repos, isPending, isError, error, refetch, isRefetching } =
    useRepos();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div
        className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line/70 bg-surface/75 p-6 backdrop-blur-2xl shadow-xl transition-all"
        data-tour="dash-header"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-signal-good shadow-xs" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary font-bold">
              Repository Workspace · Codebase Radar
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Connected repositories
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-dim">
            Pick a repository to open its live force-directed map and health analytics.
          </p>
        </div>
        <div data-tour="dash-connect">
          <ConnectRepoDialog />
        </div>
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
          <div data-tour="dash-metrics">
            <RepoMetrics repos={repos} />
          </div>
          <div
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            data-tour="dash-repos"
          >
            {repos.map((repo) => (
              <RepoCard key={String(repo.id)} repo={repo} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line/80 bg-surface/40 px-6 py-20 text-center backdrop-blur-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <GitFork className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-ink">No repos connected yet</h3>
            <p className="mt-1 max-w-sm text-xs sm:text-sm text-ink-dim leading-relaxed">
              Connect your first GitHub repository and Vorza will analyze its
              shape, dependencies, and health.
            </p>
          </div>
          <ConnectRepoDialog />
        </div>
      )}

      {/* Vorpy's guided tour. Lazy: see `mascot-boundary.test.ts`. */}
      <LazyGuidedTour tour={DASHBOARD_TOUR} />
    </div>
  );
}