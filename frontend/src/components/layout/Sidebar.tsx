import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { useUser } from '@/features/auth/hooks/use-auth';
import { cn } from '@/lib/utils';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-primary/10 text-primary shadow-xs border border-primary/20'
      : 'text-ink-dim hover:bg-raised/70 hover:text-ink'
  );

/**
 * The authed workspace rail (desktop). Features luxury glassmorphic border,
 * theme toggle, workspace navigation, and active user card.
 */
export function Sidebar() {
  const user = useUser();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line/60 bg-surface/80 backdrop-blur-xl lg:flex shadow-xs"
      data-tour="nav-rail"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/60 px-5">
        <Link to="/dashboard" aria-label="Vorza dashboard">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4" aria-label="Workspace">
        <p className="px-2 pb-1 pt-1 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-faint">
          Workspace
        </p>
        <NavLink to="/dashboard" end className={navLinkClass}>
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </NavLink>
      </nav>

      <div className="space-y-2 border-t border-line/60 p-4 bg-surface/40">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl border border-line/50 bg-raised/50 p-2.5 backdrop-blur-xs">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary border border-primary/30">
              {user.github_username.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-ink">
                {user.github_username}
              </p>
              <p className="flex items-center gap-1.5 text-xs leading-tight text-ink-dim mt-0.5">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-signal-good shadow-xs"
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