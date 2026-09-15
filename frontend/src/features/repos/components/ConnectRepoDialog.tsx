import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
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
import { useConnectRepo } from '@/features/repos/hooks/use-repos';
import { toErrorMessage } from '@/lib/errors';

export function ConnectRepoDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const connectRepo = useConnectRepo();

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          Connect repo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Connect a GitHub repo</DialogTitle>
            <DialogDescription>
              Enter the repository in `owner/name` form, e.g. `facebook/react`.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="repo-name">Repository</Label>
            <Input
              id="repo-name"
              placeholder="owner/repo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
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
              Cancel
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