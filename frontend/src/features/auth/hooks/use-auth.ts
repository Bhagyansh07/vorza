import { useAuthStore } from '@/features/auth/store';

/** Convenience hook exposing the whole auth store slice. */
export function useAuth() {
  return useAuthStore();
}

export function useAuthStatus() {
  return useAuthStore((s) => s.status);
}

export function useUser() {
  return useAuthStore((s) => s.user);
}