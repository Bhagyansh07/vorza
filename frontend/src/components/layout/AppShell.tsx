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
    <div className="flex min-h-svh flex-col bg-background">
      <Sidebar />
      <div className="flex min-h-svh flex-col lg:pl-64">
        <Navbar className="lg:hidden" />
        <main className="flex-1">
          <Suspense fallback={<ShellFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          Vorza, the living, AI-reviewed map of your codebase
        </footer>
      </div>
    </div>
  );
}