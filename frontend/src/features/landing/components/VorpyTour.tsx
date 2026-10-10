/**
 * Vorpy's guided tour of the landing page.
 *
 * The mascot is the guide: it sits bottom-right inviting a start, and when the
 * visitor takes the tour it walks the page section by section -- scrolling each
 * target into view, ringing it, and explaining it in one short step at a time,
 * left to right, top to bottom. Nothing runs on its own; the tour only exists
 * after a click, so it can never become "over-the-top" motion the visitor did
 * not ask for.
 *
 * Honest defaults, matching the mascot:
 *  - `prefers-reduced-motion: reduce` scrolls without smooth motion, drops the
 *    ring transition and paints Vorpy as a static frame.
 *  - The copy is plain, specific and hand-written. No em dashes, no exclamation
 *    marks, no fake claims.
 *
 * Loading: this module is pulled in with `React.lazy` from the landing route and
 * imports the mascot, so the avatar runtime still stays out of first paint (see
 * `mascot-boundary.test.ts`).
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { VorpyMascot, type AnimationKey } from './VorpyMascot';

interface TourStep {
  /** Matches the `data-tour` attribute on the section to highlight. */
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  animation: AnimationKey;
}

/**
 * The steps, in reading order. Each one points at a `data-tour` anchor in the
 * landing markup; keep the two in sync (the tour falls back to reading order
 * without a ring if an anchor goes missing).
 */
export const TOUR_STEPS: readonly TourStep[] = [
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
] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(target: string): TargetRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function VorpyTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const reduceMotion = useMemo(prefersReducedMotion, []);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);

  const titleId = useId();
  const bodyId = useId();

  const total = TOUR_STEPS.length;
  const step = TOUR_STEPS[Math.min(index, total - 1)];

  const start = useCallback(() => {
    setIndex(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, total - 1)),
    [total],
  );
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Escape closes the tour from anywhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Move focus into the panel when it opens, and back to the invite when it
  // closes. Doing the restore here (not in `close`) waits for the invite to be
  // mounted again, so the focused element actually exists.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panelRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      startRef.current?.focus();
    }
  }, [open]);

  // Scroll the current target into view and keep the highlight glued to it as
  // the page moves. Reduced motion jumps instead of gliding.
  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
    });

    const update = () => setRect(measure(step.target));
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [open, index, step.target, reduceMotion]);

  if (!open) {
    return (
      <div className="fixed bottom-5 right-5 z-30 md:bottom-6 md:right-6">
        <button
          ref={startRef}
          type="button"
          onClick={start}
          aria-label="Start the Vorpy guided tour"
          className="pointer-events-auto flex items-center gap-2 rounded-stem border border-line bg-surface/95 py-2 pl-2 pr-3 text-left shadow-panel backdrop-blur transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <VorpyMascot embedded size={56} animation="idle" />
          <span className="pr-0.5">
            <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
              Vorpy
            </span>
            <span className="block text-sm font-medium leading-tight text-ink">
              Show me around
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-stem ring-2 ring-primary transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: Math.max(8, rect.top - 8),
            left: Math.max(8, rect.left - 8),
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px hsl(222 25% 11% / 0.28)',
          }}
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="fixed bottom-5 right-5 z-50 w-[min(22rem,calc(100vw-2.5rem))] rounded-stem border border-line bg-surface p-4 shadow-panel focus:outline-none md:bottom-6 md:right-6"
      >
        <div className="flex items-start gap-3">
          <VorpyMascot embedded size={64} animation={step.animation} />
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
              <span>{step.eyebrow}</span>
              <span className="text-ink-faint">
                {index + 1} / {total}
              </span>
            </p>
            <h2
              id={titleId}
              className="mt-1 text-base font-semibold leading-tight text-ink"
            >
              {step.title}
            </h2>
            <p
              id={bodyId}
              className="mt-1.5 text-sm leading-relaxed text-ink-dim"
            >
              {step.body}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close the tour"
            className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-stem text-ink-faint transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div
            role="progressbar"
            aria-label="Tour progress"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
            className="flex items-center gap-1"
          >
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.target}
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  i <= index ? 'bg-primary' : 'bg-line'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={back}
              disabled={index === 0}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            {index < total - 1 ? (
              <Button size="sm" onClick={next}>
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button size="sm" onClick={close}>
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
