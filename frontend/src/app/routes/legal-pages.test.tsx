import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PrivacyPage } from './Privacy';
import { TermsPage } from './Terms';

function renderPrivacy() {
  return render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>
  );
}

function renderTerms() {
  return render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>
  );
}

describe('legal pages', () => {
  it('privacy policy renders honest sections about storage and sharing', () => {
    renderPrivacy();
    expect(
      screen.getByRole('heading', { name: 'Privacy policy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'What the service collects' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/localStorage/i)).toBeInTheDocument();
    expect(screen.getByText(/github\.com\/Bhagyansh07\/vorza/)).toBeInTheDocument();
  });

  it('terms render the ownership, scope and warranty sections', () => {
    renderTerms();
    expect(
      screen.getByRole('heading', { name: 'Terms of service' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Your code stays yours' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/as is/i)).toBeInTheDocument();
  });

  it('privacy copy contains no em dashes', () => {
    const { container } = renderPrivacy();
    expect(container.textContent).not.toMatch(/—/);
  });

  it('terms copy contains no em dashes', () => {
    const { container } = renderTerms();
    expect(container.textContent).not.toMatch(/—/);
  });
});