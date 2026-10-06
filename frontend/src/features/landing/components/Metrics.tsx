import { useEffect, useRef, useState } from "react";

/**
 * Animated metric bar for the landing hero.
 *
 * The targets come from `demoMetrics()` -- totals derived from the demo file
 * tree the maps render -- so the count-ups land on numbers that are true of
 * the dataset shown on the page, not invented marketing figures.
 */

function useInView<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // jsdom has no IntersectionObserver; tests and SSR count as "in view".
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, inView];
}

function useCountUp(target: number, active: boolean, duration = 1100): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    // Do not trust the timestamp jsdom (or any animation host) passes to the
    // rAF callback: it can be offset from `performance.now()` by the host's
    // own time origin, which turns t negative and the eased value negative.
    const step = () => {
      const t = duration <= 0 ? 1 : Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return value;
}

interface Metric {
  value: number;
  label: string;
  note: string;
}

interface Props {
  metrics: Metric[];
}

function MetricCell({ metric, active }: { metric: Metric; active: boolean }) {
  const shown = useCountUp(metric.value, active);
  return (
    <div className="bg-surface px-5 py-5">
      <p className="font-mono text-3xl font-medium tabular tracking-[-0.02em] text-ink">
        {shown.toLocaleString("en-US")}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-ink-faint">
        {metric.label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-dim">{metric.note}</p>
    </div>
  );
}

export function Metrics({ metrics }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 gap-px overflow-hidden rounded-stem border border-line bg-line sm:grid-cols-3"
    >
      {metrics.map((m) => (
        <MetricCell key={m.label} metric={m} active={inView} />
      ))}
    </div>
  );
}