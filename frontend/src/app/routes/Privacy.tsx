import { useDocumentMeta } from '@/lib/seo';

import { LegalSection, LegalShell } from './LegalShell';

/**
 * Privacy policy for the hosted service. Every claim below matches code in the
 * repository: GitHub OAuth, Postgres on Neon, localStorage for the session
 * token, the configured model provider for reviews, a fixed demo dataset on
 * the landing page. Kept deliberately short and free of legal boilerplate.
 */

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'What the service collects',
    body: [
      'When you sign in with GitHub, Vorza receives the identity the provider returns: your username, your email and your avatar.',
      'When you connect a repository, the service reads from its Git history so it can score complexity, churn and health. The scores and the file list are kept as a snapshot so the history view can show how health moves over time.',
      'When a pull request is reviewed, a compressed view of the diff is sent to the configured model provider, and the returned risk score with its cited flags is stored with the review.',
      'While a map is open, presence markers and comment pins are exchanged over the WebSocket so people looking at the same repository can see each other.',
    ],
  },
  {
    heading: 'Where it is stored',
    body: [
      'Account, repository, snapshot and review records live in Postgres. The hosted service uses a Neon free-tier database; local development uses SQLite.',
      'A session token is kept in your browser localStorage. Clearing site data for Vorza signs you out.',
    ],
  },
  {
    heading: 'Who it is shared with',
    body: [
      'The service sends data to GitHub for OAuth, to its hosting providers (Render for the API, Vercel for the frontend, Neon for the database) and to the model provider that runs reviews. The diff text of a review you trigger goes to that provider.',
      'Vorza does not sell data, does not show ads and keeps nothing it does not need. The demo map on the landing page is a fixed sample dataset, not anyone\'s real repository.',
    ],
  },
  {
    heading: 'How long it is kept',
    body: [
      'Snapshots and reviews stay until you disconnect the repository or ask for them to be removed. There is no automatic expiry.',
    ],
  },
  {
    heading: 'Deletion and contact',
    body: [
      'There is no self-serve account deletion yet. To have your data removed, open an issue or reach out through the repository at github.com/Bhagyansh07/vorza and it will be done.',
      'If the project shuts down, the hosted database goes with it.',
    ],
  },
  {
    heading: 'Changes',
    body: [
      'If this page changes, the reasons are visible in the commit history of the public repository.',
    ],
  },
];

export function PrivacyPage() {
  useDocumentMeta({
    title: 'Privacy policy',
    description:
      'What the Vorza service collects, where it is stored and who can see it, in plain English.',
    path: '/privacy',
  });

  return (
    <LegalShell
      eyebrow="legal · 01"
      title="Privacy policy"
      updated="10 October 2026"
    >
      {SECTIONS.map((section) => (
        <LegalSection key={section.heading} heading={section.heading}>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </LegalSection>
      ))}
    </LegalShell>
  );
}