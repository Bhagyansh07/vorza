import { useState, useMemo } from 'react';
import { AlertTriangle, CircleCheck, GitFork, Search, SlidersHorizontal, X } from 'lucide-react';

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
    <BentoGrid className="mb-8 auto-rows-auto grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
      <BentoCard
        title="Repositories"
        description="Connected to GitHub and mapped"
        icon={<GitFork className="h-5 w-5" />}
        stat={<NumberTicker value={total} />}
        className="col-span-1"
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
        className="col-span-1"
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
        className="col-span-1"
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

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'healthy' | 'attention'>('all');

  const filteredRepos = useMemo(() => {
    if (!repos) return [];
    return repos.filter((r) => {
      const matchesQuery =
        !query ||
        r.github_full_name.toLowerCase().includes(query.toLowerCase()) ||
        r.default_branch.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (filter === 'healthy') return !r.last_analyze_error;
      if (filter === 'attention') return Boolean(r.last_analyze_error);
      return true;
    });
  }, [repos, query, filter]);

  const needingAttentionCount = repos?.filter((r) => r.last_analyze_error).length ?? 0;
  const healthyCount = (repos?.length ?? 0) - needingAttentionCount;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div
        className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-line/70 bg-surface/75 p-6 sm:p-8 backdrop-blur-2xl shadow-xl transition-all"
        data-tour="dash-header"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-good opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-good" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary font-bold">
              Repository Workspace · Codebase Radar
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Connected repositories
          </h1>
          <p className="max-w-xl text-xs sm:text-sm text-ink-dim leading-relaxed">
            Pick a repository to open its live force-directed map and health analytics.
          </p>
        </div>
        <div data-tour="dash-connect" className="flex items-center gap-3">
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

          {/* Interactive Search & Filter Controls */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/60 bg-surface/60 p-3 backdrop-blur-xl">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search connected repositories by name or branch…"
                className="w-full rounded-xl border border-line/50 bg-surface-elevated/40 py-2 pl-9 pr-8 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  filter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-surface-elevated/50 text-ink-dim hover:text-ink hover:bg-surface-elevated'
                }`}
              >
                All ({repos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('healthy')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  filter === 'healthy'
                    ? 'bg-signal-good text-black shadow-xs'
                    : 'bg-surface-elevated/50 text-ink-dim hover:text-ink hover:bg-surface-elevated'
                }`}
              >
                Healthy ({healthyCount})
              </button>
              {needingAttentionCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilter('attention')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    filter === 'attention'
                      ? 'bg-signal-warn text-black shadow-xs'
                      : 'bg-surface-elevated/50 text-ink-dim hover:text-ink hover:bg-surface-elevated'
                  }`}
                >
                  Needs Attention ({needingAttentionCount})
                </button>
              ) : null}
            </div>
          </div>

          <div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            data-tour="dash-repos"
          >
            {filteredRepos.map((repo) => (
              <RepoCard key={String(repo.id)} repo={repo} />
            ))}
          </div>

          {filteredRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line/60 bg-surface/30 p-12 text-center">
              <SlidersHorizontal className="h-8 w-8 text-ink-faint" />
              <p className="text-sm font-medium text-ink">No repositories match your filter</p>
              <button
                type="button"
                onClick={() => { setQuery(''); setFilter('all'); }}
                className="text-xs font-semibold text-primary underline underline-offset-4"
              >
                Reset filters
              </button>
            </div>
          ) : null}
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