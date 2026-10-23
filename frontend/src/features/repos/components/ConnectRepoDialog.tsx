import { useMemo, useState } from 'react';
import { CheckIcon, Loader2, PlusIcon, RefreshCcw, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConnectRepo, useGithubRepos, useRepos } from '@/features/repos/hooks/use-repos';
import { toErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

export function ConnectRepoDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const connectRepo = useConnectRepo();
  const { data: githubRepos, isPending, isError, error, refetch, isRefetching } =
    useGithubRepos();
  const { data: connectedRepos } = useRepos();

  const connectedNames = useMemo(
    () => new Set((connectedRepos ?? []).map((r) => r.github_full_name)),
    [connectedRepos]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return githubRepos ?? [];
    return (githubRepos ?? []).filter((r) =>
      r.full_name.toLowerCase().includes(q)
    );
  }, [githubRepos, query]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = name.trim();
    if (!fullName) return;
    try {
      const repo = await connectRepo.mutateAsync({ github_full_name: fullName });
      toast.success(`Connected ${repo.github_full_name}`);
      setName('');
      setOpen(false);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  const connectFromPicker = async (fullName: string) => {
    try {
      const repo = await connectRepo.mutateAsync({ github_full_name: fullName });
      toast.success(`Connected ${repo.github_full_name}`);
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
          <PlusIcon className="h-4 w-4" />
          Connect repo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl border border-line/80 bg-surface/95 backdrop-blur-2xl shadow-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-ink">Connect a GitHub repo</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-ink-dim">
              Pick from your GitHub repos or type an `owner/name` manually.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-3 flex items-center gap-2">
              <Label htmlFor="github-picker-search" className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
                Your GitHub repos
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-ink-dim hover:text-ink hover:bg-raised rounded-full"
                onClick={() => void refetch()}
                disabled={isRefetching}
                aria-label="Refresh GitHub repos"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {isPending ? (
              <div className="flex items-center gap-2 rounded-2xl border border-line/60 bg-surface/50 px-4 py-8 text-sm text-ink-dim">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading your repos from GitHub…
              </div>
            ) : isError ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-signal-warn/30 bg-signal-warn/10 px-4 py-5 text-sm text-ink-dim">
                <span className="text-signal-warn font-medium">Couldn't load your GitHub repos: {toErrorMessage(error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit rounded-xl border-signal-warn/40"
                  onClick={() => void refetch()}
                >
                  <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line/80 bg-surface/40 px-4 py-8 text-center text-sm text-ink-dim">
                {query.trim()
                  ? `No GitHub repos match "${query.trim()}"`
                  : 'No GitHub repos found to list.'}
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <Input
                    id="github-picker-search"
                    className="pl-9 rounded-xl border-line/70 bg-surface/80 text-sm focus:border-primary/50"
                    placeholder="Search your repos…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <ul className="max-h-64 divide-y divide-line/40 overflow-y-auto rounded-2xl border border-line/60 bg-surface/60 backdrop-blur-md">
                  {filtered.map((repo) => {
                    const connected = connectedNames.has(repo.full_name);
                    return (
                      <li
                        key={repo.full_name}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-raised/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {repo.full_name}
                            {repo.private ? (
                              <span className="ml-1.5 rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-medium text-ink-dim border border-line/60">
                                private
                              </span>
                            ) : null}
                          </p>
                          {repo.description ? (
                            <p className="truncate text-xs text-ink-dim">
                              {repo.description}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={connected ? 'outline' : 'default'}
                          className={cn(
                            'shrink-0 rounded-lg text-xs font-semibold gap-1.5',
                            connected
                              ? 'border-line/70 text-ink-dim'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                          )}
                          disabled={connected || connectRepo.isPending}
                          onClick={() => void connectFromPicker(repo.full_name)}
                        >
                          {connected ? (
                            <>
                              <CheckIcon className="h-3.5 w-3.5 text-signal-good" /> Connected
                            </>
                          ) : (
                            <PlusIcon className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="mb-4">
            <Label htmlFor="repo-name" className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              Or type an `owner/repo`
            </Label>
            <Input
              id="repo-name"
              className="mt-1.5 rounded-xl border-line/70 bg-surface/80 text-sm focus:border-primary/50"
              placeholder="owner/repo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={connectRepo.isPending}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl text-ink-dim hover:text-ink"
              onClick={() => setOpen(false)}
              disabled={connectRepo.isPending}
            >
              Done
            </Button>
            <Button
              type="submit"
              disabled={connectRepo.isPending || !name.trim()}
              className="rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md"
            >
              {connectRepo.isPending ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}