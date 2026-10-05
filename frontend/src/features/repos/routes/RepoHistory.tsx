import { Suspense, lazy } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/errors/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useSnapshotHistory, useAnalyzeRepo } from '@/features/repos/hooks/use-repos';
import { EmptyState } from '@/components/empty/EmptyState';
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
        >
          <Link to={`/repos/${repoId}`}>
            <ArrowLeft />
            Back to map
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Health history</h1>
        <p className="text-sm text-muted-foreground">
          Overall health score trend across analysis snapshots.
        </p>
      </div>

      {isPending ? (
        <Skeleton className="h-[360px] w-full rounded-lg" />
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
        <p className="text-sm text-muted-foreground">
          No snapshots recorded yet for this repo.
        </p>
      )}
    </div>
  );
}