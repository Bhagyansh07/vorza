import { Link, useParams } from 'react-router-dom';
import {
  ActivityIcon,
  ArrowLeft,
  HistoryIcon,
  RefreshCcw,
  UsersIcon,
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
import { GraphView, mockRealtimeSource } from '@/features/graph';

type RepoDetailParams = {
  repoId: string;
};

export function RepoDetail() {
  const { repoId = '' } = useParams<RepoDetailParams>();
  const { data: repos } = useRepos();
  const snapshot = useLatestSnapshot(repoId);
  const analyzeRepo = useAnalyzeRepo(repoId);

  const repo = repos?.find((r) => String(r.id) === repoId);

  const runAnalysis = async () => {
    try {
      const result = await analyzeRepo.mutateAsync();
      toast.success(`Analysis ${result.status === 'queued' ? 'queued' : 'started'}`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
            <Link to="/dashboard">
              <ArrowLeft />
              All repos
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            {repo?.github_full_name ?? repoId}
          </h1>
          {repo ? (
            <p className="text-sm text-muted-foreground">
              default branch{' '}
              <span className="font-mono">{repo.default_branch}</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            data-testid="history-link"
          >
            <Link to={`/repos/${repoId}/history`}>
              <HistoryIcon />
              Health history
            </Link>
          </Button>
          <Button size="sm" onClick={runAnalysis} disabled={analyzeRepo.isPending}>
            <RefreshCcw />
            {analyzeRepo.isPending ? 'Analyzing…' : 'Analyze now'}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {snapshot.isPending && !snapshot.data ? (
          <>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </>
        ) : snapshot.isError ? (
          <Card className="sm:col-span-3">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Latest snapshot isn't ready yet — no analysis available.
            </CardContent>
          </Card>
        ) : snapshot.data ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <ActivityIcon className="h-3.5 w-3.5" />
                  Overall health
                </CardDescription>
                <CardTitle>
                  <Badge className={healthBadgeClasses(snapshot.data.overall_health_score)}>
                    {snapshot.data.overall_health_score.toFixed(0)}/100
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <UsersIcon className="h-3.5 w-3.5" />
                  Files mapped
                </CardDescription>
                <CardTitle>{snapshot.data.files.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last analyzed</CardDescription>
                <CardTitle>
                  {new Date(snapshot.data.created_at).toLocaleDateString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        ) : null}
      </div>

      <div className="h-[560px]">
        <GraphView
          repoId={repoId}
          repoName={repo?.github_full_name}
          realtime={mockRealtimeSource}
        />
      </div>
    </div>
  );
}