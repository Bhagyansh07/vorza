import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/app/ProtectedRoute';
import { NotFound } from '@/app/routes/NotFound';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/routes/Login';
import { Landing } from '@/features/landing/routes/Landing';

/**
 * Route map, mirrors CONTRACTS.md "Frontend route map" section:
 *   /  /login  /dashboard  /repos/:repoId  /repos/:repoId/history
 *
 * `/` is the public landing page. It used to redirect to `/dashboard`, which
 * sits behind `ProtectedRoute`, so the app had no indexable page at all. See
 * `features/landing/routes/Landing.tsx`.
 *
 * The three authed routes are code-split so the landing page and the login
 * page never download the repos/graph feature code. AppShell owns the Suspense
 * fallback. Each resolver unwraps the named export.
 */
const Dashboard = lazy(async () => ({
  default: (await import('@/features/repos/routes/Dashboard')).Dashboard,
}));
const RepoDetail = lazy(async () => ({
  default: (await import('@/features/repos/routes/RepoDetail')).RepoDetail,
}));
const RepoHistory = lazy(async () => ({
  default: (await import('@/features/repos/routes/RepoHistory')).RepoHistory,
}));

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