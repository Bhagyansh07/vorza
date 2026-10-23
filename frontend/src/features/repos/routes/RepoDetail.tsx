import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ActivityIcon,
  ArrowLeft,
  Calendar,
  FileCode2,
  HistoryIcon,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAnalyzeRepo,
  useLatestSnapshot,
  useRepos,
} from '@/features/repos/hooks/use-repos';
import { toErrorMessage } from '@/lib/errors';
import { healthBadgeClasses } from '@/lib/health';
// Imported from the module, not from '@/features/graph'. The barrel
// re-exports TrendChart, which imports recharts -- and a barrel import
// drags that 356 kB / 103.75 kB gzip chunk into the main bundle no matter
// who lazy-imports TrendChart. See the comment on the barrel itself.
import { GraphView } from '@/features/graph/components/GraphView';
import { EmptyState } from '@/components/empty/EmptyState';
import { createWebSocketSource } from '@/features/graph/realtime/websocket';
import { LazyGuidedTour } from '@/features/tour/LazyGuidedTour';
import { REPO_TOUR } from '@/features/tour/steps';
import { useUser } from '@/features/auth/hooks/use-auth';
import { useDocumentMeta } from '@/lib/seo';

type RepoDetailParams = {
  repoId: string;
};

export function RepoDetail() {
  const { repoId = '' } = useParams<RepoDetailParams>();
  const currentUser = useUser();
  const { data: repos } = useRepos();

  const realtime = useMemo(
    () => createWebSocketSource({ userId: String(currentUser?.id ?? '') }),
    [currentUser?.id]
  );
  const snapshot = useLatestSnapshot(repoId);
  const analyzeRepo = useAnalyzeRepo(repoId);

  const repo = repos?.find((r) => String(r.id) === repoId);

  useDocumentMeta({
    title: repo?.github_full_name ?? 'Repository map',
    description:
      'Live force-directed map and file health scores for this repository.',
    path: `/repos/${repoId}`,
    noindex: true,
  });

  const runAnalysis = async () => {
    try {
      const result = await analyzeRepo.mutateAsync();
      toast.success(result.message ?? 'Analysis queued');
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div
        className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line/60 bg-surface/60 p-5 backdrop-blur-xl shadow-xs"
        data-tour="repo-header"
      >
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-1.5 -ml-2 text-ink-dim hover:text-ink">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              All repos
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {repo?.github_full_name ?? repoId}
          </h1>
          {repo ? (
            <p className="mt-1 text-xs text-ink-dim flex items-center gap-1.5">
              <span>default branch</span>
              <span className="font-mono font-medium rounded-md bg-raised px-1.5 py-0.5 border border-line/60 text-ink">
                {repo.default_branch}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-dim flex items-center gap-1.5">
              <span className="h-3 w-24 rounded bg-raised animate-pulse inline-block" />
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5" data-tour="repo-actions">
          <Button
            asChild
            variant="outline"
            size="sm"
            data-testid="history-link"
            className="shadow-xs font-medium"
          >
            <Link to={`/repos/${repoId}/history`}>
              <HistoryIcon className="h-4 w-4" />
              Health history
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={runAnalysis}
            disabled={analyzeRepo.isPending}
            className="shadow-sm font-medium"
          >
            <RefreshCcw className={`h-4 w-4 ${analyzeRepo.isPending ? 'animate-spin' : ''}`} />
            {analyzeRepo.isPending ? 'Analyzing…' : 'Analyze now'}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3" data-tour="repo-stats">
        {snapshot.isPending && !snapshot.data ? (
          <>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </>
        ) : snapshot.isError ? (
          <Card className="sm:col-span-3 rounded-2xl">
            <CardContent className="py-5 text-sm text-ink-dim">
              {repo?.last_analyze_error ? (
                <div className="flex flex-col items-start gap-2.5">
                  <p className="font-semibold text-ink">
                    The last analysis didn't complete
                  </p>
                  <p className="max-w-2xl text-xs leading-relaxed text-signal-warn bg-signal-warn/10 border border-signal-warn/25 p-3 rounded-xl">
                    {repo.last_analyze_error}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={runAnalysis}
                    disabled={analyzeRepo.isPending}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Try again
                  </Button>
                </div>
              ) : (
                "Latest snapshot isn't ready yet, so there is nothing to compare."
              )}
            </CardContent>
          </Card>
        ) : snapshot.data ? (
          <>
            <Card className="rounded-2xl border-line/70 bg-surface/70 backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5 font-medium text-xs">
                  <ActivityIcon className="h-4 w-4 text-primary" />
                  Overall Health
                </CardDescription>
                <CardTitle className="pt-1">
                  <Badge className={`${healthBadgeClasses(snapshot.data.overall_health_score)} text-sm font-mono px-2.5 py-1`}>
                    {snapshot.data.overall_health_score.toFixed(0)} / 100
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="rounded-2xl border-line/70 bg-surface/70 backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5 font-medium text-xs">
                  <FileCode2 className="h-4 w-4 text-primary" />
                  Files Mapped
                </CardDescription>
                <CardTitle className="font-mono text-2xl text-ink pt-1">
                  {snapshot.data.files.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="rounded-2xl border-line/70 bg-surface/70 backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5 font-medium text-xs">
                  <Calendar className="h-4 w-4 text-primary" />
                  Last Analyzed
                </CardDescription>
                <CardTitle className="font-mono text-base text-ink pt-1">
                  {new Date(snapshot.data.created_at).toLocaleDateString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        ) : (
          <div className="sm:col-span-3">
            <EmptyState
              icon={<ActivityIcon className="h-10 w-10 text-primary" />}
              title="No snapshot yet"
              body="Run your first analysis to build the file map. The graph appears after the first snapshot is created."
              primary={{
                label: 'Run analysis',
                onClick: runAnalysis,
              }}
            />
          </div>
        )}
      </div>

      <div
        className="h-[580px] overflow-hidden rounded-2xl border border-line/70 bg-surface/85 shadow-2xl backdrop-blur-xl"
        data-tour="repo-graph"
      >
        <GraphView
          repoId={repoId}
          repoName={repo?.github_full_name}
          realtime={realtime}
        />
      </div>

      {/* Vorpy's guided tour. Lazy: see `mascot-boundary.test.ts`. */}
      <LazyGuidedTour tour={REPO_TOUR} />
    </div>
  );
}