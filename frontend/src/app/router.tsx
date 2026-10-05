import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/app/ProtectedRoute';
import { NotFound } from '@/app/routes/NotFound';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/routes/Login';
import { Landing } from '@/features/landing/routes/Landing';
import { Dashboard } from '@/features/repos/routes/Dashboard';
import { RepoDetail } from '@/features/repos/routes/RepoDetail';
import { RepoHistory } from '@/features/repos/routes/RepoHistory';

/**
 * Route map — mirrors CONTRACTS.md "Frontend route map" section:
 *   /  /login  /dashboard  /repos/:repoId  /repos/:repoId/history
 *
 * `/` is the public landing page. It used to redirect to `/dashboard`, which
 * sits behind `ProtectedRoute`, so the app had no indexable page at all. See
 * `features/landing/routes/Landing.tsx`.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/repos/:repoId" element={<RepoDetail />} />
            <Route path="/repos/:repoId/history" element={<RepoHistory />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}