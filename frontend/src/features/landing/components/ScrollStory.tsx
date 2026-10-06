import { useEffect, useMemo, useRef, useState } from "react";

import { DemoMap } from "./DemoMap";
import { MapFrame } from "./MapFrame";
import { demoFiles, demoLinks, demoSeedPositions } from "./demoData";

/**
 * The scroll-zoom story: one sticky map frame zooms from the whole survey to a
 * hub to an outlier as the reader scrolls, with the beat text stepping on the
 * left. The keyframe centres name real regions of the demo layout (backend hub
 * left, frontend hub right, docs below) thanks to the deterministic seed.
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
    index: "01",
    title: "Clusters are packages",
    body: "Files that import each other settle together. Each package becomes its own cloud on the map, and one glance tells you where a change is going to land.",
  },
  {
    index: "02",
    title: "Hubs take the load",
    body: "The files everything depends on sit at the middle and grow: the orchestrator, the api client, shared types. Node size is how much of the codebase sits downstream of a file.",
  },
  {
    index: "03",
    title: "Outliers need eyes",
    body: "The leaves on the edge are the ones people forget: generated code, docs, one-off scripts. They get scored, cached and reviewed like everything else.",
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

export function ScrollStory() {
  const [progress, setProgress] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const files = useMemo(() => demoFiles(), []);
  const links = useMemo(() => demoLinks(), []);
  const positions = useMemo(() => demoSeedPositions(), []);
  const zoom = zoomAt(progress);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      setProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const beat = progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;

  return (
    <section
      aria-labelledby="reading-the-map"
      ref={sectionRef}
      className="relative"
      style={{ height: "280vh" }}
    >
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-8 px-6 py-10 lg:grid-cols-12 lg:gap-12">
          {/* Beat text, left column */}
          <div className="relative z-10 lg:col-span-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
              Reading the map · {BEATS[beat].index} / 03
            </p>
            <h2
              id="reading-the-map"
              className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-4xl"
            >
              {BEATS[beat].title}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-dim">
              {BEATS[beat].body}
            </p>

            {/* Progress rail */}
            <div
              role="progressbar"
              aria-label="Story progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className="mt-8 flex items-center gap-3"
            >
              {BEATS.map((b, i) => (
                <span key={b.index} className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
                  <span
                    aria-hidden="true"
                    className={`h-px w-8 ${i <= beat ? "bg-primary" : "bg-line"}`}
                  />
                  {b.index}
                </span>
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

        <div className="absolute inset-x-0 bottom-6 mx-auto flex w-full max-w-6xl items-center gap-2 px-6 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          <span>Scroll</span>
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
          <span aria-hidden="true">▼</span>
        </div>
      </div>
    </section>
  );
}