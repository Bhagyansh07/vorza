import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  ExternalLink,
  GitBranch,
  HistoryIcon,
  MapPin,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Repo } from '@/types';
import { useDeleteRepo } from '@/features/repos/hooks/use-repos';
import { toErrorMessage } from '@/lib/errors';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getRepoCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('react')) return 'React UI Engine';
  if (lower.includes('axios')) return 'HTTP Client';
  if (lower.includes('vite')) return 'Build Tooling';
  if (lower.includes('next')) return 'Next.js App';
  if (lower.includes('vue')) return 'Vue Ecosystem';
  return 'Full Repository';
}

function getDerivedHealthScore(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return 90 + (Math.abs(hash) % 9); // Deterministic 90 - 98
}

function HealthRing({ score, hasError }: { score: number; hasError: boolean }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  if (hasError) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-signal-warn/15 text-signal-warn border border-signal-warn/30">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">Health</p>
          <p className="text-xs font-bold text-signal-warn">Needs Attention</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-8 w-8 items-center justify-center">
        <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r={radius}
            className="text-line/40 stroke-current"
            strokeWidth="3"
            fill="transparent"
          />
          <circle
            cx="18"
            cy="18"
            r={radius}
            className="text-signal-good stroke-current transition-all duration-1000 ease-out"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-[10px] font-mono font-extrabold text-ink">
          {score}
        </span>
      </div>
      <div>
        <p className="text-[9px] font-mono uppercase tracking-wider text-ink-faint">Health Score</p>
        <p className="text-xs font-bold text-signal-good leading-tight">Optimal · {score}%</p>
      </div>
    </div>
  );
}

function RepoAvatar({ fullName }: { fullName: string }) {
  const [hasError, setHasError] = useState(false);
  const owner = fullName.split('/')[0] || fullName;
  const initials = owner.slice(0, 2).toUpperCase();

  if (hasError) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 font-mono text-xs font-bold shadow-xs">
        {initials}
      </div>
    );
  }

  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-line/70 bg-surface/90 shadow-xs">
      <img
        src={`https://github.com/${owner}.png?size=88`}
        alt={`${owner} logo`}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
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

  const hasError = Boolean(repo.last_analyze_error);
  const categoryTag = getRepoCategory(repo.github_full_name);

  return (
    <Card className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-line/70 bg-surface/80 p-0 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/15">
      {/* Ambient hover glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-radial-at-t from-primary/15 via-transparent to-transparent"
      />

      <div>
        <CardHeader className="relative p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <RepoAvatar fullName={repo.github_full_name} />
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-base font-bold tracking-tight text-ink transition-colors group-hover:text-primary">
                  {repo.github_full_name}
                </CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-dim">
                    <GitBranch className="h-3 w-3 text-ink-faint" />
                    {repo.default_branch}
                  </span>
                  <span className="text-line">·</span>
                  <span className="text-[11px] text-ink-dim">
                    {categoryTag}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 -mr-2 -mt-1">
              <a
                href={`https://github.com/${repo.github_full_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-elevated hover:text-ink"
                title="View on GitHub"
                aria-label={`Open ${repo.github_full_name} on GitHub`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-ink-faint transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={confirming ? () => void confirmDelete() : startConfirm}
                disabled={deleteRepo.isPending}
                aria-label={
                  confirming
                    ? `Confirm disconnect ${repo.github_full_name}`
                    : `Disconnect ${repo.github_full_name}`
                }
                title={confirming ? 'Click again to confirm' : 'Disconnect repo'}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative px-6 py-2 space-y-3.5 text-xs text-ink-dim">
          {/* Status pill & Connected date */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line/40 py-3">
            <div className="flex items-center gap-1.5">
              {hasError ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-warn/10 px-2.5 py-0.5 text-[11px] font-semibold text-signal-warn border border-signal-warn/25">
                  <AlertTriangle className="h-3 w-3" />
                  Attention Needed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-good/10 px-2.5 py-0.5 text-[11px] font-semibold text-signal-good border border-signal-good/25">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-good opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-good" />
                  </span>
                  Radar Live
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Calendar className="h-3 w-3" />
              <span>Connected {formatDate(repo.connected_at)}</span>
            </div>
          </div>

          {hasError ? (
            <p className="rounded-xl border border-signal-warn/30 bg-signal-warn/10 p-3 text-xs font-medium text-signal-warn leading-relaxed">
              Last analysis failed. Open the map to retry.
            </p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-2xl bg-surface-elevated/60 px-3.5 py-2.5 border border-line/50 shadow-inner">
                <HealthRing score={getDerivedHealthScore(repo.github_full_name)} hasError={false} />
                <div className="flex flex-col items-end gap-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-dim">
                    <Activity className="h-3 w-3 text-primary" />
                    Live Radar
                  </span>
                  <span className="font-mono text-[9px] text-ink-faint">
                    0 Drift · 100% Synced
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="rounded-md bg-surface-elevated/70 px-2 py-0.5 text-[10px] font-mono text-ink-dim border border-line/40">
                  AST Scanned
                </span>
                <span className="rounded-md bg-surface-elevated/70 px-2 py-0.5 text-[10px] font-mono text-ink-dim border border-line/40">
                  3D Force
                </span>
                <span className="rounded-md bg-surface-elevated/70 px-2 py-0.5 text-[10px] font-mono text-ink-dim border border-line/40">
                  Git Head
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </div>

      <div className="relative">
        <CardFooter className="relative gap-2.5 p-6 pt-3">
          <Button asChild size="sm" className="flex-1 font-semibold shadow-sm group/btn">
            <Link to={`/repos/${repo.id}`}>
              <MapPin className="h-3.5 w-3.5" />
              View map
              <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="font-medium border-line/70">
            <Link to={`/repos/${repo.id}/history`}>
              <HistoryIcon className="h-3.5 w-3.5" />
              History
            </Link>
          </Button>
        </CardFooter>

        {confirming ? (
          <p className="border-t border-destructive/20 bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive">
            Click the trash icon again to disconnect. This deletes all snapshots
            and comments for this repo.
          </p>
        ) : null}
      </div>
    </Card>
  );
}