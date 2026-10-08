import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// jsdom has no IntersectionObserver. Two in-view hooks matter:
//   - Metrics' own useInView treats a missing IO as "in view" for SSR/tests
//   - motion's useInView (NumberTicker on the dashboard) needs an IO that
//     exists and fires intersection callbacks
// A stub that reports every observed element as intersecting satisfies both:
// animations reliably start, and the async callback keeps renders stable.
class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    queueMicrotask(() => {
      this.callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 1,
            target,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: performance.now(),
          } as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver
      );
    });
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeAll(() => {
  globalThis.IntersectionObserver ??= IntersectionObserverStub as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  cleanup();
});