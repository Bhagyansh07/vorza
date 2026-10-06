import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Logo, LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { absoluteUrl, useDocumentMeta } from '@/lib/seo';

/**
 * Public marketing page, and the only indexable page the app has.
 *
 * This existed because of a measurement, not a hunch. `/` used to redirect to
 * `/dashboard`, which sits behind `ProtectedRoute`, so a crawler fetched an
 * empty `<div id="root">` and left. The app had exactly zero indexable content
 * and zero share previews. This page is real HTML with real copy, so both
 * problems have somewhere to point.
 *
 * The hero carries one screenshot of the running product and nothing else:
 * no illustration, no mock-up built out of divs. `product-map.png` is captured
 * from the live graph view, and if it ever fails to load the figure removes
 * itself rather than leaving a broken frame on the page.
 */

const FEATURES = [
  {
    title: 'Every file is a node',
    body: 'A force-directed layout over real import edges. Clusters are packages, hubs are the files everything depends on, and outliers are the ones worth reading.',
    metric: 'import-graph layout',
  },
  {
    title: 'Health, not vibes',
    body: 'Each file is scored on cyclomatic complexity, churn over the last three months and its own coupling. The colour on the map is that number, not a gradient.',
    metric: 'complexity + churn + coupling',
  },
  {
    title: 'Pull requests get read',
    body: 'A GitHub webhook hands the diff to a model and comes back with a risk score and a list of files with reasons attached. Quiet when nothing is wrong.',
    metric: 'risk score + cited flags',
  },
  {
    title: 'It stays live',
    body: 'Snapshots stream to open graphs over a WebSocket, and comment pins stay anchored to the coordinates you dropped them on. Two people can look at the same map.',
    metric: 'socket push + pinned comments',
  },
  {
    title: 'Trend, not just state',
    body: 'Every analysis is kept. The history view plots health over time so a refactor that works shows up as a line going the right way.',
    metric: 'snapshot history',
  },
  {
    title: 'Boring on purpose',
    body: 'FastAPI, SQLModel and Postgres behind it. SQLite by default, one Postgres URL on deploy. No vector database, no message queue you have to babysit.',
    metric: 'FastAPI + SQLModel',
  },
] as const;

const FACTS = [
  ['Auth', 'GitHub OAuth, bearer JWT'],
  ['Realtime', 'WebSocket, in-process pub/sub'],
  ['Storage', 'Postgres in prod, SQLite locally'],
  ['Hosted on', 'Render + Vercel free tiers'],
] as const;

export function Landing() {
  const [hasShot, setHasShot] = useState(true);

  useDocumentMeta({
    title: 'Vorza - the living, AI-reviewed map of your codebase',
    description:
      'Vorza turns a GitHub repo into a force-directed map of every file, scores each one on complexity, churn and health, and flags risky pull requests with reasons attached.',
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Vorza',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      url: absoluteUrl('/'),
      description:
        'The living, AI-reviewed map of your codebase. Force-directed repo maps, file health scores and pull-request risk review.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: FEATURES.map((feature) => feature.title),
    },
  });

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

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-12 pt-16 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-stem border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-dim">
            <LogoMark className="h-3.5 w-3.5 text-primary" />
            Open source, self-hostable
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-5xl">
            The living, AI-reviewed map of your codebase.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-dim">
            Every file becomes a node: sized by how much of the codebase
            depends on it, coloured by how healthy it is. Pull requests get read
            before you do.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to="/login">Connect a repo</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            Sign in with GitHub. Vorza asks for the{' '}
            <code className="font-mono text-xs text-ink-dim">repo</code> scope,
            which is the scope GitHub offers for cloning.
          </p>
        </section>

        {hasShot ? (
          <section aria-label="Product screenshot" className="mx-auto max-w-6xl px-6 pb-20">
            <figure className="overflow-hidden rounded-lg border border-line bg-surface shadow-panel">
              <img
                src="/product-map.png"
                alt="The Vorza map of a repository: files drawn as nodes on a force-directed graph, connected by import edges and coloured by health score."
                width={2400}
                height={1350}
                loading="eager"
                decoding="async"
                className="block w-full"
                onError={() => setHasShot(false)}
              />
            </figure>
          </section>
        ) : null}

        <section aria-labelledby="how-it-works" className="border-t border-line bg-surface py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2
              id="how-it-works"
              className="text-2xl font-semibold tracking-[-0.01em]"
            >
              What it actually does
            </h2>
            <div className="mt-10 grid gap-x-12 gap-y-9 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="border-t border-line pt-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-primary">
                    {feature.metric}
                  </p>
                  <h3 className="mt-2 font-medium leading-tight text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="stack" className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="stack" className="text-2xl font-semibold tracking-[-0.01em]">
              What it runs on
            </h2>
            <p className="mt-3 max-w-2xl text-ink-dim">
              Small enough to read in an afternoon, cheap enough to leave
              running.
            </p>
            <dl className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {FACTS.map(([term, value]) => (
                <div key={term} className="bg-surface px-5 py-5">
                  <dt className="text-xs font-medium uppercase tracking-[0.06em] text-ink-faint">
                    {term}
                  </dt>
                  <dd className="tabular mt-2 text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {/*
              This used to say "read access to the repos you connect and nothing
              else". It was false: the backend requests GitHub's `repo` scope,
              which grants read *and write* to repositories, plus invitations,
              collaborators, webhooks and org resources. There is no OAuth scope
              that clones a repo without write access, so the scope is not going
              away. Narrowing it needs a GitHub App with fine-grained
              permissions (roadmap F14), so the page states what GitHub
              actually offers instead.
            */}
            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink-faint">
              The <code className="font-mono text-xs">repo</code> scope covers
              every repository the account can reach, and it grants write as
              well as read. Vorza only ever reads. Narrowing it to read-only
              needs a GitHub App, tracked as F14.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p>Vorza, the living, AI-reviewed map of your codebase.</p>
          <nav aria-label="Footer" className="flex items-center gap-4">
            <Link className="transition-colors hover:text-ink" to="/login">
              Sign in
            </Link>
            <a
              className="transition-colors hover:text-ink"
              href="https://github.com/Bhagyansh07/codeatlas"
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
