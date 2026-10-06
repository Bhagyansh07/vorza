import { Outlet } from 'react-router-dom';

import { Navbar } from '@/components/layout/Navbar';

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Vorza, the living, AI-reviewed map of your codebase
      </footer>
    </div>
  );
}