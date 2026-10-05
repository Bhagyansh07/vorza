import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { absoluteUrl, useDocumentMeta } from '@/lib/seo';

/**
 * Public marketing page, and the only indexable page the app has.
 *
 * This existed because of a measurement, not a hunch. `/` used to redirect to
 * `/dashboard`, which sits behind `ProtectedRoute`, so a crawler fetched an
 * empty `<div id="root">` and left. The app had exactly zero indexable content
 * and zero share previews. This page is real HTML with real copy, so both
 * problems have somewhere to point.
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
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]"
            />
            Vorza
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
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-20">
          <Badge variant="secondary" className="mb-6 font-normal">
            Open source · self-hostable
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            The living, AI-reviewed map of your codebase.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Point Vorza at a repo. Every file becomes a node, sized by how much
            of the codebase depends on it and coloured by how healthy it is.
            Then let a webhook read the pull requests before you do.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to="/login">Connect a repo</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Sign in with GitHub. Vorza asks for read access to the repos you
            connect and nothing else.
          </p>
        </section>

        <section
          aria-labelledby="how-it-works"
          className="border-y bg-surface/40 py-20"
        >
          <div className="mx-auto max-w-6xl px-6">
            <h2
              id="how-it-works"
              className="text-2xl font-semibold tracking-tight"
            >
              What it actually does
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="bg-card/60">
                  <CardContent className="p-5">
                    <h3 className="font-medium leading-tight">{feature.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                      {feature.body}
                    </p>
                    <p className="tabular mt-4 text-xs text-muted-foreground/70">
                      {feature.metric}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="stack" className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="stack" className="text-2xl font-semibold tracking-tight">
              What it runs on
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Small enough to read in an afternoon, cheap enough to leave running.
            </p>
            <dl className="mt-10 divide-y border-y">
              {FACTS.map(([term, value]) => (
                <div key={term} className="flex gap-6 py-3.5">
                  <dt className="w-32 shrink-0 text-sm text-muted-foreground">
                    {term}
                  </dt>
                  <dd className="tabular text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Vorza — the living, AI-reviewed map of your codebase</p>
          <nav aria-label="Footer" className="flex items-center gap-4">
            <Link className="hover:text-foreground" to="/login">
              Sign in
            </Link>
            <a
              className="hover:text-foreground"
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