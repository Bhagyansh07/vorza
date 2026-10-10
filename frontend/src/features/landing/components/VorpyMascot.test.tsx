import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { VorpyMascot } from './VorpyMascot';

/**
 * The mascot renders through the framework-independent Bible Strong runtime, so
 * this test only asserts the shell: an SVG in the runtime's viewBox, painted in
 * the exported colours, and invisible to assistive tech.
 *
 * Motion is forced off so the render is the deterministic static frame; that is
 * also the exact path a `prefers-reduced-motion: reduce` visitor takes.
 */

function stubReducedMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe('VorpyMascot', () => {
  beforeEach(() => {
    stubReducedMotion(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the exported body and eye colours', () => {
    const { container } = render(<VorpyMascot />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('-150 -150 300 300');

    // The body fills the head and body-node paths; the eyes are the group that
    // clips the two eye paths to the head.
    const fills = [...container.querySelectorAll('path')].map((path) =>
      path.getAttribute('fill'),
    );
    expect(fills).toContain('#2f27ce');
    expect(container.querySelector('g')?.getAttribute('fill')).toBe('#e7e9ff');
  });

  it('is decorative: hidden from assistive tech', () => {
    const { container } = render(<VorpyMascot />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
});
