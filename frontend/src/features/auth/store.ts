import { create } from 'zustand';

import type { User } from '@/types';

import {
  getCurrentUser,
  loginWithGitHubCode,
  logoutRequest,
} from '@/features/auth/api/auth';
import { UNAUTHORIZED_EVENT } from '@/lib/http-client';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/lib/token';

/**
 * Auth status:
 *  - loading          → a session may exist; we're fetching /me
 *  - authenticated    → current user is set
 *  - unauthenticated  → no session
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  initialize: () => Promise<void>;
  login: (code: string, state?: string) => Promise<void>;
  completeLogin: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Test / 401-recovery hook — sets the session without a network call. */
  setSession: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  status: 'unauthenticated',

  initialize: async () => {
    const token = getAccessToken();
    if (!token) {
      set({ user: null, status: 'unauthenticated' });
      return;
    }
    set({ status: 'loading' });
    try {
      const user = await getCurrentUser();
      set({ user, status: 'authenticated' });
    } catch {
      // http interceptor already cleared the token on 401.
      clearAccessToken();
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (code: string, state?: string) => {
    set({ status: 'loading' });
    // GitHub OAuth codes are single-use. Never retry the same code — a network
    // blip on Render's cold start means the user must start a fresh OAuth flow
    // (new code), not resend this one.
    const { access_token } = await loginWithGitHubCode({ code, state });
    setAccessToken(access_token);
    const user = await getCurrentUser();
    set({ user, status: 'authenticated' });
  },

  completeLogin: async (token: string) => {
    setAccessToken(token);
    await get().initialize();
  },

  logout: async () => {
    await logoutRequest();
    clearAccessToken();
    set({ user: null, status: 'unauthenticated' });
  },

  setSession: (user) =>
    set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
}));

// Any 401 anywhere in the app invalidates the whole session.
if (typeof window !== 'undefined') {
  window.addEventListener(UNAUTHORIZED_EVENT, () => {
    useAuthStore.setState({ user: null, status: 'unauthenticated' });
  });
}