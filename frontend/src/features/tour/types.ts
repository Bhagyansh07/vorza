import type { AnimationKey } from '@/components/mascot/VorpyMascot';

/**
 * One stop on a guided tour.
 *
 * `target` is the `data-tour` value the step points at; the engine scrolls that
 * element into view and rings it. Everything else is the copy Vorpy says.
 */
export interface TourStep {
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Which Vorpy animation plays while this step is on screen. */
  animation: AnimationKey;
}

/**
 * A whole tour for one screen. Every route mounts the same engine with a
 * different definition, so the guide behaves identically on the landing page
 * and inside the app.
 */
export interface TourDefinition {
  /** Stable id, used for the localStorage key and the test hooks. */
  id: string;
  /** Short label on the invite button, e.g. "Show me around". */
  invite: string;
  /** The heading on the invite card, e.g. "Overview". */
  label: string;
  steps: readonly TourStep[];
}
