import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { BentoCard, BentoGrid } from '@/components/ui/bento-grid';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { describe, expect, it } from 'vitest';

// jsdom has no IntersectionObserver; motion's useInView treats a missing IO
// as "in view", which is exactly what these smoke tests want to avoid leaning
// on. A stub keeps the behaviour deterministic either way.
class IntersectionObserverStub {
  root = null;
  rootMargin = '';
  thresholds = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): never[] {
    return [];
  }
}

describe('motion-based UI kit', () => {
  it('BentoGrid/BentoCard render title, description and a token-driven Link', () => {
    render(
      <MemoryRouter>
        <BentoGrid>
          <BentoCard
            title="Repositories"
            description="Map any GitHub repo"
            to="/dashboard"
            actionLabel="Open map"
            className="col-span-3 lg:col-span-1"
          />
        </BentoGrid>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Repositories' })).toBeVisible();
    expect(screen.getByText('Map any GitHub repo')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open map' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });

  it('NumberTicker renders its stable start value before it is in view', () => {
    const io = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = IntersectionObserverStub as never;

    try {
      render(<NumberTicker value={42} />);
      expect(screen.getByText('0')).toBeVisible();
    } finally {
      globalThis.IntersectionObserver = io;
    }
  });

  it('ShimmerButton renders children with a token background', () => {
    render(<ShimmerButton data-testid="cta">Connect repo</ShimmerButton>);
    expect(screen.getByRole('button', { name: 'Connect repo' })).toBeVisible();
  });
});