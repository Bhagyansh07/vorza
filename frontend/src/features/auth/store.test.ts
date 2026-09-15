import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/store';

const defaultState = () => ({
  user: null,
  status: 'unauthenticated' as const,
});

beforeEach(() => {
  // Reset the store between tests; keep the real actions (they hit the mock
  // API client, which is what we want to exercise).
  useAuthStore.setState(defaultState());
  window.localStorage.clear();
});

describe('useAuthStore (auth flow)', () => {
  it('logs in with a GitHub code and stores the session', async () => {
    const { login } = useAuthStore.getState();

    await login('demo-code');

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user?.github_username).toBe('Vorza-dev');
    expect(window.localStorage.getItem('Vorza.access_token')).toBeTruthy();
  });

  it('initializes as unauthenticated when no token is stored', async () => {
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('logs out and clears the stored token', async () => {
    useAuthStore.setState({
      user: { id: 'u_1', email: 'a@b.c', github_username: 'dev', created_at: '' },
      status: 'authenticated',
    });
    window.localStorage.setItem('Vorza.access_token', 't');

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
    expect(window.localStorage.getItem('Vorza.access_token')).toBeNull();
  });

  it('reacts to a global unauthorized event by clearing the session', () => {
    useAuthStore.setState({
      user: { id: 'u_1', email: 'a@b.c', github_username: 'dev', created_at: '' },
      status: 'authenticated',
    });

    window.dispatchEvent(new CustomEvent('Vorza:unauthorized'));

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });
});