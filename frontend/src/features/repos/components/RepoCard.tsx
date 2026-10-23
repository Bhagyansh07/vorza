import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, GitFork, HistoryIcon, MapIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Repo } from '@/features/repos/types';
import { useDeleteRepo } from '@/features/repos/hooks/use-repos';
import { toErrorMessage } from '@/lib/errors';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

interface RepoCardProps {
  repo: Repo;
}

export function RepoCard({ repo }: RepoCardProps) {
  const deleteRepo = useDeleteRepo();
  const [confirming, setConfirming] = useState(false);
  const revertTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (revertTimer.current !== undefined) {
        window.clearTimeout(revertTimer.current);
      }
    };
  }, []);

  const startConfirm = () => {
    setConfirming(true);
    revertTimer.current = window.setTimeout(() => setConfirming(false), 4000);
  };

  const confirmDelete = async () => {
    try {
      await deleteRepo.mutateAsync(repo.id);
      toast.success(`Disconnected ${repo.github_full_name}`);
    } catch (error) {
      toast.error(toErrorMessage(error));
      setConfirming(false);
    }
  };

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line/70 bg-surface/80 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/15">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-radial-at-t from-primary/15 via-transparent to-transparent"
      />
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <GitFork className="h-4 w-4" />
          </div>
          <CardTitle className="truncate text-base font-semibold leading-tight text-ink flex-1 pt-1">
            {repo.github_full_name}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-ink-faint hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full"
            onClick={confirming ? () => void confirmDelete() : startConfirm}
            disabled={deleteRepo.isPending}
            aria-label={
              confirming
                ? `Confirm disconnect ${repo.github_full_name}`
                : `Disconnect ${repo.github_full_name}`
            }
            title={confirming ? 'Click again to confirm' : 'Disconnect repo'}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative flex-1 space-y-2.5 text-xs text-ink-dim">
        <p className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-ink-faint" />
          <span className="font-mono text-ink font-medium">{repo.default_branch}</span>
        </p>
        <div>
          <Badge variant="secondary" className="font-medium text-[11px] rounded-md px-2 py-0.5 border border-line/60">
            Connected {formatDate(repo.connected_at)}
          </Badge>
        </div>
        {repo.last_analyze_error ? (
          <p className="rounded-lg border border-signal-warn/30 bg-signal-warn/10 p-2 text-xs font-medium text-signal-warn">
            Last analysis failed. Open the map to retry.
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="relative gap-2 pt-2">
        <Button asChild size="sm" className="flex-1 shadow-sm font-medium">
          <Link to={`/repos/${repo.id}`}>
            <MapIcon className="h-3.5 w-3.5" />
            View map
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="font-medium">
          <Link to={`/repos/${repo.id}/history`}>
            <HistoryIcon className="h-3.5 w-3.5" />
            History
          </Link>
        </Button>
      </CardFooter>

      {confirming ? (
        <p className="border-t border-line/60 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
          Click the trash icon again to disconnect. This deletes all snapshots
          and comments for this repo.
        </p>
      ) : null}
    </Card>
  );
}