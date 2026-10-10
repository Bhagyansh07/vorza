/**
 * Vorpy, the Vorza mascot.
 *
 * It is the exact avatar exported from Bible Strong Studio for Vorza
 * (`assets/vorpy.avatar.json`: indigo `#2f27ce` body, `#e7e9ff` eyes, the eight
 * animations sleeping / waking / idle / thinking / working / excited / drowsy /
 * celebrate), rendered by the studio's own runtime.
 *
 * Runtime: `@bible-strong/avatar-core` (AGPL-3.0-only), the framework-independent
 * renderer from https://github.com/smontlouis/bible-strong-avatar-lab. Vorza uses
 * core rather than the `@bible-strong/avatar-react` wrapper because the wrapper
 * declares a React 19 peer and this app is on React 18; core only needs the DOM.
 * Anything built on `avatar-core` carries the AGPL licence and the upstream
 * credit above.
 *
 * Loading: this module is pulled in with `React.lazy` from the landing route, so
 * the runtime, its geometry code and its schema validator stay out of first
 * paint. `scripts/check-bundle-size.mjs` measures only the scripts `index.html`
 * references, which is the honest first-paint cost.
 *
 * Honest defaults: the mascot idles. When the visitor prefers reduced motion
 * (`prefers-reduced-motion: reduce`) -- or there is no `matchMedia`/RAF at all --
 * it paints one static neutral frame and never starts the animation loop.
 */
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import {
  MAX_BODY_NODES,
  advanceAvatarPlayback,
  createAvatarPlaybackState,
  playAvatarAnimation,
  renderAvatarDefinition,
  renderAvatarFrame,
  validateAvatarDefinition,
  type AnimationKey,
  type AvatarDefinition,
  type AvatarPlaybackState,
  type AvatarRuntimeEnvironment,
  type AvatarScene,
} from '@bible-strong/avatar-core';

// `?raw` keeps the committed export byte-for-byte as the studio wrote it and
// avoids a repo-wide `resolveJsonModule` change; it is parsed once, below.
import vorpyRaw from '../assets/vorpy.avatar.json?raw';

/** Body-node path slots in the studio's SVG (its renderer uses nodes + 2). */
const BODY_NODE_SLOTS = MAX_BODY_NODES + 2;

const DEFAULT_ANIMATION: AnimationKey = 'idle';

/**
 * Validate the export once at module load with the runtime's own validator. A
 * failure throws here instead of mounting a broken mascot; `vorpy.avatar.test.ts`
 * runs the same validator in CI on the committed file.
 */
const DEFINITION: Readonly<AvatarDefinition> = (() => {
  const result = validateAvatarDefinition(JSON.parse(vorpyRaw));
  if (!result.ok) {
    const first = result.errors[0];
    throw new Error(
      `Invalid Vorpy avatar definition${first ? ` at ${first.path}` : ''}: ${first?.message ?? 'unknown error'}`,
    );
  }
  return result.value;
})();

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function playbackEnvironment(): AvatarRuntimeEnvironment {
  return { random: Math.random, reduceMotion: prefersReducedMotion() };
}

function initialPlayback(animation: AnimationKey): AvatarPlaybackState {
  const started = playAvatarAnimation(DEFINITION, animation, performance.now());
  return started.ok
    ? started.value
    : { ...createAvatarPlaybackState(), activeExpression: 'neutral' };
}

export type VorpyMascotProps = {
  /** Rendered square size in CSS pixels. */
  size?: number;
  /** Which exported animation to idle on. Defaults to `idle`. */
  animation?: AnimationKey;
};

export function VorpyMascot({
  size = 112,
  animation = DEFAULT_ANIMATION,
}: VorpyMascotProps) {
  const reduceMotion = useMemo(prefersReducedMotion, []);
  const canAnimate =
    !reduceMotion &&
    typeof requestAnimationFrame === 'function' &&
    typeof cancelAnimationFrame === 'function';

  const clipId = useId().replaceAll(':', '');
  const stateRef = useRef<AvatarPlaybackState>(initialPlayback(animation));

  const headRef = useRef<SVGPathElement | null>(null);
  const clipRef = useRef<SVGPathElement | null>(null);
  const leftRef = useRef<SVGPathElement | null>(null);
  const rightRef = useRef<SVGPathElement | null>(null);
  const backRefs = useRef<Array<SVGPathElement | null>>([]);
  const frontRefs = useRef<Array<SVGPathElement | null>>([]);

  // The frame the SVG ships with. Reduced motion gets the neutral pose, not a
  // random animation frame, so the static rendering is deterministic.
  const firstScene = useMemo<AvatarScene>(
    () =>
      canAnimate
        ? renderAvatarFrame(
            DEFINITION,
            stateRef.current,
            performance.now(),
            playbackEnvironment(),
          )
        : renderAvatarDefinition(DEFINITION, 'neutral'),
    [canAnimate],
  );

  const paint = useCallback((scene: AvatarScene) => {
    const { geometry, colors } = scene;
    for (const el of [headRef.current, clipRef.current]) {
      if (el) {
        el.setAttribute('d', geometry.headPath);
        el.setAttribute('fill', colors.body);
      }
    }
    if (leftRef.current) {
      leftRef.current.setAttribute('d', geometry.leftPath);
      leftRef.current.setAttribute('fill', colors.eyes);
      leftRef.current.setAttribute('opacity', geometry.leftVisible ? '1' : '0');
    }
    if (rightRef.current) {
      rightRef.current.setAttribute('d', geometry.rightPath);
      rightRef.current.setAttribute('fill', colors.eyes);
      rightRef.current.setAttribute('opacity', geometry.rightVisible ? '1' : '0');
    }
    backRefs.current.forEach((el, i) => {
      if (el) {
        el.setAttribute('d', geometry.backPaths[i] ?? '');
        el.setAttribute('fill', colors.body);
      }
    });
    frontRefs.current.forEach((el, i) => {
      if (el) {
        el.setAttribute('d', geometry.frontPaths[i] ?? '');
        el.setAttribute('fill', colors.body);
      }
    });
  }, []);

  useEffect(() => {
    if (!canAnimate || stateRef.current.status !== 'playing') return;

    let raf = 0;
    const tick = (now: number) => {
      const current = stateRef.current;
      const environment = playbackEnvironment();
      const next = advanceAvatarPlayback(DEFINITION, current, now, environment);
      stateRef.current = next;
      // State changes drive the controller; the SVG itself is updated
      // imperatively so a busy frame does not cost a React render.
      paint(renderAvatarFrame(DEFINITION, next, now, environment));
      if (next.status === 'playing') raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canAnimate, paint]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-6 right-6 z-30 hidden select-none md:block"
      style={{ width: size, height: size }}
    >
      <svg
        className="h-full w-full drop-shadow-md"
        viewBox="-150 -150 300 300"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <path ref={clipRef} d={firstScene.geometry.headPath} />
          </clipPath>
        </defs>
        {Array.from({ length: BODY_NODE_SLOTS }, (_, i) => (
          <path
            key={`back-${i}`}
            ref={(el) => {
              backRefs.current[i] = el;
            }}
            d={firstScene.geometry.backPaths[i] ?? ''}
            fill={firstScene.colors.body}
          />
        ))}
        <path
          ref={headRef}
          d={firstScene.geometry.headPath}
          fill={firstScene.colors.body}
        />
        <g clipPath={`url(#${clipId})`} fill={firstScene.colors.eyes}>
          <path
            ref={leftRef}
            d={firstScene.geometry.leftPath}
            opacity={firstScene.geometry.leftVisible ? 1 : 0}
          />
          <path
            ref={rightRef}
            d={firstScene.geometry.rightPath}
            opacity={firstScene.geometry.rightVisible ? 1 : 0}
          />
        </g>
        {Array.from({ length: BODY_NODE_SLOTS }, (_, i) => (
          <path
            key={`front-${i}`}
            ref={(el) => {
              frontRefs.current[i] = el;
            }}
            d={firstScene.geometry.frontPaths[i] ?? ''}
            fill={firstScene.colors.body}
          />
        ))}
      </svg>
    </div>
  );
}
