/**
 * Tests for the real WebSocket `RealtimeSource`.
 *
 * A fake socket is injected, so this exercises the handshake, the event
 * dispatch and the reconnect policy without a server or a browser WebSocket.
 *
 * Audit: docs/audit/01-code-audit.md finding H5.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createWebSocketSource,
  websocketUrl,
  type SocketLike,
} from './websocket';
import type { RealtimeScope } from '../types';

class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];

  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code?: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }

  /* test drivers */
  open(): void {
    this.onopen?.({});
  }

  emit(type: string, payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify({ type, payload }) });
  }

  emitRaw(data: string): void {
    this.onmessage?.({ data });
  }

  drop(code = 1006): void {
    this.onclose?.({ code });
  }
}

function makeScope(): RealtimeScope & {
  onSnapshotUpdated: ReturnType<typeof vi.fn>;
  onCursor: ReturnType<typeof vi.fn>;
  onComment: ReturnType<typeof vi.fn>;
  onReview: ReturnType<typeof vi.fn>;
} {
  return {
    onSnapshotUpdated: vi.fn(),
    onCursor: vi.fn(),
    onComment: vi.fn(),
    onReview: vi.fn(),
  };
}

const source = (overrides = {}) =>
  createWebSocketSource({
    apiBase: 'https://api.example.com',
    getToken: () => 'jwt-123',
    userId: 'user-9',
    createSocket: (url) => new FakeSocket(url),
    ...overrides,
  });

describe('websocketUrl', () => {
  it('maps https to wss and appends the channel path', () => {
    expect(websocketUrl('https://api.example.com', 'repo-1')).toBe(
      'wss://api.example.com/ws/repos/repo-1'
    );
  });

  it('maps http to ws for local development', () => {
    expect(websocketUrl('http://localhost:8000', 'repo-1')).toBe(
      'ws://localhost:8000/ws/repos/repo-1'
    );
  });

  it('keeps the same origin when no API base is configured', () => {
    expect(websocketUrl('', 'repo-1')).toBe('/ws/repos/repo-1');
  });

  it('tolerates a trailing slash', () => {
    expect(websocketUrl('https://api.example.com/', 'repo-1')).toBe(
      'wss://api.example.com/ws/repos/repo-1'
    );
  });

  it('encodes the repo id so it cannot escape the path', () => {
    expect(websocketUrl('https://api.example.com', '../../evil')).toBe(
      'wss://api.example.com/ws/repos/..%2F..%2Fevil'
    );
  });
});

describe('createWebSocketSource', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends presence:join as the first frame, carrying the token', () => {
    const scope = makeScope();
    source().connect('repo-1', scope);

    const socket = FakeSocket.instances[0];
    socket.open();

    expect(socket.sent).toHaveLength(1);
    const frame = JSON.parse(socket.sent[0]);
    expect(frame.type).toBe('presence:join');
    expect(frame.payload).toEqual({
      repo_id: 'repo-1',
      user_id: 'user-9',
      token: 'jwt-123',
    });
  });

  it('does not open a socket when there is no session', () => {
    source({ getToken: () => null }).connect('repo-1', makeScope());
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('dispatches snapshot:updated to the scope', () => {
    const scope = makeScope();
    source().connect('repo-1', scope);
    const socket = FakeSocket.instances[0];

    socket.emit('snapshot:updated', {
      repo_id: 'repo-1',
      snapshot: { id: 's1', files: [] },
    });

    expect(scope.onSnapshotUpdated).toHaveBeenCalledWith({
      id: 's1',
      files: [],
    });
  });

  it('accepts a bare snapshot payload', () => {
    const scope = makeScope();
    source().connect('repo-1', scope);
    FakeSocket.instances[0].emit('snapshot:updated', { id: 's1', files: [] });
    expect(scope.onSnapshotUpdated).toHaveBeenCalledWith({
      id: 's1',
      files: [],
    });
  });

  it('dispatches presence:cursor only when the coordinates are finite', () => {
    const scope = makeScope();
    source().connect('repo-1', scope);
    const socket = FakeSocket.instances[0];

    socket.emit('presence:cursor', { user_id: 'u1', x: 0.5, y: 0.25 });
    expect(scope.onCursor).toHaveBeenCalledWith({
      user_id: 'u1',
      x: 0.5,
      y: 0.25,
    });

    // NaN would be rendered at a fixed spot and never cleared.
    socket.emit('presence:cursor', { user_id: 'u1', x: null, y: 0.25 });
    socket.emit('presence:cursor', { user_id: 'u1', x: '0.5', y: 0.25 });
    expect(scope.onCursor).toHaveBeenCalledTimes(1);
  });

  it('accepts comment:new both wrapped and bare', () => {
    const scope = makeScope();
    source().connect('repo-1', scope);
    const socket = FakeSocket.instances[0];

    // gateway.py publishes {"comment": stored}
    socket.emit('comment:new', { comment: { id: 'c1', body: 'hi' } });
    // publish_comment_new helper publishes the row directly
    socket.emit('comment:new', { id: 'c2', body: 'also hi' });

    expect(scope.onComment).toHaveBeenNthCalledWith(1, {
      id: 'c1',
      body: 'hi',
    });
    expect(scope.onComment).toHaveBeenNthCalledWith(2, {
      id: 'c2',
      body: 'also hi',
    });
  });

  it('dispatches review:new only when it looks like a review', () => {
    const scope = makeScope();
    source().connect('repo-1', scope);
    const socket = FakeSocket.instances[0];

    socket.emit('review:new', { pr_number: 7, risk_score: 42 });
    expect(scope.onReview).toHaveBeenCalledTimes(1);

    socket.emit('review:new', { message: 'no pr_number here' });
    expect(scope.onReview).toHaveBeenCalledTimes(1);
  });

  it('ignores unparsable frames and unknown event types', () => {
    const scope = makeScope();
    source().connect('repo-1', scope);
    const socket = FakeSocket.instances[0];

    expect(() => socket.emitRaw('{not json')).not.toThrow();
    expect(() => socket.emit('presence:roster', { user_ids: ['a'] })).not.toThrow();
    expect(() => socket.emit('error', { message: 'nope' })).not.toThrow();
    expect(scope.onComment).not.toHaveBeenCalled();
  });

  it('reconnects with backoff after an unexpected close', () => {
    source().connect('repo-1', makeScope());
    expect(FakeSocket.instances).toHaveLength(1);

    FakeSocket.instances[0].drop();
    // Not immediate: the first retry waits out the backoff.
    expect(FakeSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('grows the backoff across repeated failures', () => {
    source().connect('repo-1', makeScope());

    FakeSocket.instances[0].drop();
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);

    // Second retry must wait longer than 1s.
    FakeSocket.instances[1].drop();
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.instances).toHaveLength(3);
  });

  it('stops retrying once the component unmounts', () => {
    const dispose = source().connect('repo-1', makeScope());
    FakeSocket.instances[0].drop();
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);

    dispose();
    FakeSocket.instances[1].drop();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('closes the socket on dispose with a normal code', () => {
    const dispose = source().connect('repo-1', makeScope());
    const socket = FakeSocket.instances[0];

    dispose();

    expect(socket.closed?.code).toBe(1000);
    expect(socket.onclose).toBeNull();
  });

  it('a close caused by teardown does not schedule a reconnect', () => {
    const dispose = source().connect('repo-1', makeScope());
    const socket = FakeSocket.instances[0];

    dispose();
    // Simulate a late close frame arriving after the handlers were detached.
    socket.onclose?.({ code: 1006 });

    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('closes the socket itself if presence:join is never sent', () => {
    source().connect('repo-1', makeScope());
    const socket = FakeSocket.instances[0];

    // Never open, so onopen never fires and the join is never sent.
    vi.advanceTimersByTime(10_000);

    expect(socket.closed?.code).toBe(4408);
  });

  it('recovers from a socket constructor that throws', () => {
    let attempts = 0;
    const flaky = createWebSocketSource({
      apiBase: 'https://api.example.com',
      getToken: () => 'jwt',
      userId: 'u',
      createSocket: (url) => {
        attempts += 1;
        if (attempts === 1) throw new Error('SecurityError: bad url');
        return new FakeSocket(url);
      },
    });

    flaky.connect('repo-1', makeScope());
    expect(FakeSocket.instances).toHaveLength(0);

    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});