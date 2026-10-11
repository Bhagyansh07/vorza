/**
 * Where Vorpy hovers for a tour step.
 *
 * The mascot is a pet, not a corner panel: it floats beside whichever element a
 * step is about, with a thought cloud on the same side. This module holds the
 * geometry alone, so the choice of side can be reasoned about and unit-tested
 * without a browser.
 */

/** Gap left between the target and Vorpy's cloud. */
export const ANCHOR_GAP = 16;
/** Keep the cloud at least this far inside the viewport edges. */
export const VIEWPORT_MARGIN = 12;

/** A plain, layout-independent copy of an element's box. */
export interface TargetRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

/** Which side of the target Vorpy sits on. */
export type Side = 'right' | 'left' | 'below' | 'above';

export interface Anchor {
  left: number;
  top: number;
  side: Side;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * Place Vorpy beside the target: to the right or left when there is room,
 * otherwise below or above, always inside the viewport. The size is the measured
 * cloud group, so the side is chosen from the real room left, not a guess at the
 * copy length.
 */
export function computeAnchor(
  rect: TargetRect,
  size: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
): Anchor {
  const maxX = viewportWidth - size.width - VIEWPORT_MARGIN;
  const maxY = viewportHeight - size.height - VIEWPORT_MARGIN;
  const centerX = clamp(
    rect.left + rect.width / 2 - size.width / 2,
    VIEWPORT_MARGIN,
    maxX,
  );
  const centerY = clamp(
    rect.top + rect.height / 2 - size.height / 2,
    VIEWPORT_MARGIN,
    maxY,
  );

  if (rect.right + ANCHOR_GAP + size.width <= viewportWidth - VIEWPORT_MARGIN) {
    return { left: rect.right + ANCHOR_GAP, top: centerY, side: 'right' };
  }
  if (rect.left - ANCHOR_GAP - size.width >= VIEWPORT_MARGIN) {
    return {
      left: rect.left - ANCHOR_GAP - size.width,
      top: centerY,
      side: 'left',
    };
  }
  if (rect.bottom + ANCHOR_GAP + size.height <= viewportHeight - VIEWPORT_MARGIN) {
    return { left: centerX, top: rect.bottom + ANCHOR_GAP, side: 'below' };
  }
  if (rect.top - ANCHOR_GAP - size.height >= VIEWPORT_MARGIN) {
    return {
      left: centerX,
      top: rect.top - ANCHOR_GAP - size.height,
      side: 'above',
    };
  }
  // Nothing fits cleanly (a very small viewport): settle on the bottom edge.
  return { left: centerX, top: maxY, side: 'above' };
}
