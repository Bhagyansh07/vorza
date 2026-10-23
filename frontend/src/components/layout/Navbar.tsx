import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { useUser } from '@/features/auth/hooks/use-auth';
import { cn } from '@/lib/utils';

export function Navbar({ className }: { className?: string }) {
  const user = useUser();

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-line/60 bg-surface/80 backdrop-blur-xl shadow-xs transition-colors',
        className
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" aria-label="Vorza dashboard">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-dim transition-colors hover:bg-raised hover:text-ink"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-line/70 bg-surface/70 px-2 py-1 text-sm outline-none transition-all hover:border-primary/40 hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {user.github_username.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline font-medium text-ink text-xs pr-1">
                  {user.github_username}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass-panel">
                <DropdownMenuLabel>
                  <span className="block text-sm font-medium text-ink">
                    {user.github_username}
                  </span>
                  <span className="block truncate text-xs font-normal text-ink-dim">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                  <LogoutButton />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}