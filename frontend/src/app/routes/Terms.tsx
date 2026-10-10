import { useDocumentMeta } from '@/lib/seo';

import { LegalSection, LegalShell } from './LegalShell';

/**
 * Terms for the hosted service. Written to match the code: MIT licensed,
 * GitHub OAuth with the repo scope, a single free-tier backend instance with a
 * cold start, review volume limited so one instance stays up for everyone.
 */

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: 'The service',
    body: [
      'Vorza is an open-source project (MIT) that maps a GitHub repository and reviews its pull requests. The code is public at github.com/Bhagyansh07/vorza, and these terms govern the hosted service only.',
    ],
  },
  {
    heading: 'Your code stays yours',
    body: [
      'You keep full ownership of everything you connect. Connecting a repository grants Vorza permission to read it through GitHub OAuth, clone it for analysis and receive its webhook events so reviews can run. Vorza never republishes your code.',
    ],
  },
  {
    heading: 'Scope and permissions',
    body: [
      'The service requests GitHub repo scope, which covers every repository your account can reach and grants write as well as read. Vorza only ever reads. Only connect repositories you are allowed to read; the review and webhook features act on the repositories you connect.',
    ],
  },
  {
    heading: 'Fair use',
    body: [
      'The service runs on free hosting tiers. Review volume is limited so a single instance stays up for everyone. Automated, abusive or resold use is not allowed.',
    ],
  },
  {
    heading: 'Availability',
    body: [
      'The backend is one free instance with a cold start of around fifty seconds. It can be unavailable for maintenance, quota or any other reason. There is no uptime promise.',
    ],
  },
  {
    heading: 'Warranty and liability',
    body: [
      'The service is provided as is, under the MIT license. To the extent the law allows, the maintainers accept no liability for anything that happens while using it.',
    ],
  },
  {
    heading: 'Changes and contact',
    body: [
      'These terms may change when features change. The current version is always on this page. Questions go through the repository at github.com/Bhagyansh07/vorza.',
    ],
  },
];

export function TermsPage() {
  useDocumentMeta({
    title: 'Terms of service',
    description:
      'The rules for using the Vorza hosted service: ownership, scope, availability and liability.',
    path: '/terms',
  });

  return (
    <LegalShell
      eyebrow="legal · 02"
      title="Terms of service"
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