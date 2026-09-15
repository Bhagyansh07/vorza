import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LineChart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/errors/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useSnapshotHistory } from '@/features/repos/hooks/use-repos';

type RepoHistoryParams = {
  repoId: string;
};

export function RepoHistory() {
  const { repoId = '' } = useParams<RepoHistoryParams>();
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
          {/*
           * CHARTS SLOT — owned by Agent 4 (see STATUS.md).
           * Agent 4: create `src/features/graph/components/HistoryCharts.tsx`
           * accepting `{ repoId: string }` and render it here, replacing this
           * placeholder. The query hook `useSnapshotHistory` is already wired.
           */}
          <div
            id="history-slot"
            data-repo-id={repoId}
            className="flex h-[360px] flex-col items-center justify-center rounded-lg border border-border bg-card/40 p-6 text-center"
          >
            <LineChart className="mb-2 h-8 w-8 text-primary/70" />
            <p className="font-medium text-foreground/80">
              Trend charts coming from Agent 4
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.length} snapshot{data.length === 1 ? '' : 's'} available for{' '}
              <code className="rounded bg-secondary px-1">repoId={repoId}</code>
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No snapshots recorded yet for this repo.
        </p>
      )}
    </div>
  );
}