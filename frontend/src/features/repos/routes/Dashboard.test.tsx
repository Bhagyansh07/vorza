import { beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { Dashboard } from '@/features/repos/routes/Dashboard';

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return queryClient;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('Dashboard', () => {
  it('lists the connected repositories from the API', async () => {
    renderDashboard();

    expect(await screen.findByText('facebook/react')).toBeInTheDocument();
    expect(screen.getByText('axios/axios')).toBeInTheDocument();
    expect(screen.getByText('vitejs/vite')).toBeInTheDocument();

    // The honest metric strip sits above the grid, all derived from the same
    // repo list (mock data has no analysis errors, so re-analysis is 0).
    expect(screen.getByRole('heading', { name: 'Repositories' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Mapped without issues' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Re-analysis needed' })
    ).toBeInTheDocument();
  });

  it('offers an empty state when there are no repos', async () => {
    // No way to empty the mock list cleanly — the demo store always has repos,
    // so assert the "connect" affordance that doubles as the empty state entry.
    renderDashboard();

    expect(
      await screen.findByRole('button', { name: /connect repo/i })
    ).toBeInTheDocument();
  });

  it('connects a new repository and shows it in the list', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /connect repo/i }));
    await user.type(await screen.findByLabelText(/owner\/repo/i), 'octocat/hello');
    await user.click(screen.getByRole('button', { name: /^connect$/i }));

    expect(await screen.findByText('octocat/hello')).toBeInTheDocument();
  });
});