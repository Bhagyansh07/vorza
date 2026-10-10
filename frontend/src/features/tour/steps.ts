import type { TourDefinition, TourStep } from './types';

/**
 * The tours, one per screen.
 *
 * Copy rules follow the repo's landing rules: plain, specific, no em dashes, no
 * exclamation marks, no claim the product does not back. Each `target` has a
 * matching `data-tour="..."` in the markup; the engine quietly drops a step
 * whose anchor is not on screen (a hidden mobile rail, a graph that has not
 * loaded yet) so a tour never points at nothing.
 *
 * The numbers stay consistent with the field-notes strip on the landing page and
 * the health thresholds in AGENTS.md (>= 70 good, >= 45 warn, below bad).
 */

export const LANDING_TOUR: TourDefinition = {
  id: 'landing',
  invite: 'Show me around',
  label: 'The tour',
  steps: [
    {
      target: 'hero',
      eyebrow: 'Welcome',
      title: 'Start here',
      body: 'Vorza turns a GitHub repo into a map: every file a node, sized by how much of the codebase depends on it, coloured by how healthy it is.',
      animation: 'waking',
    },
    {
      target: 'map',
      eyebrow: 'The map',
      title: 'This is a live map',
      body: 'A real force simulation over real import edges, fed the demo dataset, not a screenshot. New files land where their imports put them.',
      animation: 'idle',
    },
    {
      target: 'metrics',
      eyebrow: 'The numbers',
      title: 'The counts come from the data',
      body: 'Files, lines and edges are totalled from the demo tree on this page, so the numbers match exactly what is drawn next to them.',
      animation: 'idle',
    },
    {
      target: 'reading',
      eyebrow: 'Reading it',
      title: 'How to read the map',
      body: 'Clusters are packages, hubs are the files everything depends on, and the outliers on the edge are the ones worth a second look.',
      animation: 'thinking',
    },
    {
      target: 'blast',
      eyebrow: 'Blast radius',
      title: 'Trace the change',
      body: 'Hover or tab to a file and the map lights up everything a change to it would drag along downstream.',
      animation: 'working',
    },
    {
      target: 'review',
      eyebrow: 'Pull requests',
      title: 'Reviews show their working',
      body: 'A pull request gets a risk score and a list of flags, and every flag cites the file and the lines it came from. No line, no finding.',
      animation: 'thinking',
    },
    {
      target: 'inventory',
      eyebrow: 'The inventory',
      title: 'What it actually does',
      body: 'The short, honest feature list: snapshots that stay live, history over time, and a stack with nothing to babysit.',
      animation: 'idle',
    },
    {
      target: 'engineering',
      eyebrow: 'Field notes',
      title: 'How it was built',
      body: 'The decisions the landing page usually hides, plus the real test and coverage counts from the repo.',
      animation: 'idle',
    },
    {
      target: 'stack',
      eyebrow: 'Field equipment',
      title: 'What it runs on',
      body: 'FastAPI, SQLModel and Postgres on free tiers, plus GitHub OAuth and a WebSocket. One Postgres URL on deploy.',
      animation: 'idle',
    },
    {
      target: 'footer',
      eyebrow: 'Your turn',
      title: 'Connect a repo',
      body: 'Sign in with GitHub and connect a repo. Vorza asks for the repo scope, and it only ever reads.',
      animation: 'celebrate',
    },
  ],
} as const;

export const DASHBOARD_TOUR: TourDefinition = {
  id: 'dashboard',
  invite: 'Show me around',
  label: 'Overview',
  steps: [
    {
      target: 'dash-header',
      eyebrow: 'Overview',
      title: 'Your repositories',
      body: 'Every repo you connect lives here. Pick one to open its live map.',
      animation: 'waking',
    },
    {
      target: 'dash-connect',
      eyebrow: 'Connect',
      title: 'Add a repository',
      body: 'Point Vorza at a GitHub repo and it clones it, maps every file and scores the codebase health.',
      animation: 'excited',
    },
    {
      target: 'dash-metrics',
      eyebrow: 'At a glance',
      title: 'The counts are real',
      body: 'These three cards partition your connected repos: total, mapped without issues, and needing re-analysis. They always sum to the total.',
      animation: 'idle',
    },
    {
      target: 'dash-repos',
      eyebrow: 'Your maps',
      title: 'Open a map',
      body: 'Each card is one repository. Open it for the force-directed map, the health scores and the file table.',
      animation: 'thinking',
    },
    {
      target: 'nav-rail',
      eyebrow: 'Navigation',
      title: 'Move around',
      body: 'The rail keeps Overview one click away and shows who is signed in. Everything else opens from a repository.',
      animation: 'idle',
    },
  ],
} as const;

export const REPO_TOUR: TourDefinition = {
  id: 'repo',
  invite: 'Show me around',
  label: 'This repository',
  steps: [
    {
      target: 'repo-header',
      eyebrow: 'The map',
      title: 'One repository',
      body: 'This is a single repo. The heading is the full name, with the default branch underneath.',
      animation: 'waking',
    },
    {
      target: 'repo-actions',
      eyebrow: 'Actions',
      title: 'Re-run or look back',
      body: 'Health history opens the trend over time. Analyze now queues a fresh snapshot of the code as it is right now.',
      animation: 'idle',
    },
    {
      target: 'repo-stats',
      eyebrow: 'Health',
      title: 'Three scores',
      body: 'Overall health out of 100, how many files were mapped, and when the last snapshot was taken.',
      animation: 'idle',
    },
    {
      target: 'repo-graph',
      eyebrow: 'The map',
      title: 'Read the shape',
      body: 'Each node is a file, sized by how many files depend on it and coloured by health. Drag to pan, scroll to zoom.',
      animation: 'thinking',
    },
    {
      target: 'graph-toolbar',
      eyebrow: 'Views',
      title: 'Map or list',
      body: 'Toggle between the force-directed map and a file table. Fit map recentres the view, Re-analyze pulls the latest snapshot.',
      animation: 'working',
    },
    {
      target: 'graph-legend',
      eyebrow: 'Legend',
      title: 'What the colours mean',
      body: 'Health bands spelled out: 70 and up is good, 45 and up is a warning, below that is bad. The same bands colour every node.',
      animation: 'idle',
    },
  ],
} as const;

export const HISTORY_TOUR: TourDefinition = {
  id: 'history',
  invite: 'Show me around',
  label: 'Health history',
  steps: [
    {
      target: 'history-header',
      eyebrow: 'History',
      title: 'Health over time',
      body: 'Every analysis snapshot becomes a point here, so you can see whether the codebase is getting healthier or drifting.',
      animation: 'waking',
    },
    {
      target: 'history-chart',
      eyebrow: 'The trend',
      title: 'Read the line',
      body: 'The line is the overall health score across snapshots. A gap means no analysis ran between those dates.',
      animation: 'thinking',
    },
  ],
} as const;

export const LOGIN_TOUR: TourDefinition = {
  id: 'login',
  invite: 'Show me around',
  label: 'Sign in',
  steps: [
    {
      target: 'login-card',
      eyebrow: 'Sign in',
      title: 'GitHub is the only way in',
      body: 'Vorza uses GitHub OAuth, so there is no separate password to create or remember.',
      animation: 'waking',
    },
    {
      target: 'login-consent',
      eyebrow: 'Access',
      title: 'What we ask for',
      body: 'Sign-in asks GitHub for the repo scope, which is the scope GitHub offers for cloning. Vorza reads your code; it does not push.',
      animation: 'idle',
    },
  ],
} as const;

export const TOURS = {
  landing: LANDING_TOUR,
  dashboard: DASHBOARD_TOUR,
  repo: REPO_TOUR,
  history: HISTORY_TOUR,
  login: LOGIN_TOUR,
} as const;

export type { TourDefinition, TourStep };
