/**
 * The guided tour engine.
 *
 * One component powers every screen: it sits bottom-right inviting a start, and
 * when a visitor takes the tour it walks the page stop by stop. Vorpy scrolls
 * each target into view, dims everything else with a spotlight, rings the target
 * and explains it in one short step at a time, changing expression to match.
 *
 * It is deliberately well behaved:
 *  - Nothing runs on its own. The tour only exists after a click, so it can
 *    never become motion the visitor did not ask for.
 *  - `prefers-reduced-motion: reduce` jumps instead of gliding, drops the ring
 *    transition and paints Vorpy as a static frame.
 *  - A step whose `data-tour` anchor is missing or hidden (a mobile rail, a graph
 *    that has not loaded) is dropped, so the ring never points at nothing.
 *  - Escape closes it, arrow keys step, focus moves into the panel and returns
 *    to the invite on close.
 *
 * Loading: this module imports the mascot, so it pulls in the avatar runtime.
 * Mount it through `LazyGuidedTour`, never directly, to keep that out of first
 * paint (asserted by `mascot-boundary.test.ts`).
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

import { readTourState, writeTourState } from './tour-storage';
import type { TourDefinition, TourStep } from './types';

/** Desktop panel size, used only to decide which side to dock it on. */
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 250;

type Placement = 'bottom-right' | 'bottom-left';

interface TargetRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

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

function pickPlacement(
  rect: TargetRect,
  viewportWidth: number,
  viewportHeight: number,
): Placement {
  // Small screens dock the panel as a bottom sheet, where the side is moot.
  if (viewportWidth < 640) return 'bottom-right';
  const panelLeftEdge = viewportWidth - 24 - PANEL_WIDTH;
  const panelTopEdge = viewportHeight - 24 - PANEL_HEIGHT;
  const overlaps = rect.right > panelLeftEdge && rect.bottom > panelTopEdge;
  return overlaps ? 'bottom-left' : 'bottom-right';
}

export function GuidedTour({ tour }: { tour: TourDefinition }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState<readonly TourStep[]>(tour.steps);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [placement, setPlacement] = useState<Placement>('bottom-right');
  const [hasSeen, setHasSeen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const reduceMotion = useMemo(prefersReducedMotion, []);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const inviteRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  const titleId = useId();
  const bodyId = useId();

  const total = steps.length;
  const step = steps[Math.min(index, total - 1)];

  // Read once whether this visitor has seen the tour
  useEffect(() => {
    setHasSeen(readTourState(tour.id) !== null);
  }, [tour.id]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      setDismissed(window.sessionStorage.getItem(`vorza:dismissed:${tour.id}`) === '1');
    }
  }, [tour.id]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(`vorza:dismissed:${tour.id}`, '1');
    }
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

  // Focus enters the panel on open and returns to the invite on close.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panelRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      inviteRef.current?.focus();
    }
  }, [open]);

  // Scroll the current target into view and keep the ring glued to it
  useEffect(() => {
    if (!open || !step) {
      setRect(null);
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
      if (measured) {
        setPlacement(
          pickPlacement(measured, window.innerWidth, window.innerHeight),
        );
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
    if (dismissed) return null;
    return (
      <div className="fixed bottom-4 right-4 z-30 sm:bottom-6 sm:right-6 max-w-[calc(100vw-32px)]">
        <div className="group/pill pointer-events-auto relative flex items-center gap-2 rounded-2xl border border-line/80 bg-surface/90 p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all duration-300 hover:scale-[1.03] hover:border-primary/50 hover:shadow-[0_0_24px_hsl(var(--primary)/0.25)] active:scale-[0.98] max-w-full">
          {/* Live copilot telemetry beacon */}
          <span className="pointer-events-none absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-good opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-signal-good border-2 border-surface" />
          </span>

          <button
            ref={inviteRef}
            type="button"
            onClick={start}
            aria-label="Start the Vorpy guided tour"
            className="flex items-center gap-3 rounded-xl pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="relative flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 p-1 shadow-inner">
              <VorpyMascot embedded size={44} animation={hasSeen ? 'idle' : 'excited'} />
            </div>
            <span className="pr-1">
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-primary font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-good" />
                <span>{tour.label}</span>
              </span>
              <span className="block text-xs font-semibold leading-tight text-ink mt-0.5">
                {tour.invite}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss Vorpy"
            title="Dismiss Vorpy"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-foreground/10 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
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
            top: Math.max(6, rect.top - 6),
            left: Math.max(6, rect.left - 6),
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px hsl(222 25% 11% / 0.52)',
          }}
        >
          <div className="absolute -inset-1 rounded-[inherit] ring-4 ring-primary/20 motion-reduce:hidden" />
        </div>
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={cn(
          'fixed z-50 overflow-hidden rounded-3xl border border-line/80 bg-surface/95 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-2xl focus:outline-none sm:w-[400px]',
          placement === 'bottom-left'
            ? 'bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto'
            : 'bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6',
        )}
      >
        {/* Luminous Multi-Spectrum Progress Bar */}
        <div className="h-1.5 w-full bg-line/60" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 transition-[width] duration-300 motion-reduce:transition-none shadow-xs"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Studio Window Chrome Banner */}
        <div className="flex items-center justify-between border-b border-line/60 bg-surface/60 px-5 py-2 text-[10px] font-mono backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-good animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-ink-dim">
              Vorza Copilot Telemetry
            </span>
          </div>
          <span className="rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-primary font-bold">
            Active
          </span>
        </div>

        <div className="flex items-start gap-4 p-5">
          <div className="relative shrink-0 flex items-center justify-center rounded-2xl bg-surface/80 border border-line/70 p-1.5 shadow-sm">
            <VorpyMascot embedded size={64} animation={step.animation} />
          </div>
          <div className="min-w-0 flex-1" aria-live="polite">
            <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary font-bold">
              <span>{step.eyebrow}</span>
              <span className="text-ink-faint font-semibold">
                {index + 1} / {total}
              </span>
            </div>
            <h2
              id={titleId}
              className="mt-1 text-base font-bold leading-tight text-ink"
            >
              {step.title}
            </h2>
            <p
              id={bodyId}
              className="mt-2 text-xs sm:text-sm leading-relaxed text-ink-dim"
            >
              {step.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close()}
            aria-label="Close the tour"
            className="-mr-1.5 -mt-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line/60 px-5 py-3.5 bg-surface/50">
          <button
            type="button"
            onClick={() => close(true)}
            className="text-xs text-ink-faint underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={back}
              disabled={index === 0}
              className="rounded-xl text-xs shadow-xs font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Back
            </Button>
            {index < total - 1 ? (
              <Button size="sm" onClick={next} className="rounded-xl text-xs font-semibold shadow-xs">
                Next
                <ArrowRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => close(true)} className="rounded-xl text-xs font-semibold shadow-xs">
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
