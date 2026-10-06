import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { Landing } from './Landing';

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 60));
}

describe('Landing', () => {
  it('renders the whole survey: hero, story, blast radius, review and honesty notes', async () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    await settle();

    // Hero
    expect(
      screen.getByRole('heading', { name: 'The living, AI-reviewed map of your codebase.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('01 · Survey')).toBeInTheDocument();
    expect(
      screen.getAllByRole('img', { name: /Demo map of a codebase/ }).length,
    ).toBeGreaterThanOrEqual(1);

    // Scroll story beats
    expect(screen.getByRole('heading', { name: 'Clusters are packages' })).toBeInTheDocument();
    expect(screen.getByText('Reading the map · 01 / 03')).toBeInTheDocument();

    // Blast radius demo
    expect(
      screen.getByRole('heading', { name: 'Hover a file. See everything it drags along.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('surveyed: none yet')).toBeInTheDocument();

    // Sample review
    expect(screen.getByText('Sample review')).toBeInTheDocument();
    expect(screen.getByText('risk 58')).toBeInTheDocument();
    expect(screen.getByText('2 findings dropped: not in the diff')).toBeInTheDocument();

    // Inventory + field notes
    expect(screen.getByRole('heading', { name: 'What it actually does' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'How it was built, without the part where it went smoothly.',
      }),
    ).toBeInTheDocument();

    // Animated metrics
    expect(screen.getByText('files in the demo map')).toBeInTheDocument();

    // The scope honesty note from the audit
    expect(screen.getByText(/Narrowing it to read-only needs a GitHub App/i)).toBeInTheDocument();
  });
});