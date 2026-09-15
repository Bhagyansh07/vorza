import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { MapIcon } from 'lucide-react';

import { useAuthStatus } from '@/features/auth/hooks/use-auth';
import { useAuthStore } from '@/features/auth/store';

function LoadingScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background">
      <MapIcon className="h-8 w-8 animate-pulse text-primary" />
      <p className="text-sm text-muted-foreground">Checking your session…</p>
    </div>
  );
}

/**
 * Route wrapper: waits for the session check, then lets authenticated users
 * through or bounces them to /login (remembering where they were headed).
 */
export function ProtectedRoute() {
  const location = useLocation();
  const status = useAuthStatus();

  if (status === 'loading') return <LoadingScreen />;

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

/**
 * Boots the auth session once at app start: reads the stored token (if any)
 * and resolves the current user via GET /me.
 */
export function AuthInitializer() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return null;
}