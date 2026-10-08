import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { absoluteUrl, useDocumentMeta } from '@/lib/seo';

import { DemoMap } from '../components/DemoMap';
import { MapFrame } from '../components/MapFrame';
import { Metrics } from '../components/Metrics';
import { ReviewDemo } from '../components/ReviewDemo';
import { ScrollStory } from '../components/ScrollStory';
import { demoFiles, demoLinks, demoMetrics, demoSeedPositions } from '../components/demoData';

/**
 * Public marketing page, and the only indexable page the app has.
 *
 * This existed because of a measurement, not a hunch. `/` used to redirect to
 * `/dashboard`, which sits behind `ProtectedRoute`, so a crawler fetched an
 * empty `<div id="root">` and left. The app had exactly zero indexable content
 * and zero share previews. This page is real HTML with real copy, so both
 * problems have somewhere to point.
 *
 * Since the Phase 3 redesign the hero carries the real map renderer instead of
 * a screenshot: the same force simulation and the same `encoding.ts` colour
 * rules the product uses, fed by a clearly-labelled demo dataset (see
 * `demoData.ts`). Every map, metric and review sample on this page is either
 * derived from that dataset or labelled as a sample. Nothing here is presented
 * as a real user's repository.
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

const HOW_BUILT = [
  {
    fact: 'one model call per review',
    body: 'Suggested open-source models refuse to count lines and cite files in long diffs, so the review runs a compressed view of the diff in one call with JSON output enforced. The model can only answer on evidence it actually saw.',
  },
  {
    fact: 'health is three numbers',
    body: 'Complexity, churn and coupling collapse into one 0-100 score. The thresholds live in one file, the colour in one function, and nodes, tables and legends all read from the same source, so the map and the numbers never disagree.',
  },
  {
    fact: 'migrations are the contract',
    body: 'Alembic owns the schema and a test diffs generated migrations against the models on every run. A schema change without its migration fails CI before it can drift.',
  },
  {
    fact: 'the map is a force simulation',
    body: 'd3-force over real import edges, not a hand-drawn diagram. New files appear where imports put them, and the physics is the layout, so every repository maps honestly, including this one.',
  },
  {
    fact: 'everything runs on free tiers',
    body: 'The backend is one Render free instance with a cold start of about fifty seconds, the database is Neon Free and the frontend ships from Vercel. Deploys run three or four times a day in both directions.',
  },
] as const;

export function Landing() {
  const [surveyed, setSurveyed] = useState<string | null>(null);
  // Memoised so the three DemoMap simulations are not torn down and rebuilt
  // on every Landing re-render (e.g. when a blast-radius node is selected).
  const files = useMemo(() => demoFiles(), []);
  const links = useMemo(() => demoLinks(), []);
  const positions = useMemo(() => demoSeedPositions(), []);
  const metrics = [
    {
      value: demoMetrics().files,
      label: 'files in the demo map',
      note: 'spread across frontend, backend and docs',
    },
    {
      value: demoMetrics().lines,
      label: 'lines of code mapped',
      note: 'loc is one input to node size',
    },
    {
      value: demoMetrics().edges,
      label: 'import edges drawn',
      note: 'each one is a real dependency',
    },
  ];

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
        {/* 01 · Survey — hero with the live map */}
        <section aria-labelledby="hero-heading" className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                01 · Survey
              </p>
              <h1
                id="hero-heading"
                className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-5xl"
              >
                The living, AI-reviewed map of your codebase.
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-dim">
                Every file becomes a node: sized by how much of the codebase
                depends on it, coloured by how healthy it is. Pull requests get
                read before you do.
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
                <code className="font-mono text-xs text-ink-dim">repo</code>{' '}
                scope, which is the scope GitHub offers for cloning.
              </p>
            </div>

            <div className="lg:col-span-7">
              <MapFrame
                sheet="Vorza · demo map · survey"
                coords="31.2304°N  ·  121.4737°E"
                scale="scale 1:1"
              >
                <DemoMap files={files} links={links} positions={positions} height={480} />
              </MapFrame>
            </div>
          </div>

          <div className="mt-10">
            <Metrics metrics={metrics} />
          </div>
        </section>

        {/* 02 · Reading the map — scroll-zoom story */}
        <ScrollStory />

        {/* 03 · Blast radius — hover any file */}
        <section aria-labelledby="blast-radius" className="border-t border-line bg-surface py-20">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                03 · Blast radius
              </p>
              <h2
                id="blast-radius"
                className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.01em] sm:text-3xl"
              >
                Hover a file. See everything it drags along.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-ink-dim">
                The map shows every file that imports the one under your
                pointer: the set of files a change to it forces downstream. On
                keyboard, tab to a node and press Enter to survey it.
              </p>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {surveyed ? `surveyed: ${surveyed}` : 'surveyed: none yet'}
              </p>
            </div>

            <div className="lg:col-span-7">
              <MapFrame
                sheet="Vorza · demo map · blast radius"
                coords="hover or tab to survey"
                scale="zoom 1.0x"
              >
                <DemoMap
                  files={files}
                  links={links}
                  positions={positions}
                  blastRadius
                  selectedPath={surveyed}
                  onSelect={setSurveyed}
                  height={460}
                />
              </MapFrame>
            </div>
          </div>
        </section>

        {/* 04 · Pull requests — sample review */}
        <section aria-labelledby="pr-reads" className="py-20">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-12 lg:gap-12">
            <div className="order-2 lg:order-1 lg:col-span-6">
              <MapFrame
                sheet="Vorza · sample review · PR #128"
                coords="citation: file:line"
                scale="every flag cites evidence"
              >
                <div className="flex min-h-[420px] items-center justify-center bg-background p-6">
                  <ReviewDemo />
                </div>
              </MapFrame>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                04 · Pull requests get read
              </p>
              <h2
                id="pr-reads"
                className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.01em] sm:text-3xl"
              >
                A review that has to show its working.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-ink-dim">
                A webhook hands the diff to a model that returns a risk score
                and a list of flags, each one pinned to the exact lines it
                refers to. Findings that cannot be tied to the diff are
                dropped, and the card says so.
              </p>
              <ul className="mt-8 flex flex-col gap-4">
                <li className="border-t border-line pt-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-primary">
                    risk score, not a summary
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-dim">
                    One number from zero to one hundred, so the triage can be a
                    sort, not a read.
                  </p>
                </li>
                <li className="border-t border-line pt-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-primary">
                    flags carry citations
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-dim">
                    Each finding names a file and a line range. No line, no
                    finding.
                  </p>
                </li>
                <li className="border-t border-line pt-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-primary">
                    quiet when nothing is wrong
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-dim">
                    The default outcome is no comment at all, not a padded
                    review.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 05 · What it actually does */}
        <section aria-labelledby="how-it-works" className="border-t border-line bg-surface py-20">
          <div className="mx-auto max-w-6xl px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
              05 · Inventory
            </p>
            <h2
              id="how-it-works"
              className="mt-4 text-2xl font-semibold tracking-[-0.01em] sm:text-3xl"
            >
              What it actually does
            </h2>
            <div className="mt-10 grid gap-x-12 gap-y-9 sm:grid-cols-2">
              {FEATURES.map((feature, i) => (
                <div key={feature.title} className="border-t border-line pt-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] text-ink-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-primary">
                      {feature.metric}
                    </p>
                  </div>
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

        {/* 06 · The engineering */}
        <section aria-labelledby="the-engineering" className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
              06 · Field notes
            </p>
            <h2
              id="the-engineering"
              className="mt-4 max-w-xl text-2xl font-semibold tracking-[-0.01em] sm:text-3xl"
            >
              How it was built, without the part where it went smoothly.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-dim">
              The interesting decisions are the ones the landing page usually
              hides. These are real choices from the repo, in no particular
              order of importance.
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-stem border border-line bg-line sm:grid-cols-4">
              {[
                ['backend tests', '183'],
                ['frontend tests', '143'],
                ['backend coverage', '81%'],
                ['live stack', 'Render + Vercel + Neon'],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface px-4 py-3">
                  <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-faint">
                    {label}
                  </dt>
                  <dd className="tabular mt-1 font-mono text-lg text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 grid gap-x-12 gap-y-9 sm:grid-cols-2">
              {HOW_BUILT.map((note, i) => (
                <div key={note.fact} className="border-t border-line pt-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] text-ink-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-primary">
                      {note.fact}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                    {note.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 07 · What it runs on */}
        <section aria-labelledby="stack" className="border-t border-line bg-surface py-20">
          <div className="mx-auto max-w-6xl px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
              07 · Field equipment
            </p>
            <h2 id="stack" className="mt-4 text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">
              What it runs on
            </h2>
            <p className="mt-3 max-w-2xl text-ink-dim">
              Small enough to read in an afternoon, cheap enough to leave
              running.
            </p>
            <dl className="mt-10 grid gap-px overflow-hidden rounded-stem border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
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