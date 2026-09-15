import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/app/ProtectedRoute';
import { useAuthStore } from '@/features/auth/store';

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>protected-content</div>} />
        </Route>
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    status: 'unauthenticated',
    setSession() {},
  });
});

describe('ProtectedRoute', () => {
  it('renders children for an authenticated user', () => {
    useAuthStore.setState({
      user: {
        id: 'u_1',
        email: 'dev@codeatlas.dev',
        github_username: 'codeatlas-dev',
        created_at: '',
      },
      status: 'authenticated',
    });

    renderProtected();

    expect(screen.getByText('protected-content')).toBeInTheDocument();
  });

  it('bounces an unauthenticated user to /login', () => {
    renderProtected();

    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument();
  });

  it('shows a loading state while the session is being resolved', () => {
    useAuthStore.setState({ user: null, status: 'loading' });

    renderProtected();

    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument();
  });
});