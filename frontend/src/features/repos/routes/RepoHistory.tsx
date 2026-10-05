import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/errors/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useSnapshotHistory } from '@/features/repos/hooks/use-repos';
import { TrendChart } from '@/features/graph';
import { useDocumentMeta } from '@/lib/seo';

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
        <>
          <TrendChart repoId={repoId} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No snapshots recorded yet for this repo.
        </p>
      )}
    </div>
  );
}