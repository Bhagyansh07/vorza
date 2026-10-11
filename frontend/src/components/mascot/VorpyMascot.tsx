/**
 * Vorpy, the Vorza mascot.
 *
 * A round, friendly ball in Strobi's palette: a periwinkle-blue body
 * (`#5b7fe5`) with two big, close-set, near-black eyes (`#111316`) and a face
 * that is eyes only. It is Vorza's own artwork -- one circle and a pair of eyes
 * -- animated entirely with CSS (the `vorpy-*` rules in `index.css`): it
 * breathes at rest, blinks, looks around, dozes off and bounces when it is
 * happy. There is no third-party avatar library and no exported definition
 * file, so the character carries no licence beyond this repository's own.
 *
 * The moods are the guided tour's vocabulary: `sleeping`, `waking`, `idle`,
 * `thinking`, `working`, `excited`, `drowsy` and `celebrate`. Most moods act by
 * squashing, lifting or widening the same eye shape; `celebrate` swaps in a pair
 * of happy arcs. Every mood is a loop whose first and last frame are its still
 * pose, so collapsing motion for `prefers-reduced-motion` (which the app does
 * globally) lands on a clean frame rather than a half-finished gesture.
 *
 * Loading: routes only reach this through `LazyGuidedTour`, so the mascot and
 * the tour engine stay in a chunk that loads after first paint. See
 * `mascot-boundary.test.ts`.
 */
import { useId, type CSSProperties } from 'react';

export type AnimationKey =
  | 'sleeping'
  | 'waking'
  | 'idle'
  | 'thinking'
  | 'working'
  | 'excited'
  | 'drowsy'
  | 'celebrate';

const DEFAULT_ANIMATION: AnimationKey = 'idle';

/** The ball, drawn in a 300x300 box centred on (0, 0). */
const BODY_RADIUS = 118;

/** Open eyes: big, close-set and tall, the shape that reads cute. */
const EYE_LEFT = { cx: -26, cy: -4, rx: 12, ry: 22 };
const EYE_RIGHT = { cx: 26, cy: -4, rx: 12, ry: 22 };

/** Happy eyes: an upward arc each, the closed-smile look for `celebrate`. */
const HAPPY_LEFT = 'M -40 -4 Q -26 -25 -12 -4';
const HAPPY_RIGHT = 'M 12 -4 Q 26 -25 40 -4';

/** A four-point sparkle centred on (x, y), used for the excited moods. */
function sparkle(x: number, y: number, r: number): string {
  return `M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z`;
}

const SPARKLES = [
  sparkle(-98, -80, 13),
  sparkle(102, -54, 10),
  sparkle(74, -120, 8),
];

export type VorpyMascotProps = {
  /** Rendered square size in CSS pixels. */
  size?: number;
  /** Which mood to play. Defaults to `idle`. */
  animation?: AnimationKey;
  /**
   * Inline box instead of the fixed bottom-right badge, for placing Vorpy
   * inside the tour panel. Defaults to `false`.
   */
  embedded?: boolean;
};

export function VorpyMascot({
  size = 112,
  animation = DEFAULT_ANIMATION,
  embedded = false,
}: VorpyMascotProps) {
  const uid = useId().replace(/:/g, '');
  const glossId = `vorpy-gloss-${uid}`;
  const shadeId = `vorpy-shade-${uid}`;
  const clipId = `vorpy-clip-${uid}`;

  return (
    <div
      aria-hidden="true"
      // Floating: shown at every width (never `hidden md:block`): an 84px badge
      // on phones, the full `size` from `md` up, decorative and non-interactive
      // so it never blocks a tap. Embedded: a plain inline box the tour places
      // inside its panel without the fixed positioning.
      className={[
        embedded
          ? 'relative shrink-0 select-none'
          : 'pointer-events-none fixed bottom-5 right-5 z-30 h-[84px] w-[84px] select-none md:bottom-6 md:right-6 md:h-[var(--vorpy-size)] md:w-[var(--vorpy-size)]',
        'vorpy',
        `vorpy--${animation}`,
      ].join(' ')}
      style={
        (embedded
          ? { width: size, height: size }
          : { '--vorpy-size': `${size}px` }) as CSSProperties
      }
    >
      <svg
        key={animation}
        className="h-full w-full drop-shadow-md"
        viewBox="-150 -150 300 300"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={glossId} cx="0.34" cy="0.26" r="0.72">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={shadeId} x1="0" y1="0.35" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b0820" stopOpacity="0" />
            <stop offset="100%" stopColor="#0b0820" stopOpacity="0.2" />
          </linearGradient>
          <clipPath id={clipId}>
            <circle r={BODY_RADIUS} />
          </clipPath>
        </defs>

        <g className="vorpy-body">
          <circle r={BODY_RADIUS} />
          <g clipPath={`url(#${clipId})`}>
            <rect x="-120" y="-150" width="240" height="300" fill={`url(#${shadeId})`} />
            <ellipse cx="-36" cy="-46" rx="82" ry="68" fill={`url(#${glossId})`} />
          </g>
        </g>

        <g className="vorpy-eyes vorpy-eyes--open">
          <ellipse {...EYE_LEFT} />
          <ellipse {...EYE_RIGHT} />
        </g>
        <g
          className="vorpy-eyes vorpy-eyes--happy"
          strokeWidth="9"
          strokeLinecap="round"
        >
          <path d={HAPPY_LEFT} />
          <path d={HAPPY_RIGHT} />
        </g>

        <g className="vorpy-sparkles">
          {SPARKLES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
    </div>
  );
}
