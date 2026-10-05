import axios, { AxiosError } from 'axios';

import type {
  AnalysisSnapshot,
  AnalyzeQueuedResponse,
  CommentPin,
  ListEnvelope,
  Repo,
  SnapshotSummary,
  User,
} from '@/types';
import type {
  ApiClient,
  AuthResponse,
  ConnectRepoInput,
  CreateCommentInput,
  LoginWithGitHubCodeInput,
} from '@/lib/api-types';

import { ApiError } from '@/lib/errors';
import { clearAccessToken, getAccessToken } from '@/lib/token';

export const UNAUTHORIZED_EVENT = 'Vorza:unauthorized';

const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach the JWT to every request.
http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Surface normalized errors; on a 401, invalidate the session so the app can
// bounce to /login. The auth listener (features/auth) picks up the event.
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; message?: string }>) => {
    if (error.response?.status === 401) {
      clearAccessToken();
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    const fallbackMessage = 'Request failed. Please try again.';
    const serverMessage =
      error.response?.data?.detail ?? error.response?.data?.message;

    throw new ApiError(
      serverMessage ?? error.message ?? fallbackMessage,
      error.response?.status ?? 0,
      error.code
    );
  }
);

/** Real HTTP implementation of ApiClient, talking to Agent 1's FastAPI backend. */
export const httpApiClient: ApiClient = {
  async loginWithGitHubCode(
    input: LoginWithGitHubCodeInput
  ): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>(
      '/auth/github/callback',
      input
    );
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await http.get<User>('/me');
    return data;
  },

  async logOut(): Promise<void> {
    // JWT is stateless per CONTRACTS.md; clearing the stored token is enough.
    clearAccessToken();
  },

  async listRepos(): Promise<Repo[]> {
    const { data } = await http.get<ListEnvelope<Repo>>('/repos');
    return data.data;
  },

  async connectRepo(input: ConnectRepoInput): Promise<Repo> {
    const { data } = await http.post<Repo>('/repos', input);
    return data;
  },

  async getLatestSnapshot(
    repoId: string | number
  ): Promise<AnalysisSnapshot> {
    const { data } = await http.get<AnalysisSnapshot>(
      `/repos/${repoId}/snapshots/latest`
    );
    return data;
  },

  async getSnapshotHistory(
    repoId: string | number
  ): Promise<SnapshotSummary[]> {
    const { data } = await http.get<ListEnvelope<SnapshotSummary>>(
      `/repos/${repoId}/snapshots/history`
    );
    return data.data;
  },

  async analyzeRepo(repoId: string | number): Promise<AnalyzeQueuedResponse> {
    const { data } = await http.post<AnalyzeQueuedResponse>(
      `/repos/${repoId}/analyze`
    );
    return data;
  },

  async listComments(
    repoId: string | number
  ): Promise<CommentPin[]> {
    const { data } = await http.get<ListEnvelope<CommentPin>>(
      `/repos/${repoId}/comments`
    );
    return data.data;
  },

  async createComment(
    repoId: string | number,
    input: CreateCommentInput
  ): Promise<CommentPin> {
    const { data } = await http.post<CommentPin>(
      `/repos/${repoId}/comments`,
      input
    );
    return data;
  },
};