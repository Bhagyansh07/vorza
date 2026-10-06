import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Metrics } from './Metrics';

describe('Metrics', () => {
  it('renders labels and notes, and the count-up starts from zero', async () => {
    render(
      <Metrics
        metrics={[
          { value: 1234, label: 'files mapped', note: 'from the demo dataset' },
          { value: 88, label: 'edges drawn', note: 'real dependencies' },
        ]}
      />,
    );

    expect(screen.getByText('files mapped')).toBeInTheDocument();
    expect(screen.getByText('from the demo dataset')).toBeInTheDocument();
    expect(screen.getByText('edges drawn')).toBeInTheDocument();

    // jsdom has no IntersectionObserver, so the bar counts as in view. After a
    // couple of animation frames the number moved off zero but has not yet
    // reached its target.
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);

    await new Promise((resolve) => setTimeout(resolve, 80));

    for (const el of screen.getAllByText(/\d+/)) {
      const n = Number(el.textContent?.replace(/,/g, ''));
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1234);
    }
    const progressed = screen
      .getAllByText(/\d+/)
      .some((el) => {
        const n = Number(el.textContent?.replace(/,/g, ''));
        return n > 0 && n < 1234;
      });
    expect(progressed).toBe(true);
  });
});