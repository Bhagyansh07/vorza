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
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';

import { VorpyMascot } from '@/components/mascot/VorpyMascot';
import { Button } from '@/components/ui/button';

import { computeAnchor, type Anchor, type TargetRect } from './placement';
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
  return present.length > 0 ? present : [...steps];
}

export function GuidedTour({ tour }: { tour: TourDefinition }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState<readonly TourStep[]>(tour.steps);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [hasSeen, setHasSeen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [pokeMood, setPokeMood] = useState<any>(null);

  const handlePoke = useCallback(() => {
    const moods = ['celebrate', 'excited', 'proud', 'happy', 'laughing'];
    const nextMood = moods[Math.floor(Math.random() * moods.length)];
    setPokeMood(nextMood);
    window.setTimeout(() => setPokeMood(null), 1800);
  }, []);

  // Draggable and free-roaming pet state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragVelocity, setDragVelocity] = useState({ vx: 0, vy: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; mouseX: number; mouseY: number; moved: boolean } | null>(null);

  const reduceMotion = useMemo(prefersReducedMotion, []);

  const groupRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inviteRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  const titleId = useId();
  const bodyId = useId();

  const total = steps.length;
  const step = steps[Math.min(index, total - 1)];

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

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    if (target.closest('button[aria-label="Dismiss Vorpy"]')) return;

    const el = e.currentTarget;
    const box = el.getBoundingClientRect();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported
    }
    dragStartRef.current = {
      startX: box.left,
      startY: box.top,
      mouseX: e.clientX,
      mouseY: e.clientY,
      moved: false,
    };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const { startX, startY, mouseX, mouseY } = dragStartRef.current;
    const dx = e.clientX - mouseX;
    const dy = e.clientY - mouseY;
    if (Math.hypot(dx, dy) > 5) {
      dragStartRef.current.moved = true;
    }
    const maxW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const maxH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const clampedX = Math.max(16, Math.min(maxW - 320, startX + dx));
    const clampedY = Math.max(16, Math.min(maxH - 120, startY + dy));
    setPos({ x: clampedX, y: clampedY });
    setDragVelocity({ vx: e.movementX, vy: e.movementY });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
    const moved = dragStartRef.current.moved;
    dragStartRef.current = null;
    setIsDragging(false);
    setDragVelocity({ vx: 0, vy: 0 });
    if (!moved) {
      start();
    }
  }, [start]);

  // Screen double click / tap: Vorpy flies to the clicked spot!
  useEffect(() => {
    if (open) return;
    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
      const maxW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const maxH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const clampedX = Math.max(16, Math.min(maxW - 320, e.clientX - 100));
      const clampedY = Math.max(16, Math.min(maxH - 120, e.clientY - 40));
      setPos({ x: clampedX, y: clampedY });
      setPokeMood('excited');
      window.setTimeout(() => setPokeMood(null), 2000);
    };
    window.addEventListener('dblclick', handleDblClick);
    return () => window.removeEventListener('dblclick', handleDblClick);
  }, [open]);

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

  // Scroll the current target into view and keep Vorpy floating glued to its side in the air
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
    if (dismissed) return null;
    return (
      <div
        className="fixed z-40 select-none touch-none"
        style={
          pos
            ? {
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transition: isDragging
                  ? 'none'
                  : 'left 0.55s cubic-bezier(0.16, 1, 0.3, 1), top 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
              }
            : { bottom: '1.5rem', right: '1.5rem' }
        }
      >
        {/* Floating Interactive Companion Capsule */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`group/pill pointer-events-auto relative flex items-center gap-2.5 rounded-3xl border bg-surface/90 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-all duration-200 cursor-grab active:cursor-grabbing max-w-[calc(100vw-32px)] ${
            isDragging
              ? 'border-primary scale-105 shadow-[0_0_35px_hsl(var(--primary)/0.5)]'
              : 'border-primary/35 hover:scale-[1.03] hover:border-primary/60 hover:shadow-[0_0_30px_hsl(var(--primary)/0.35)]'
          }`}
          style={{
            transform: isDragging
              ? `rotate(${Math.max(-18, Math.min(18, dragVelocity.vx * 0.75))}deg)`
              : undefined,
            animation: !isDragging && !reduceMotion ? 'vorpy-free-roam 8s ease-in-out infinite' : undefined,
          }}
        >
          {/* Ambient Lighting Glow Behind Pill */}
          <div className="pointer-events-none absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-primary/30 via-emerald-400/20 to-transparent blur-md opacity-75 group-hover/pill:opacity-100 transition-opacity" />

          {/* Floating Magic Particle Wake / Light Thruster Trail */}
          <div className="pointer-events-none absolute -bottom-3 left-6 flex items-center gap-1.5 z-0">
            <span className="inline-block h-2 w-2 rounded-full bg-primary/80 blur-[1px] animate-[vorpy-particle-spark_1.8s_ease-out_infinite]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400/80 blur-[1px] animate-[vorpy-particle-spark_2.2s_ease-out_infinite_0.4s]" />
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400/70 blur-[1.5px] animate-[vorpy-particle-spark_1.5s_ease-out_infinite_0.8s]" />
          </div>

          {/* Floating Dynamic Speech Thought Tag (e.g. 'Vorpy is flying! 🚀' or 'Drag me anywhere! ✨') */}
          {(isDragging || isHovered) && (
            <div className="pointer-events-none absolute -top-8 left-4 z-30 animate-in fade-in zoom-in-90 duration-200">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-surface/95 px-3 py-1 font-mono text-[10px] font-bold text-primary shadow-lg backdrop-blur-md whitespace-nowrap">
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                {isDragging ? 'Vorpy is flying! 🚀' : '✨ Drag me or double-click to fly!'}
              </span>
            </div>
          )}

          {/* Live copilot telemetry beacon */}
          <span className="pointer-events-none absolute -top-1 -right-1 flex h-3.5 w-3.5 z-20">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-good opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-signal-good border-2 border-surface shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </span>

          <button
            ref={inviteRef}
            type="button"
            onClick={start}
            aria-label="Start the Vorpy guided tour"
            className="flex items-center gap-3.5 rounded-2xl pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Luminous Animated Mascot Vessel */}
            <div className="relative flex items-center justify-center rounded-2xl bg-gradient-to-b from-primary/15 to-emerald-500/10 border border-primary/30 p-1.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)]">
              {/* Outer Orbiting Cyber Light Ring */}
              <div className="pointer-events-none absolute -inset-1.5 rounded-full border border-primary/35 border-dashed animate-[vorpy-orbit-glow_14s_linear_infinite]" />

              {/* Glowing Aura Lighting */}
              <div className="pointer-events-none absolute -inset-2 rounded-full bg-[radial-gradient(circle,_rgba(168,242,90,0.45)_0%,_rgba(16,185,129,0.2)_45%,_transparent_75%)] blur-md animate-pulse" />

              {/* Floating Mascot Body */}
              <div className="relative z-10 transition-transform duration-300 group-hover/pill:scale-110 animate-[vorpy-float_3.8s_ease-in-out_infinite]">
                <VorpyMascot
                  embedded
                  size={56}
                  animation={isDragging ? 'excited' : isHovered ? 'happy' : (pokeMood ?? (hasSeen ? 'idle' : 'excited'))}
                />
              </div>
            </div>

            <div className="pr-1 flex flex-col justify-center">
              {/* AI Copilot Tagline & Live Radar Indicator */}
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-primary font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-good shadow-[0_0_6px_var(--primary)]" />
                  <span>{tour.label}</span>
                </span>
                <span className="text-ink-faint text-[9px]">·</span>
                <span className="font-mono text-[8px] uppercase tracking-wider text-ink-dim font-semibold bg-surface-elevated/70 px-1 py-0.2 rounded border border-line/40">
                  DRAGGABLE PET
                </span>
              </div>

              {/* Title & Interactive Voice Wave Equalizer Row */}
              <div className="flex items-center gap-2.5 mt-1">
                <span className="block text-xs font-bold leading-tight text-ink group-hover/pill:text-primary transition-colors tracking-tight">
                  {tour.invite}
                </span>

                {/* Voice Waves / Audio Frequency Pulse Equalizer */}
                <div
                  className="flex items-center gap-[2.5px] h-4 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25 shadow-[0_0_8px_rgba(168,242,90,0.25)]"
                  title="Vorpy Neural Voice Wave Active"
                >
                  <span className="w-[2px] rounded-full bg-primary animate-[voiceWave1_0.75s_ease-in-out_infinite]" />
                  <span className="w-[2px] rounded-full bg-emerald-400 animate-[voiceWave2_1.1s_ease-in-out_infinite_0.15s]" />
                  <span className="w-[2px] rounded-full bg-primary animate-[voiceWave3_0.6s_ease-in-out_infinite_0.3s]" />
                  <span className="w-[2px] rounded-full bg-cyan-400 animate-[voiceWave2_0.95s_ease-in-out_infinite_0.05s]" />
                  <span className="w-[2px] rounded-full bg-primary animate-[voiceWave1_1.25s_ease-in-out_infinite_0.2s]" />
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss Vorpy"
            title="Dismiss Vorpy"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-all hover:bg-foreground/10 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:scale-110 ml-0.5"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  const pct = total > 0 ? ((index + 1) / total) * 100 : 0;

  const tourOverlay = (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[90] rounded-stem ring-2 ring-primary transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: Math.max(6, rect.top - 8),
            left: Math.max(6, rect.left - 8),
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px hsl(222 25% 11% / 0.55)',
          }}
        >
          <div className="absolute -inset-1 rounded-[inherit] ring-4 ring-primary/20 motion-reduce:hidden" />
        </div>
      )}

      {/*
        Vorpy the pet hovers in the air beside whichever element the step is about,
        thinking the copy in an elevated thought cloud. When changing steps,
        Vorpy smoothly flies across the screen to the next target element.
      */}
      <div
        className="vorpy-anchor"
        style={{
          left: anchor?.left ?? 0,
          top: anchor?.top ?? 0,
          zIndex: 100,
          opacity: anchor ? 1 : 0,
          transition: reduceMotion
            ? 'none'
            : 'left 0.45s cubic-bezier(0.16, 1, 0.3, 1), top 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
        }}
      >
        <div
          ref={groupRef}
          className="vorpy-group"
          data-side={anchor?.side ?? 'right'}
        >
          {/* Flying Pet with floating bob & energy trail */}
          <div className="vorpy-pet" aria-hidden="true">
            <div className="vorpy-pet-halo" />
            <span className="vorpy-trail">
              <i />
              <i />
              <i />
            </span>
            <div
              className="vorpy-pet-float cursor-pointer hover:scale-115 active:scale-95 transition-all duration-300"
              onClick={handlePoke}
              title="Click Vorpy to interact!"
            >
              <VorpyMascot embedded size={92} animation={pokeMood ?? step.animation} />
            </div>
          </div>

          {/* Elevated Frosted Glass Thought Cloud */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            tabIndex={-1}
            className="vorpy-cloud focus:outline-none overflow-hidden"
          >
            {/* Ambient specular highlight */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-px opacity-75 bg-radial-at-tl from-primary/25 via-transparent to-transparent"
            />

            <div className="relative px-6 pb-5 pt-5 sm:px-7 sm:pt-6">
              <div aria-live="polite">
                <div className="flex items-center justify-between gap-3 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary font-bold">
                      {step.eyebrow}
                    </span>
                    {/* Live Voice Waves in Header */}
                    <div className="flex items-center gap-[2.5px] h-3.5 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/25" title="Vorpy Neural Voice Wave">
                      <span className="w-[2px] rounded-full bg-primary animate-[voiceWave1_0.75s_ease-in-out_infinite]" />
                      <span className="w-[2px] rounded-full bg-primary animate-[voiceWave2_1.1s_ease-in-out_infinite_0.2s]" />
                      <span className="w-[2px] rounded-full bg-emerald-400 animate-[voiceWave3_0.6s_ease-in-out_infinite_0.4s]" />
                      <span className="w-[2px] rounded-full bg-primary animate-[voiceWave2_1.0s_ease-in-out_infinite_0.1s]" />
                    </div>
                  </div>
                  <span className="rounded-full bg-surface-elevated/80 px-2.5 py-0.5 font-mono text-[10px] font-bold text-ink-dim border border-line/60 shadow-xs">
                    {index + 1} / {total}
                  </span>
                </div>

                <h2
                  id={titleId}
                  className="mt-2 pr-6 text-base sm:text-lg font-bold leading-snug tracking-tight text-ink drop-shadow-xs"
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

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => close(true)}
                  className="text-xs text-ink-faint transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-medium"
                >
                  Skip
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={back}
                    disabled={index === 0}
                    className="rounded-xl border-line/60 bg-surface/40 backdrop-blur-md text-xs font-semibold hover:bg-surface/80"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Back
                    <kbd className="ml-1.5 hidden sm:inline-flex text-[9px] font-mono px-1 py-0.2 rounded bg-surface border border-line/60 text-ink-faint">←</kbd>
                  </Button>
                  {index < total - 1 ? (
                    <Button
                      size="sm"
                      onClick={next}
                      className="rounded-xl text-xs font-bold shadow-md shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Next
                      <kbd className="ml-1.5 hidden sm:inline-flex text-[9px] font-mono px-1 py-0.2 rounded bg-black/30 border border-white/20 text-white">→</kbd>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => close(true)}
                      className="rounded-xl text-xs font-bold shadow-md shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Done
                    </Button>
                  )}
                </div>
              </div>

              {/* Laser neon progress bar */}
              <div
                className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated/80 border border-line/30"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(34,197,94,0.5)] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => close()}
              aria-label="Close the tour"
              className="absolute right-3.5 top-3.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-transparent hover:border-line/40"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return tourOverlay;
}
