/**
 * Real WebSocket `RealtimeSource`, replacing the hardcoded `mockRealtimeSource`
 * that `RepoDetail.tsx` passed to `<GraphView>`.
 *
 * Wire protocol — owned by `app/ws/events.py` and mirrored in `CONTRACTS.md`:
 *
 *   connect  wss://<api>/ws/repos/{repo_id}
 *   send     {"type": "presence:join", "payload": {repo_id, user_id, token}}
 *            MUST be the first frame. `gateway._await_join` closes the socket
 *            after JOIN_TIMEOUT_SECONDS if it does not arrive, and rejects it
 *            outright if `token` is missing.
 *   receive  {"type": ..., "payload": ...}, one of presence:roster,
 *            presence:cursor, presence:leave, comment:new, snapshot:updated,
 *            review:new, error.
 *
 * Two shapes for comment events, because the gateway genuinely emits both:
 * `review_pull_request` publishes `{"comment": stored}` (gateway.py:221) while
 * the live socket path publishes the row directly (gateway.py, comment branch).
 * Both are handled.
 *
 * Reconnect: exponential backoff with jitter, capped. A dropped socket on the
 * free Render deploy is routine (instances idle-spin down after 15 minutes), so
 * not reconnecting means the graph silently stops updating.
 */

import { getAccessToken } from '@/lib/token';
import type {
  AnalysisSnapshot,
  Comment,
  RealtimeScope,
  RealtimeSource,
  ReviewResult,
} from '../types';

const JOIN_TIMEOUT_MS = 10_000;
const FIRST_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;

/** `https://host` -> `wss://host/ws/repos/{id}`; empty base -> same origin. */
export function websocketUrl(apiBase: string, repoId: string): string {
  const base = apiBase.trim();
  const withoutScheme = base.replace(/^https?:\/\//i, '');
  const scheme = /^http:\/\//i.test(base) ? 'ws' : 'wss';
  const origin = withoutScheme ? `${scheme}://${withoutScheme.replace(/\/+$/, '')}` : '';
  // encodeURIComponent: repo_id is caller-supplied path input.
  return `${origin}/ws/repos/${encodeURIComponent(repoId)}`;
}

interface WireEvent {
  type?: unknown;
  payload?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Minimal socket surface, so tests can inject a fake without a DOM WebSocket.
 * `WebSocket` already satisfies this.
 */
export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface WebSocketSourceOptions {
  /** Defaults to `import.meta.env.VITE_API_URL`. */
  apiBase?: string;
  /** Defaults to the stored access token. */
  getToken?: () => string | null;
  /** The signed-in user's id, sent in the join payload. */
  userId?: string;
  /** Socket factory. Defaults to the global `WebSocket`. */
  createSocket?: (url: string) => SocketLike;
}

export function createWebSocketSource(
  options: WebSocketSourceOptions = {}
): RealtimeSource {
  const {
    apiBase = import.meta.env.VITE_API_URL ?? '',
    getToken = getAccessToken,
    userId = '',
    createSocket = (url: string) =>
      new WebSocket(url) as unknown as SocketLike,
  } = options;

  return {
    connect(repoId: string, scope: RealtimeScope): () => void {
      // `disposed` distinguishes "unmounted" from "socket dropped": only the
      // first must not schedule a reconnect.
      let disposed = false;
      let socket: SocketLike | null = null;
      let joinTimer: ReturnType<typeof setTimeout> | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let attempt = 0;

      const clearTimers = () => {
        if (joinTimer !== null) {
          clearTimeout(joinTimer);
          joinTimer = null;
        }
        if (retryTimer !== null) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
      };

      const dispatch = (event: WireEvent) => {
        const payload = asRecord(event.payload);
        if (!payload) return;

        switch (event.type) {
          case 'snapshot:updated': {
            const snapshot = payload.snapshot ?? payload;
            if (asRecord(snapshot)) {
              scope.onSnapshotUpdated(snapshot as AnalysisSnapshot);
            }
            return;
          }
          case 'presence:cursor': {
            const user = payload.user_id;
            const x = asFiniteNumber(payload.x);
            const y = asFiniteNumber(payload.y);
            // A malformed cursor would be rendered at NaN and never cleared.
            if (typeof user === 'string' && x !== null && y !== null) {
              scope.onCursor({ user_id: user, x, y });
            }
            return;
          }
          case 'comment:new': {
            const comment = payload.comment ?? payload;
            if (asRecord(comment)) {
              scope.onComment(comment as Comment);
            }
            return;
          }
          case 'review:new': {
            if (typeof payload.pr_number === 'number') {
              scope.onReview(payload as unknown as ReviewResult);
            }
            return;
          }
          default:
            // presence:roster / presence:leave / error carry no graph state.
            return;
        }
      };

      const open = () => {
        const token = getToken();
        if (!token) {
          // No session: the gateway would reject the join anyway, and a
          // reconnect loop against a guaranteed 4408 just burns the budget.
          return;
        }

        let current: SocketLike;
        try {
          current = createSocket(websocketUrl(apiBase, repoId));
        } catch {
          // Constructor throws on a malformed URL. Retry with backoff rather
          // than crashing the route.
          scheduleRetry();
          return;
        }
        socket = current;

        joinTimer = setTimeout(() => {
          // The gateway closes for a missing join; do it client-side too so the
          // reason is visible in devtools instead of an opaque close code.
          current.close(4408, 'presence:join not sent');
        }, JOIN_TIMEOUT_MS);

        current.onopen = () => {
          current.send(
            JSON.stringify({
              type: 'presence:join',
              payload: { repo_id: repoId, user_id: userId, token },
            })
          );
        };

        current.onmessage = (message) => {
          let parsed: WireEvent;
          try {
            parsed = JSON.parse(String(message.data)) as WireEvent;
          } catch {
            return;
          }
          dispatch(parsed);
        };

        current.onerror = () => {
          // `onclose` always follows; reconnection is handled there so there is
          // exactly one retry path.
        };

        current.onclose = () => {
          if (joinTimer !== null) {
            clearTimeout(joinTimer);
            joinTimer = null;
          }
          if (disposed) return;
          scheduleRetry();
        };
      };

      const scheduleRetry = () => {
        if (disposed || retryTimer !== null) return;
        const delay = Math.min(
          MAX_BACKOFF_MS,
          FIRST_BACKOFF_MS * 2 ** attempt
        );
        // Jitter so N graph tabs opened together do not all reconnect on the
        // same tick.
        const jittered = delay * (0.7 + Math.random() * 0.6);
        attempt += 1;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          open();
        }, jittered);
      };

      open();

      return () => {
        disposed = true;
        clearTimers();
        const active = socket;
        socket = null;
        if (active) {
          // Detach first: a close triggered by teardown must not schedule a
          // reconnect through onclose.
          active.onopen = null;
          active.onmessage = null;
          active.onclose = null;
          active.onerror = null;
          active.close(1000, 'client disconnect');
        }
      };
    },
  };
}