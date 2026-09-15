import type { User } from '@/types';
import type {
  AuthResponse,
  LoginWithGitHubCodeInput,
} from '@/lib/api-types';

import { api } from '@/lib/api-client';

/** Feature API module — thin, typed delegations to the shared client. */

export function loginWithGitHubCode(input: LoginWithGitHubCodeInput): Promise<AuthResponse> {
  return api.loginWithGitHubCode(input);
}

export function getCurrentUser(): Promise<User> {
  return api.getMe();
}

export function logoutRequest(): Promise<void> {
  return api.logOut();
}