import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LoginPage } from '@/features/auth/routes/Login';
import { useAuthStore } from '@/features/auth/store';

// Keep the real config but spy on the navigator so the "Continue with GitHub"
// click is assertable without touching jsdom's non-configurable location.
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return { ...actual, oauthRedirect: vi.fn() };
});

const mockUser = {
  id: 'u_1',
  email: 'dev@codeatlas.dev',
  github_username: 'codeatlas-dev',
  created_at: '2026-01-01T00:00:00Z',
};

function renderLogin(initialEntry = '/login') {
  const router = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return router;
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    status: 'unauthenticated',
    setSession() {},
  });
  window.localStorage.clear();
});

describe('LoginPage', () => {
  it('shows the GitHub OAuth entry point when signed out', () => {
    renderLogin();

    expect(
      screen.getByRole('button', { name: /continue with github/i })
    ).toBeInTheDocument();
  });

  it('redirects an already-authenticated user straight to the redirect target', async () => {
    useAuthStore.setState({ user: mockUser, status: 'authenticated' });

    renderLogin();

    expect(await screen.findByText('dashboard-page')).toBeInTheDocument();
  });

  it('redirects to the browser when the user clicks Continue with GitHub', async () => {
    const redirect = vi.mocked(
      (await import('@/lib/config')).oauthRedirect
    );
    const user = userEvent.setup();
    renderLogin();

    await user.click(
      screen.getByRole('button', { name: /continue with github/i })
    );

    expect(redirect).toHaveBeenCalledOnce();
    expect(redirect.mock.calls[0][0]).toMatch(/github\.com\/login\/oauth\/authorize/);
  });

  it('exchanges a ?code= from the OAuth callback and lands on the dashboard', async () => {
    renderLogin('/login?code=callback-code');

    expect(await screen.findByText('dashboard-page')).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.github_username).toBe('codeatlas-dev');
  });
});