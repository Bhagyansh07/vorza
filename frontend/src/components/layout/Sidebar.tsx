import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

import { Logo } from '@/components/brand/Logo';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { useUser } from '@/features/auth/hooks/use-auth';
import { cn } from '@/lib/utils';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-accent font-medium text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
  );

/**
 * The authed workspace rail (desktop). The logo, the workspace nav and the
 * signed-in user sit in the same fixed column; the mobile shell keeps the
 * existing top Navbar for small screens (`lg:hidden` in AppShell).
 */
export function Sidebar() {
  const user = useUser();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-background lg:flex">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Link to="/dashboard" aria-label="Vorza dashboard">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Workspace">
        <p className="px-2 pb-1 pt-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-faint">
          Workspace
        </p>
        <NavLink to="/dashboard" end className={navLinkClass}>
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </NavLink>
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        {user ? (
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
              {user.github_username.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-ink">
                {user.github_username}
              </p>
              <p className="flex items-center gap-1.5 text-xs leading-tight text-ink-dim">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-signal-good"
                />
                Connected
              </p>
            </div>
          </div>
        ) : null}
        <LogoutButton />
      </div>
    </aside>
  );
}