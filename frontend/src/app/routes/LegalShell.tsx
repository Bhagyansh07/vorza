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
    <div className="bg-background">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="Vorza home">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/login">Connect a repo</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-ink-faint">
          last updated · {updated}
        </p>
        <div className="mt-10 space-y-10">{children}</div>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p>Vorza, the living, AI-reviewed map of your codebase.</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
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