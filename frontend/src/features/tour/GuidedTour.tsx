/**
 * The guided tour engine.
 *
 * One component powers every screen: it sits bottom-right inviting a start, and
 * when a visitor takes the tour Vorpy the pet floats to the side of each target
 * with the copy in a thought cloud beside it, changing expression to match. The
 * element being explained keeps a soft spotlight over a dimmed page.
 *
 * It is deliberately well behaved:
 *  - Nothing runs on its own. The tour only exists after a click, so it can
 *    never become motion the visitor did not ask for.
 *  - `prefers-reduced-motion: reduce` jumps instead of gliding and freezes the
 *    pet's float and the cloud's entrance on their still frames.
 *  - A step whose `data-tour` anchor is missing or hidden (a mobile rail, a graph
 *    that has not loaded) is dropped, so Vorpy never points at nothing.
 *  - Escape closes it, arrow keys step, focus moves into the cloud and returns
 *    to the invite on close.
 *
 * Loading: this module is the tour engine and the mascot together, so mount it
 * through `LazyGuidedTour`, never directly, to keep both out of first paint
 * (asserted by `mascot-boundary.test.ts`).
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

import { VorpyMascot } from '@/components/mascot/VorpyMascot';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { computeAnchor } from './placement';
import type { Anchor, TargetRect } from './placement';
import { readTourState, writeTourState } from './tour-storage';
import type { TourDefinition, TourStep } from './types';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function rectOf(selector: string): TargetRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
    width: r.width,
    height: r.height,
  };
}

function resolveSteps(steps: readonly TourStep[]): TourStep[] {
  const present = steps.filter((step) => rectOf(`[data-tour="${step.target}"]`));
  // If nothing is on screen (a route still loading), keep the copy rather than
  // silently opening an empty tour.
  return present.length > 0 ? present : [...steps];
}

export function GuidedTour({ tour }: { tour: TourDefinition }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState<readonly TourStep[]>(tour.steps);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [hasSeen, setHasSeen] = useState(true);

  const reduceMotion = useMemo(prefersReducedMotion, []);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const inviteRef = useRef<HTMLButtonElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);

  const titleId = useId();
  const bodyId = useId();

  const total = steps.length;
  const step = steps[Math.min(index, total - 1)];

  // Read once whether this visitor has seen the tour, so the invite can lean in
  // the first time and stay quiet after.
  useEffect(() => {
    setHasSeen(readTourState(tour.id) !== null);
  }, [tour.id]);

  const start = useCallback(() => {
    setSteps(resolveSteps(tour.steps));
    setIndex(0);
    setOpen(true);
    writeTourState(tour.id, 'seen');
    setHasSeen(true);
  }, [tour]);

  const close = useCallback(
    (finished = false) => {
      if (finished) writeTourState(tour.id, 'done');
      setOpen(false);
    },
    [tour.id],
  );

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, total - 1)),
    [total],
  );
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Keyboard: Escape leaves, arrows step.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowRight') next();
      else if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, next, back]);

  // Focus enters the panel on open and returns to the invite on close. Doing the
  // restore here (not in `close`) waits for the invite to be mounted again.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panelRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      inviteRef.current?.focus();
    }
  }, [open]);

  // Scroll the current target into view and keep Vorpy glued to its side as the
  // page moves. Reduced motion jumps instead of gliding.
  useEffect(() => {
    if (!open || !step) {
      setRect(null);
      setAnchor(null);
      return;
    }
    const selector = `[data-tour="${step.target}"]`;
    document.querySelector(selector)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
    });

    const update = () => {
      const measured = rectOf(selector);
      setRect(measured);
      // Vorpy hovers beside the target. The cloud group is measured, not guessed,
      // so the side is chosen from the room the copy actually leaves.
      const group = groupRef.current;
      if (measured && group) {
        const box = group.getBoundingClientRect();
        setAnchor(
          computeAnchor(
            measured,
            { width: box.width, height: box.height },
            window.innerWidth,
            window.innerHeight,
          ),
        );
      } else {
        setAnchor(null);
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [open, index, step, reduceMotion]);

  if (!open) {
    return (
      <div className="fixed bottom-4 right-4 z-30 sm:bottom-6 sm:right-6">
        <button
          ref={inviteRef}
          type="button"
          onClick={start}
          aria-label="Start the Vorpy guided tour"
          className={cn(
            'pointer-events-auto flex items-center gap-2.5 rounded-stem border bg-surface/95 py-2 pl-2 pr-3.5 text-left shadow-panel backdrop-blur transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            hasSeen ? 'border-line' : 'border-primary/50',
          )}
        >
          <VorpyMascot embedded size={54} animation={hasSeen ? 'idle' : 'excited'} />
          <span className="pr-0.5">
            <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
              {tour.label}
            </span>
            <span className="block text-sm font-medium leading-tight text-ink">
              {tour.invite}
            </span>
          </span>
        </button>
      </div>
    );
  }

  const pct = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-stem ring-2 ring-primary transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: Math.max(6, rect.top - 8),
            left: Math.max(6, rect.left - 8),
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px hsl(222 25% 11% / 0.26)',
          }}
        >
          <div className="absolute -inset-1 rounded-[inherit] ring-4 ring-primary/20 motion-reduce:hidden" />
        </div>
      )}

      {/*
        Vorpy the pet hovers beside the step's element, thinking the copy in a
        thought cloud. `vorpy-anchor` carries the position JS measures; the group
        is the pet and the cloud, and `data-side` flips the pet to whichever side
        of the target there was room for.
      */}
      <div
        className="vorpy-anchor"
        style={{
          left: anchor?.left ?? 0,
          top: anchor?.top ?? 0,
          opacity: anchor ? 1 : 0,
        }}
      >
        <div
          ref={groupRef}
          className="vorpy-group"
          data-side={anchor?.side ?? 'right'}
        >
          <div className="vorpy-pet" aria-hidden="true">
            <span className="vorpy-trail">
              <i />
              <i />
            </span>
            <div className="vorpy-pet-float">
              <VorpyMascot embedded size={84} animation={step.animation} />
            </div>
          </div>

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            tabIndex={-1}
            className="vorpy-cloud focus:outline-none"
          >
            <svg
              className="vorpy-cloud-skin"
              viewBox="0 0 200 200"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <rect x="10" y="18" width="180" height="164" rx="70" />
              <circle cx="48" cy="34" r="28" />
              <circle cx="102" cy="30" r="30" />
              <circle cx="154" cy="36" r="26" />
              <circle cx="20" cy="72" r="20" />
              <circle cx="180" cy="74" r="20" />
            </svg>

            <div className="relative px-6 pb-4 pt-5">
              <div aria-live="polite">
                <p className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                  <span>{step.eyebrow}</span>
                  <span className="text-ink-faint">
                    {index + 1} / {total}
                  </span>
                </p>
                <h2
                  id={titleId}
                  className="mt-1 pr-6 text-base font-semibold leading-tight text-ink"
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

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => close(true)}
                  className="text-xs text-ink-faint underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Skip
                </button>
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
                    <Button size="sm" onClick={() => close(true)}>
                      Done
                    </Button>
                  )}
                </div>
              </div>

              <div
                className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => close()}
              aria-label="Close the tour"
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-stem text-ink-faint transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
