/**
 * API client entry point.
 *
 * `api` is the single object every feature talks to. While Agent 1's backend
 * is being built it dispatches to the in-browser mock (VITE_USE_MOCKS=true);
 * flip that env var and it becomes a real HTTP client with zero code changes
 * in the features.
 */
import type { ApiClient } from '@/lib/api-types';
import { config } from '@/lib/config';
import { httpApiClient } from '@/lib/http-client';
import { mockApiClient } from '@/lib/mock-api';

/** The active API implementation (mock in dev until backend lands). */
export const api: ApiClient = config.useMocks ? mockApiClient : httpApiClient;

export * from '@/lib/api-types';
export { ApiError, toErrorMessage } from '@/lib/errors';