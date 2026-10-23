import { Suspense, lazy } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/errors/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useSnapshotHistory } from '@/features/repos/hooks/use-repos';
import { LazyGuidedTour } from '@/features/tour/LazyGuidedTour';
import { HISTORY_TOUR } from '@/features/tour/steps';
import { useDocumentMeta } from '@/lib/seo';

/**
 * `recharts` is the single largest dependency in the bundle: 356.24 kB raw /
 * 103.75 kB gzip, against an app bundle of 292.35 kB / 94.19 kB. It is reachable
 * only from this route, so it is loaded on demand rather than shipped to the
 * landing page, the login page and the dashboard -- which is everyone who has
 * not deliberately navigated here.
 *
 * The skeleton below reserves the chart's height (320px, matching TrendChart's
 * default) so the layout does not jump when the chunk resolves. Without it the
 * page grows 320px a moment after load.
 *
 * Verified by the bundle-size check in CI (docs/audit/04-test-strategy.md T6),
 * so this cannot silently regress back into a static import.
 */
const TrendChart = lazy(() =>
  import('@/features/graph/components/TrendChart').then((m) => ({
    default: m.TrendChart,
  }))
);

type RepoHistoryParams = {
  repoId: string;
};

export function RepoHistory() {
  const { repoId = '' } = useParams<RepoHistoryParams>();

  useDocumentMeta({
    title: 'Snapshot history',
    description: 'Repository health over time.',
    path: `/repos/${repoId}/history`,
    noindex: true,
  });

  const { data, isPending, isError, error, refetch } = useSnapshotHistory(repoId);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div
        className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line/60 bg-surface/60 p-6 backdrop-blur-xl shadow-xs"
        data-tour="history-header"
      >
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-1.5 -ml-2 text-ink-dim hover:text-ink"
          >
            <Link to={`/repos/${repoId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to map
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Health history</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
              Analytics
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-ink-dim">
            Overall health score trend across analysis snapshots and git refactors.
          </p>
        </div>
      </div>

      <div data-tour="history-chart">
        {isPending ? (
          <Skeleton className="h-[360px] w-full rounded-2xl" />
        ) : isError ? (
          <ErrorState
            title="Couldn't load history"
            error={error}
            onRetry={() => void refetch()}
          />
        ) : data && data.length > 0 ? (
          <Suspense
            fallback={
              <Skeleton
                className="h-[320px] w-full rounded-lg"
                aria-label="Loading chart"
              />
            }
          >
            <TrendChart repoId={repoId} />
          </Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line/80 bg-surface/40 px-6 py-16 text-center backdrop-blur-xl">
            <Clock className="h-8 w-8 text-ink-faint" />
            <p className="text-sm font-medium text-ink">
              No snapshots recorded yet for this repo.
            </p>
            <p className="text-xs text-ink-dim max-w-xs">
              Run your first analysis from the map view to record baseline health metrics.
            </p>
          </div>
        )}
      </div>

      {/* Vorpy's guided tour. Lazy: see `mascot-boundary.test.ts`. */}
      <LazyGuidedTour tour={HISTORY_TOUR} />
    </div>
  );
}