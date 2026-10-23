import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';

/**
 * Shared layout for the public legal pages: the same header and footer as the
 * landing page, with a narrower article column for reading. The copy on the
 * pages that use this shell is plain English about what the service actually
 * does, so each fact here traces to code in the repository.
 */

import { ThemeToggle } from '@/components/ui/theme-toggle';

export function LegalShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Unified cyber grid and radial ambient auras */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(168,242,90,0.09),transparent_70%)] z-0" />
      <div className="pointer-events-none fixed inset-0 bg-cyber-grid bg-[size:44px_44px] opacity-15 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,black_40%,transparent_100%)] z-0" />

      {/* Floating Island Navbar */}
      <header className="sticky top-4 z-40 mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between rounded-full border border-line/70 bg-surface/85 px-5 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition-all">
          <Link to="/" aria-label="Vorza home" className="flex items-center gap-2">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-xs font-medium text-ink-dim hover:text-ink">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-1.5 text-xs shadow-xs">
              <Link to="/login">Connect a repo</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-line/70 bg-surface/70 p-8 sm:p-12 shadow-2xl backdrop-blur-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary font-semibold">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-ink-faint">
            last updated · {updated}
          </p>
          <div className="mt-10 space-y-8">{children}</div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-line/60 bg-surface/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-xs text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-faint">Vorza, the living, AI-reviewed map of your codebase.</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-5 font-medium">
            <Link className="transition-colors hover:text-ink" to="/login">
              Sign in
            </Link>
            <Link className="transition-colors hover:text-ink" to="/privacy">
              Privacy
            </Link>
            <Link className="transition-colors hover:text-ink" to="/terms">
              Terms
            </Link>
            <a
              className="transition-colors hover:text-ink"
              href="https://github.com/Bhagyansh07/vorza"
              rel="noreferrer noopener"
              target="_blank"
            >
              Source
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="text-lg font-medium text-ink">{heading}</h2>
      <div className="mt-3 max-w-prose space-y-3 text-sm leading-relaxed text-ink-dim">
        {children}
      </div>
    </section>
  );
}