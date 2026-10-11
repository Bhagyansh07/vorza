import { describe, expect, it } from 'vitest';

import { computeAnchor } from './placement';
import type { TargetRect } from './placement';

/**
 * Vorpy is a pet that floats beside the step's element, so the placement rule is
 * the heart of the redesign: right or left when there is room, otherwise below or
 * above, and always inside the viewport. These cases are the shapes of real
 * layouts (a wide hero, a card at the screen edge, a small phone) and would be
 * hard to see by eye in a headless pane.
 */

const rect = (box: Partial<TargetRect>): TargetRect => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: 0,
  height: 0,
  ...box,
});

const size = { width: 400, height: 200 };

describe('computeAnchor', () => {
  it('hovers to the right of the target when there is room', () => {
    const target = rect({
      left: 100,
      right: 300,
      top: 200,
      bottom: 260,
      width: 200,
      height: 60,
    });
    const anchor = computeAnchor(target, size, 1440, 900);

    expect(anchor.side).toBe('right');
    expect(anchor.left).toBe(300 + 16);
    // Vertically centred on the target: 200 + 30 - 100.
    expect(anchor.top).toBe(130);
  });

  it('flips to the left when the right side is tight', () => {
    const target = rect({
      left: 500,
      right: 780,
      top: 200,
      bottom: 260,
      width: 280,
      height: 60,
    });
    const anchor = computeAnchor(target, size, 800, 600);

    expect(anchor.side).toBe('left');
    expect(anchor.left).toBe(500 - 16 - 400);
  });

  it('drops below a target pinned near the top', () => {
    const target = rect({
      left: 300,
      right: 500,
      top: 30,
      bottom: 90,
      width: 200,
      height: 60,
    });
    const anchor = computeAnchor(target, size, 800, 600);

    expect(anchor.side).toBe('below');
    expect(anchor.top).toBe(90 + 16);
    // Centred on the target, inside the viewport.
    expect(anchor.left).toBe(200);
  });

  it('rises above a target pinned near the bottom', () => {
    const target = rect({
      left: 300,
      right: 500,
      top: 520,
      bottom: 580,
      width: 200,
      height: 60,
    });
    const anchor = computeAnchor(target, size, 800, 600);

    expect(anchor.side).toBe('above');
    expect(anchor.top).toBe(520 - 16 - 200);
  });

  it('clamps inside the viewport when no side has full room', () => {
    const target = rect({
      left: 100,
      right: 300,
      top: 100,
      bottom: 160,
      width: 200,
      height: 60,
    });
    // A viewport where no side leaves the full ANCHOR_GAP: it still settles in.
    const anchor = computeAnchor(target, { width: 360, height: 200 }, 400, 300);

    expect(anchor.side).toBe('above');
    expect(anchor.left).toBe(20);
    expect(anchor.top).toBe(300 - 200 - 12);
    expect(anchor.left + 360).toBeLessThanOrEqual(400);
  });
});
