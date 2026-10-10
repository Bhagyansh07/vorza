/**
 * Remembers that a visitor has already been offered (or finished) a tour, so
 * the guide only leans in once per screen and does not nag.
 *
 * Everything is wrapped: private-mode Safari and hardened browsers throw on
 * `localStorage` access, and a tour is never worth breaking the page over.
 */

export type TourState = 'seen' | 'done';

const storageKey = (id: string): string => `vorza:tour:${id}`;

export function readTourState(id: string): TourState | null {
  try {
    const value = window.localStorage.getItem(storageKey(id));
    return value === 'seen' || value === 'done' ? value : null;
  } catch {
    return null;
  }
}

export function writeTourState(id: string, state: TourState): void {
  try {
    window.localStorage.setItem(storageKey(id), state);
  } catch {
    // Storage is unavailable; the tour still works, it just leans in again.
  }
}
