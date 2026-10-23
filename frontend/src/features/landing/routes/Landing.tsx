import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Layers,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';

import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LazyGuidedTour } from '@/features/tour/LazyGuidedTour';
import { LANDING_TOUR } from '@/features/tour/steps';
import { absoluteUrl, useDocumentMeta } from '@/lib/seo';

import { DemoMap } from '../components/DemoMap';
import { MapFrame } from '../components/MapFrame';
import { Metrics } from '../components/Metrics';
import { ReviewDemo } from '../components/ReviewDemo';
import { ScrollStory } from '../components/ScrollStory';
import { demoFiles, demoLinks, demoMetrics, demoSeedPositions } from '../components/demoData';

const FEATURES = [
  {
    title: 'Every file is a node',
    body: 'A force-directed layout over real import edges. Clusters are packages, hubs are the files everything depends on, and outliers are the ones worth reading.',
    metric: 'import-graph layout',
    icon: Boxes,
  },
  {
    title: 'Health, not vibes',
    body: 'Each file is scored on cyclomatic complexity, churn over the last three months and its own coupling. The colour on the map is that number, not a gradient.',
    metric: 'complexity + churn + coupling',
    icon: Shield,
  },
  {
    title: 'Pull requests get read',
    body: 'A GitHub webhook hands the diff to a model and comes back with a risk score and a list of files with reasons attached. Quiet when nothing is wrong.',
    metric: 'risk score + cited flags',
    icon: Zap,
  },
  {
    title: 'It stays live',
    body: 'Snapshots stream to open graphs over a WebSocket, and comment pins stay anchored to the coordinates you dropped them on. Two people can look at the same map.',
    metric: 'socket push + pinned comments',
    icon: Layers,
  },
  {
    title: 'Trend, not just state',
    body: 'Every analysis is kept. The history view plots health over time so a refactor that works shows up as a line going the right way.',
    metric: 'snapshot history',
    icon: Sparkles,
  },
  {
    title: 'Boring on purpose',
    body: 'FastAPI, SQLModel and Postgres behind it. SQLite by default, one Postgres URL on deploy. No vector database, no message queue you have to babysit.',
    metric: 'FastAPI + SQLModel',
    icon: CheckCircle2,
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
    <div className="bg-background min-h-screen text-foreground relative overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Floating Island Navbar */}
      <header className="sticky top-4 z-40 mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between rounded-full border border-line/70 bg-surface/85 px-5 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition-all">
          <Link to="/" aria-label="Vorza home" className="flex items-center gap-2.5">
            <Logo />
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/50 px-2 py-0.5 text-[10px] font-mono font-medium text-ink-dim">
              <span>v2.4</span>
            </span>
          </Link>

          <nav aria-label="Quick links" className="hidden sm:flex items-center gap-7 text-xs font-medium text-ink-dim">
            <a href="#features" className="hover:text-ink transition-colors">
              Features
            </a>
            <a href="#reading-the-map" className="hover:text-ink transition-colors">
              Architecture
            </a>
          </nav>

          <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex font-medium text-xs text-ink-dim hover:text-ink">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-1.5 text-xs shadow-xs transition-all hover:scale-105 active:scale-95"
            >
              <Link to="/login">
                Connect a repo
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* 01 · Survey — Minimalist Grand Hero */}
        <section
          aria-labelledby="hero-heading"
          data-tour="hero"
          className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 sm:pt-28"
        >
          {/* Centered Hero Content */}
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Luminous Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-surface/75 px-3.5 py-1 text-xs font-medium text-ink backdrop-blur-xl shadow-xs mb-8">
              <span className="flex h-1.5 w-1.5 rounded-full bg-signal-good" />
              <span>01 · Survey</span>
              <span className="text-ink-faint">/</span>
              <span className="font-mono text-[11px] text-ink-dim uppercase tracking-wider">Interactive Codebase Intelligence</span>
            </div>

            {/* Main Headline */}
            <h1
              id="hero-heading"
              className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-balance text-ink max-w-4xl"
            >
              The living, AI-reviewed map of your codebase.
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-ink-dim font-normal">
              Every file becomes a node: sized by how much of the codebase depends on it, coloured by how healthy it is. Pull requests get read before you do.
            </p>

            {/* Action Buttons */}
            <div data-tour="hero-actions" className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
              <Button
                size="lg"
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-sm font-semibold shadow-[0_0_24px_hsl(var(--primary)/0.25)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                asChild
              >
                <Link to="/login">
                  Connect a repo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 py-6 text-sm font-medium border-line/70 bg-surface/60 hover:bg-raised text-ink backdrop-blur-xl transition-all shadow-xs"
                asChild
              >
                <Link to="/login">Sign in</Link>
              </Button>
            </div>

            {/* Security Trust Note */}
            <div className="mt-7 inline-flex items-center gap-2 font-mono text-xs text-ink-faint">
              <span>Sign in with GitHub. Vorza asks for the</span>
              <code className="rounded bg-raised px-1.5 py-0.5 font-semibold text-ink border border-line/60">
                repo
              </code>
              <span>scope, which is the scope GitHub offers for cloning.</span>
            </div>
          </div>

          {/* Master Centered Interactive Studio Frame */}
          <div className="mt-16 max-w-5xl mx-auto" data-tour="map">
            <MapFrame
              sheet="Vorza · demo map · survey"
              coords="31.2304°N  ·  121.4737°E"
              scale="scale 1:1"
            >
              <DemoMap files={files} links={links} positions={positions} height={520} />
            </MapFrame>
          </div>

          {/* Floating Metric Strip */}
          <div className="mt-12 max-w-5xl mx-auto" data-tour="metrics">
            <Metrics metrics={metrics} />
          </div>
        </section>

        {/* 02 · Reading the map — Scroll-zoom story */}
        <ScrollStory />

        {/* 03 · Blast radius — Hover any file */}
        <section
          aria-labelledby="blast-radius"
          data-tour="blast"
          className="border-t border-line/70 bg-surface/30 backdrop-blur-md py-28"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono text-ink-dim backdrop-blur-md mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-warn" />
                <span className="uppercase tracking-[0.14em]">03 · Blast radius</span>
              </div>

              <h2
                id="blast-radius"
                className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-ink"
              >
                Hover a file. See everything it drags along.
              </h2>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-dim">
                The map shows every file that imports the one under your
                pointer: the set of files a change to it forces downstream. On
                keyboard, tab to a node and press Enter to survey it.
              </p>

              {/* Interactive Quick File Picker */}
              <div className="mt-6 rounded-2xl border border-line/70 bg-surface/75 p-5 shadow-lg backdrop-blur-xl">
                <p className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
                  Quick Survey Shortcuts:
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {['services/orchestrator.py', 'services/indexer.py', 'services/cache.py'].map((path) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setSurveyed(path)}
                      className={`rounded-full px-3 py-1 text-xs font-mono transition-all ${
                        surveyed === path
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'bg-raised text-ink-dim hover:text-ink hover:bg-line/50 border border-line/60'
                      }`}
                    >
                      {path.split('/').pop()}
                    </button>
                  ))}
                  {surveyed && (
                    <button
                      type="button"
                      onClick={() => setSurveyed(null)}
                      className="rounded-full px-3 py-1 text-xs text-ink-faint hover:text-ink underline"
                    >
                      clear
                    </button>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between">
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                    {surveyed ? `surveyed: ${surveyed}` : 'surveyed: none yet'}
                  </p>
                </div>
              </div>
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
                  height={480}
                />
              </MapFrame>
            </div>
          </div>
        </section>

        {/* 04 · Pull requests get read — Sample review */}
        <section
          aria-labelledby="pr-reads"
          data-tour="review"
          className="py-28"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-12 lg:gap-16">
            <div className="order-2 lg:order-1 lg:col-span-6">
              <MapFrame
                sheet="Vorza · sample review · PR #128"
                coords="citation: file:line"
                scale="every flag cites evidence"
              >
                <div className="flex min-h-[460px] items-center justify-center bg-background/80 p-6 backdrop-blur-md">
                  <ReviewDemo />
                </div>
              </MapFrame>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-line/60 bg-surface/60 px-3 py-1 text-xs font-mono text-ink-dim backdrop-blur-md mb-4">
                <Shield className="h-3.5 w-3.5 text-ink-dim" />
                <span className="uppercase tracking-[0.14em]">04 · Pull requests get read</span>
              </div>

              <h2
                id="pr-reads"
                className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-ink"
              >
                A review that has to show its working.
              </h2>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-dim">
                A webhook hands the diff to a model that returns a risk score
                and a list of flags, each one pinned to the exact lines it
                refers to. Findings that cannot be tied to the diff are
                dropped, and the card says so.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-1">
                {[
                  {
                    title: 'risk score, not a summary',
                    body: 'One number from zero to one hundred, so the triage can be a sort, not a read.',
                  },
                  {
                    title: 'flags carry citations',
                    body: 'Each finding names a file and a line range. No line, no finding.',
                  },
                  {
                    title: 'quiet when nothing is wrong',
                    body: 'The default outcome is no comment at all, not a padded review.',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-line/70 bg-surface/75 p-5 backdrop-blur-xl shadow-xs transition-all hover:border-primary/40"
                  >
                    <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 05 · Inventory — What it actually does */}
        <section
          id="features"
          aria-labelledby="how-it-works"
          data-tour="inventory"
          className="border-t border-line/70 bg-surface/20 backdrop-blur-2xl py-24"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col items-start max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-line/60 bg-surface/60 px-3 py-1 text-xs font-mono text-ink-dim backdrop-blur-md mb-3">
                <Boxes className="h-3.5 w-3.5 text-ink-dim" />
                <span className="uppercase tracking-[0.14em]">05 · Inventory</span>
              </div>
              <h2
                id="how-it-works"
                className="text-3xl sm:text-5xl font-bold tracking-tight text-ink"
              >
                What it actually does
              </h2>
              <p className="mt-4 text-base text-ink-dim leading-relaxed">
                Six foundational capabilities built to make complex software architectures readable, observable, and resilient.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature, i) => {
                const IconComponent = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group relative overflow-hidden rounded-3xl border border-line/70 bg-surface/60 p-7 backdrop-blur-xl shadow-lg transition-all duration-300 hover:border-primary/40 hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <span className="font-mono text-xs text-ink-faint">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-primary font-semibold">
                      {feature.metric}
                    </p>
                    <h3 className="mt-1.5 text-lg font-semibold text-ink">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                      {feature.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 06 · Field notes — The engineering */}
        <section
          aria-labelledby="the-engineering"
          data-tour="engineering"
          className="py-28"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-line/60 bg-surface/60 px-3 py-1 text-xs font-mono text-ink-dim backdrop-blur-md mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-good" />
              <span className="uppercase tracking-[0.14em]">06 · Field notes</span>
            </div>

            <h2
              id="the-engineering"
              className="max-w-2xl text-3xl sm:text-5xl font-bold tracking-tight text-ink"
            >
              How it was built, without the part where it went smoothly.
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-dim">
              The interesting decisions are the ones the landing page usually
              hides. These are real choices from the repo, in no particular
              order of importance.
            </p>

            <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['backend tests', '183'],
                ['frontend tests', '174'],
                ['backend coverage', '81%'],
                ['live stack', 'Render + Vercel + Neon'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-3xl border border-line/70 bg-surface/75 p-6 backdrop-blur-2xl shadow-sm"
                >
                  <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint font-mono">
                    {label}
                  </dt>
                  <dd className="tabular mt-3 font-mono text-3xl font-bold text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {HOW_BUILT.map((note, i) => (
                <div
                  key={note.fact}
                  className="rounded-3xl border border-line/70 bg-surface/65 p-6 backdrop-blur-xl shadow-xs transition-all hover:border-primary/40"
                >
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-ink font-semibold uppercase tracking-wider">{note.fact}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-dim">
                    {note.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 07 · Field equipment — What it runs on */}
        <section
          aria-labelledby="stack"
          data-tour="stack"
          className="border-t border-line/70 bg-surface/30 backdrop-blur-md py-28"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-line/60 bg-surface/60 px-3 py-1 text-xs font-mono text-ink-dim backdrop-blur-md mb-3">
              <Layers className="h-3.5 w-3.5 text-ink-dim" />
              <span className="uppercase tracking-[0.14em]">07 · Field equipment</span>
            </div>

            <h2 id="stack" className="text-3xl sm:text-5xl font-bold tracking-tight text-ink">
              What it runs on
            </h2>
            <p className="mt-4 max-w-2xl text-base text-ink-dim">
              Small enough to read in an afternoon, cheap enough to leave running.
            </p>

            <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FACTS.map(([term, value]) => (
                <div
                  key={term}
                  className="rounded-3xl border border-line/70 bg-surface/75 p-6 backdrop-blur-2xl shadow-sm"
                >
                  <dt className="text-xs font-medium uppercase tracking-[0.1em] text-ink-faint font-mono">
                    {term}
                  </dt>
                  <dd className="tabular mt-3 text-base font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 rounded-2xl border border-line/70 bg-surface/65 p-6 backdrop-blur-xl max-w-3xl">
              <p className="text-xs leading-relaxed text-ink-faint">
                The <code className="font-mono text-xs font-bold text-ink bg-raised px-1.5 py-0.5 rounded border border-line/60">repo</code> scope covers
                every repository the account can reach, and it grants write as
                well as read. Vorza only ever reads. Narrowing it to read-only
                needs a GitHub App, tracked as F14.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Luxury Footer */}
      <footer data-tour="footer" className="border-t border-line/70 bg-surface/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 text-sm text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Logo />
            <p className="text-xs text-ink-faint">
              Vorza, the living, AI-reviewed map of your codebase.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-6 text-xs font-medium">
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
              className="flex items-center gap-1 transition-colors hover:text-ink"
              href="https://github.com/Bhagyansh07/vorza"
              rel="noreferrer noopener"
              target="_blank"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>
        </div>
      </footer>

      {/* Vorpy's guided tour. Lazy: see `mascot-boundary.test.ts`. */}
      <LazyGuidedTour tour={LANDING_TOUR} />
    </div>
  );
}