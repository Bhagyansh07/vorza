import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

function ShellFallback() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      role="status"
    >
      <p className="text-sm text-muted-foreground">Loading workspace…</p>
    </div>
  );
}

/**
 * Authed layout. Desktop gets the fixed Sidebar rail; small screens keep the
 * sticky Navbar. The route content suspends while a lazy chunk loads.
 */
export function AppShell() {
  return (
    <div className="relative flex min-h-svh flex-col bg-background text-foreground overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Unified cyber grid and radial ambient auras across all app workspace routes */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-12%,rgba(168,242,90,0.08),transparent_70%)] z-0" />
      <div className="pointer-events-none fixed inset-0 bg-cyber-grid bg-[size:40px_40px] opacity-15 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black_35%,transparent_100%)] z-0" />

      <Sidebar />
      <div className="relative z-40 flex min-h-svh flex-col lg:pl-64">
        <Navbar className="lg:hidden" />
        <main className="flex-1">
          <Suspense fallback={<ShellFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="border-t border-line/60 bg-surface/40 backdrop-blur-md py-5 text-center text-xs text-ink-dim">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
            <div className="flex items-center gap-2 font-mono text-[11px] text-ink-faint">
              <span className="flex h-1.5 w-1.5 rounded-full bg-signal-good shadow-xs" />
              <span>Vorza Platform v2.4 · All systems nominal</span>
            </div>
            <p className="text-xs text-ink-faint">
              Software intelligence &amp; live codebase mapping
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}