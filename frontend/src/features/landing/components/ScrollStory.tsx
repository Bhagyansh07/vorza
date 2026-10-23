import { useEffect, useMemo, useRef, useState } from 'react';

import { DemoMap } from './DemoMap';
import { MapFrame } from './MapFrame';
import { demoFiles, demoLinks, demoSeedPositions } from './demoData';

/**
 * The scroll-zoom story: one sticky map frame zooms from the whole survey to a
 * hub to an outlier as the reader scrolls, with the beat text stepping on the
 * left. The keyframe centres name real regions of the demo layout (backend hub
 * left, frontend hub right, docs below) thanks to the deterministic seed.
 *
 * Readers who prefer reduced motion get the same section as a static frame:
 * beat one and the survey view, with no tall spacer and no scroll listener, so
 * nothing on the page is driven by scroll for them.
 */

interface ZoomKeyframe {
  cx: number;
  cy: number;
  k: number;
}

const KEYFRAMES: ZoomKeyframe[] = [
  { cx: -15, cy: -25, k: 1.05 }, // whole survey
  { cx: -185, cy: -55, k: 2.4 }, // backend hub: orchestrator + services
  { cx: 200, cy: -35, k: 3.0 }, // frontend hub: graph + lib
  { cx: 150, cy: 235, k: 3.6 }, // docs: the quiet outliers
];

const BEATS = [
  {
    index: '01',
    title: 'Clusters are packages',
    body: 'Files that import each other settle together. Each package becomes its own cloud on the map, and one glance tells you where a change is going to land.',
  },
  {
    index: '02',
    title: 'Hubs take the load',
    body: 'The files everything depends on sit at the middle and grow: the orchestrator, the api client, shared types. Node size is how much of the codebase sits downstream of a file.',
  },
  {
    index: '03',
    title: 'Outliers need eyes',
    body: 'The leaves on the edge are the ones people forget: generated code, docs, one-off scripts. They get scored, cached and reviewed like everything else.',
  },
] as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function zoomAt(p: number): ZoomKeyframe {
  const seg = Math.min(2, Math.floor(p * 3));
  const t = p * 3 - seg;
  const from = KEYFRAMES[seg];
  const to = KEYFRAMES[seg + 1];
  return {
    cx: lerp(from.cx, to.cx, t),
    cy: lerp(from.cy, to.cy, t),
    k: lerp(from.k, to.k, t),
  };
}

/**
 * Guards against jsdom and older browsers where matchMedia is missing or
 * throws: any failure resolves to "motion is fine", so the scroll story keeps
 * its normal behaviour instead of collapsing.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let query: MediaQueryList | null = null;
    try {
      query = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function ScrollStory() {
  const reducedMotion = usePrefersReducedMotion();
  const [progress, setProgress] = useState(0);
  const [activeBeatOverride, setActiveBeatOverride] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const files = useMemo(() => demoFiles(), []);
  const links = useMemo(() => demoLinks(), []);
  const positions = useMemo(() => demoSeedPositions(), []);

  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    if (!section) return;
    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      setProgress(p);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion]);

  if (reducedMotion) {
    const beat = BEATS[0];
    return (
      <section
        aria-labelledby="reading-the-map"
        data-tour="reading"
        className="border-t border-line bg-surface py-20"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
              Reading the map · {beat.index} / 03
            </p>
            <h2
              id="reading-the-map"
              className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-4xl"
            >
              {beat.title}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-dim">
              {beat.body}
            </p>
            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              Static frame, reduced motion
            </p>
          </div>

          <div className="lg:col-span-7">
            <MapFrame
              sheet="Survey · demo data"
              coords="survey level"
              scale="zoom 1.05x"
            >
              <DemoMap
                files={files}
                links={links}
                positions={positions}
                externalZoom={KEYFRAMES[0]}
                height={440}
              />
            </MapFrame>
          </div>
        </div>
      </section>
    );
  }

  const effectiveBeat = activeBeatOverride ?? (progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2);
  const zoom = activeBeatOverride !== null ? KEYFRAMES[activeBeatOverride + 1] : zoomAt(progress);  return (
    <section
      aria-labelledby="reading-the-map"
      ref={sectionRef}
      data-tour="reading"
      className="relative border-t border-line/70 bg-surface/30 backdrop-blur-md py-16 sm:py-20"
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-12 lg:gap-14">
        {/* Beat text, left column */}
        <div className="relative z-10 lg:col-span-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-line/60 bg-surface/60 px-3 py-1 text-xs font-mono text-ink-dim backdrop-blur-md mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-good" />
            <span className="uppercase tracking-[0.14em]">
              Reading the map · {BEATS[effectiveBeat].index} / 03
            </span>
          </div>

          {/* Quick Interactive Beat Switcher */}
          <div className="mb-5 flex flex-wrap gap-2">
            {BEATS.map((b, i) => (
              <button
                key={b.index}
                type="button"
                onClick={() => setActiveBeatOverride(i)}
                className={`rounded-full px-3.5 py-1 text-xs font-mono font-medium transition-all ${
                  effectiveBeat === i
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-surface/60 text-ink-dim hover:text-ink hover:bg-raised border border-line/60'
                }`}
              >
                {b.index} · {b.title.split(' ')[0]}
              </button>
            ))}
          </div>

          <h2
            id="reading-the-map"
            className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
          >
            {BEATS[effectiveBeat].title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-dim">
            {BEATS[effectiveBeat].body}
          </p>

          {/* Progress rail */}
          <div
            role="progressbar"
            aria-label="Story progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(((effectiveBeat + 1) / 3) * 100)}
            className="mt-8 flex items-center gap-3"
          >
            {BEATS.map((b, i) => (
              <button
                key={b.index}
                type="button"
                onClick={() => setActiveBeatOverride(i)}
                className="flex items-center gap-1 font-mono text-[10px] text-ink-faint hover:text-ink cursor-pointer"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 rounded-full transition-all ${
                    i === effectiveBeat ? 'w-10 bg-primary' : 'w-6 bg-line/80'
                  }`}
                />
                <span>{b.index}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sticky map, right column */}
        <div className="lg:col-span-7">
          <MapFrame
            sheet="Survey · demo data"
            coords="backend hub → frontend hub → docs"
            scale={`zoom ${zoom.k.toFixed(2)}x`}
          >
            <DemoMap
              files={files}
              links={links}
              positions={positions}
              externalZoom={zoom}
              height={440}
            />
          </MapFrame>
        </div>
      </div>
    </section>
  );
}