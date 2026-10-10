import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { BentoCard, BentoGrid } from '@/components/ui/bento-grid';
import { NumberTicker } from '@/components/ui/number-ticker';
import { describe, expect, it } from 'vitest';

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

  it('BentoCard renders a large stat slot for metric cards', () => {
    render(
      <BentoGrid>
        <BentoCard
          title="Repositories"
          description="Connected and mapped"
          stat={<span>12</span>}
          className="col-span-1"
        />
      </BentoGrid>
    );

    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Repositories' })).toBeVisible();
  });

  it('NumberTicker renders its stable start value before it is in view', () => {
    render(<NumberTicker value={42} />);
    expect(screen.getByText('0')).toBeVisible();
  });
});