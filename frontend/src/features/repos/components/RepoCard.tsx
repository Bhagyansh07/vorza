import { Link } from 'react-router-dom';
import { GitBranch, GitFork, HistoryIcon, MapIcon } from 'lucide-react';

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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

interface RepoCardProps {
  repo: Repo;
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <Card className="flex h-full flex-col transition-colors hover:border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <GitFork className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          <CardTitle className="truncate text-lg leading-tight">
            {repo.github_full_name}
          </CardTitle>
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
    </Card>
  );
}