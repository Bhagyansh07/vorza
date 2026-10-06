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
    <Card className="flex h-full flex-col transition-colors hover:border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <GitFork className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          <CardTitle className="truncate text-lg leading-tight">
            {repo.github_full_name}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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
      <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="font-mono">{repo.default_branch}</span>
        </p>
        <Badge variant="secondary" className="font-normal">
          Connected {formatDate(repo.connected_at)}
        </Badge>
        {repo.last_analyze_error ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Last analysis failed — open the map to retry.
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button asChild size="sm" className="flex-1">
          <Link to={`/repos/${repo.id}`}>
            <MapIcon />
            View map
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`/repos/${repo.id}/history`}>
            <HistoryIcon />
            History
          </Link>
        </Button>
      </CardFooter>
      {confirming ? (
        <p className="border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
          Click the trash icon again to disconnect. This deletes all snapshots
          and comments for this repo.
        </p>
      ) : null}
    </Card>
  );
}