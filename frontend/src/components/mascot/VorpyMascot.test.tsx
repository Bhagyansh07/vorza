import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { VorpyMascot } from './VorpyMascot';

/**
 * Vorpy is Vorza's own SVG now (no third-party runtime), so these tests pin the
 * shell a screen depends on: the shared viewBox, the body ball plus the two eye
 * sets the moods swap between, the mood class the CSS keys off, and the fact
 * that the whole thing is decorative.
 *
 * Motion itself lives in `index.css`; the boundary test reads the palette
 * tokens, and the reduced-motion rule there collapses every animation to one
 * frame.
 */

describe('VorpyMascot', () => {
  it('renders the ball in the shared viewBox', () => {
    const { container } = render(<VorpyMascot />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('-150 -150 300 300');

    // One body circle, and the open / happy eye sets the moods pick from.
    expect(container.querySelector('.vorpy-body circle')).not.toBeNull();
    expect(container.querySelectorAll('.vorpy-eyes--open ellipse')).toHaveLength(2);
    expect(container.querySelector('.vorpy-eyes--happy')).not.toBeNull();
  });

  it('reflects the requested mood as a class the CSS can key off', () => {
    const { container, rerender } = render(<VorpyMascot animation="thinking" />);
    expect(container.firstElementChild?.className).toContain('vorpy--thinking');

    rerender(<VorpyMascot animation="celebrate" />);
    expect(container.firstElementChild?.className).toContain('vorpy--celebrate');
  });

  it('is decorative: hidden from assistive tech', () => {
    const { container } = render(<VorpyMascot />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
});
