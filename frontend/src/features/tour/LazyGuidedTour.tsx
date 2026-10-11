import { Suspense, lazy } from 'react';

import type { TourDefinition } from './types';

/**
 * The lazy door to the guided tour.
 *
 * Every route mounts this. It is the only thing the routes import, so the
 * engine and the mascot stay in a chunk that loads after first paint -- on the
 * landing page and inside the app alike. See `mascot-boundary.test.ts`.
 */
const GuidedTour = lazy(() =>
  import('./GuidedTour').then((module) => ({ default: module.GuidedTour })),
);

export function LazyGuidedTour({ tour }: { tour: TourDefinition }) {
  return (
    <Suspense fallback={null}>
      <GuidedTour tour={tour} />
    </Suspense>
  );
}
