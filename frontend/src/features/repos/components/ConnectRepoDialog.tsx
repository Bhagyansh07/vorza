import { useMemo, useState } from 'react';
import { CheckIcon, Loader2, PlusIcon, RefreshCcw, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ShimmerButton } from '@/components/ui/shimmer-button';
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
        <ShimmerButton>
          <PlusIcon />
          Connect repo
        </ShimmerButton>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Connect a GitHub repo</DialogTitle>
            <DialogDescription>
              Pick from your GitHub repos or type an `owner/name` manually.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-3 flex items-center gap-2">
              <Label htmlFor="github-picker-search">Your GitHub repos</Label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => void refetch()}
                disabled={isRefetching}
                aria-label="Refresh GitHub repos"
              >
                <RefreshCcw className={isRefetching ? 'animate-spin' : ''} />
              </Button>
            </div>

            {isPending ? (
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your repos from GitHub…
              </div>
            ) : isError ? (
              <div className="flex flex-col gap-2 rounded-md border border-border px-3 py-4 text-sm text-muted-foreground">
                <span>Couldn't load your GitHub repos: {toErrorMessage(error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => void refetch()}
                >
                  <RefreshCcw /> Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                {query.trim()
                  ? `No GitHub repos match "${query.trim()}"`
                  : 'No GitHub repos found to list.'}
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="github-picker-search"
                    className="pl-8"
                    placeholder="Search your repos…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {filtered.map((repo) => {
                    const connected = connectedNames.has(repo.full_name);
                    return (
                      <li
                        key={repo.full_name}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {repo.full_name}
                            {repo.private ? (
                              <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground">
                                private
                              </span>
                            ) : null}
                          </p>
                          {repo.description ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {repo.description}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={connected ? 'outline' : 'default'}
                          className="shrink-0"
                          disabled={connected || connectRepo.isPending}
                          onClick={() => void connectFromPicker(repo.full_name)}
                        >
                          {connected ? (
                            <>
                              <CheckIcon /> Connected
                            </>
                          ) : (
                            <PlusIcon />
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="mb-2">
            <Label htmlFor="repo-name">Or type an `owner/repo`</Label>
            <Input
              id="repo-name"
              className="mt-1"
              placeholder="owner/repo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={connectRepo.isPending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={connectRepo.isPending}
            >
              Done
            </Button>
            <Button type="submit" disabled={connectRepo.isPending || !name.trim()}>
              {connectRepo.isPending ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}