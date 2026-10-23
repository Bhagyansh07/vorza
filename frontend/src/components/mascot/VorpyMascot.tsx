/**
 * Vorpy, the luxury interactive Vorza mascot & intelligent codebase guide.
 *
 * Designed following the 23-mood character specification and starter templates:
 * - Starters: Strobi, Freddy, Citrus, Nova, Sunee, Kirby, Cloudee, Cubee, Onee
 * - 23 ready animations: sleeping, waking, idle, listening, thinking, searching,
 *   working, excited, bored, suspicious, angry, drowsy, happy, curious,
 *   confused, surprised, proud, shy, sad, laughing, scared, playful, celebrate.
 *
 * Implemented with pure SVG and high-performance CSS animations. Features 3D
 * specular glass highlights, ambient depth gradients, and expressive pupil
 * physics that feel truly alive.
 */
import { useId, type CSSProperties } from 'react';

export type AnimationKey =
  | 'sleeping'
  | 'waking'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'searching'
  | 'working'
  | 'excited'
  | 'bored'
  | 'suspicious'
  | 'angry'
  | 'drowsy'
  | 'happy'
  | 'curious'
  | 'confused'
  | 'surprised'
  | 'proud'
  | 'shy'
  | 'sad'
  | 'laughing'
  | 'scared'
  | 'playful'
  | 'celebrate';

export type StarterKey =
  | 'strobi'
  | 'freddy'
  | 'citrus'
  | 'nova'
  | 'sunee'
  | 'kirby'
  | 'cloudee'
  | 'cubee'
  | 'grok'
  | 'onee';

const DEFAULT_ANIMATION: AnimationKey = 'idle';

/** The ball, drawn in a 300x300 box centred on (0, 0). */
const BODY_RADIUS = 118;

/** Open eyes: big, close-set and tall, the shape that reads cute and premium. */
const EYE_LEFT = { cx: -28, cy: -6, rx: 13, ry: 23 };
const EYE_RIGHT = { cx: 28, cy: -6, rx: 13, ry: 23 };

/** Happy eyes: an upward arc each, the closed-smile look for celebrate and happy moods. */
const HAPPY_LEFT = 'M -42 -4 Q -28 -26 -14 -4';
const HAPPY_RIGHT = 'M 14 -4 Q 28 -26 42 -4';

/** Laughing eyes: squinted happy curved crescents. */
const LAUGH_LEFT = 'M -42 -2 Q -28 -22 -14 -2';
const LAUGH_RIGHT = 'M 14 -2 Q 28 -22 42 -2';

/** Sleeping eyes: gentle downward resting curves. */
const SLEEP_LEFT = 'M -40 -8 Q -28 6 -16 -8';
const SLEEP_RIGHT = 'M 16 -8 Q 28 6 40 -8';

/** Four-point sparkle centred on (x, y). */
function sparkle(x: number, y: number, r: number): string {
  return `M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z`;
}

const SPARKLES = [
  sparkle(-100, -82, 14),
  sparkle(104, -58, 11),
  sparkle(76, -122, 9),
  sparkle(-74, 96, 8),
];

export interface VorpyMascotProps {
  /** Rendered square size in CSS pixels. */
  size?: number;
  /** Which mood to play from the 23 ready animations. Defaults to `idle`. */
  animation?: AnimationKey;
  /** Starter character style template (e.g. strobi, nova, sunee, kirby, cloudee). */
  starter?: StarterKey;
  /** Inline box instead of fixed badge. Defaults to `false`. */
  embedded?: boolean;
  /** Interactive callback when clicked. */
  onClick?: () => void;
  className?: string;
}

export function VorpyMascot({
  size = 112,
  animation = DEFAULT_ANIMATION,
  starter = 'strobi',
  embedded = false,
  onClick,
  className = '',
}: VorpyMascotProps) {
  const rawId = useId().replace(/:/g, '');
  const glossId = `vorpy-gloss-${rawId}`;
  const shadeId = `vorpy-shade-${rawId}`;
  const clipId = `vorpy-clip-${rawId}`;
  const rimId = `vorpy-rim-${rawId}`;
  const eyeGlintId = `vorpy-glint-${rawId}`;

  // Mood flags
  const isHappy = animation === 'happy' || animation === 'celebrate' || animation === 'proud';
  const isLaughing = animation === 'laughing' || animation === 'playful';
  const isSleeping = animation === 'sleeping';
  const isDrowsy = animation === 'drowsy';
  const isSurprised = animation === 'surprised' || animation === 'scared';
  const isThinking = animation === 'thinking' || animation === 'curious';
  const isConfused = animation === 'confused' || animation === 'suspicious';
  const isAngry = animation === 'angry';
  const isShy = animation === 'shy';
  const isExcited = animation === 'excited' || animation === 'celebrate';

  return (
    <div
      aria-hidden="true"
      onClick={onClick}
      className={[
        embedded
          ? 'relative shrink-0 select-none'
          : 'pointer-events-auto fixed bottom-5 right-5 z-30 h-[88px] w-[88px] select-none md:bottom-6 md:right-6 md:h-[var(--vorpy-size)] md:w-[var(--vorpy-size)] cursor-pointer transition-transform hover:scale-105 active:scale-95',
        'vorpy',
        `vorpy--${animation}`,
        `vorpy-starter--${starter}`,
        className,
      ].join(' ')}
      style={
        (embedded
          ? { width: size, height: size }
          : { '--vorpy-size': `${size}px` }) as CSSProperties
      }
    >
      <svg
        key={`${animation}-${starter}`}
        className="h-full w-full"
        style={{
          filter: 'drop-shadow(0 0 16px rgba(168, 242, 90, 0.65)) drop-shadow(0 0 32px rgba(168, 242, 90, 0.35))',
        }}
        viewBox="-150 -150 300 300"
        aria-hidden="true"
      >
        <defs>
          {/* Specular gloss highlight for luxury 3D glass look */}
          <radialGradient id={glossId} cx="0.32" cy="0.22" r="0.65">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Depth ambient shadow */}
          <linearGradient id={shadeId} x1="0" y1="0.2" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a081a" stopOpacity="0" />
            <stop offset="75%" stopColor="#0a081a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0a081a" stopOpacity="0.4" />
          </linearGradient>

          {/* Luminous rim light reflection */}
          <radialGradient id={rimId} cx="0.5" cy="0.88" r="0.55">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Eye specular glint */}
          <radialGradient id={eyeGlintId} cx="0.35" cy="0.3" r="0.4">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
          </radialGradient>

          <clipPath id={clipId}>
            <circle r={BODY_RADIUS} />
          </clipPath>
        </defs>

        {/* Starter Shape Enhancements (Sunee dots, Cloudee puffs, Freddy ears, Kirby blush) */}
        {starter === 'sunee' && (
          <g className="vorpy-starter-sunee opacity-75" fill="var(--vorpy-body)">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <circle
                key={deg}
                cx={Math.cos((deg * Math.PI) / 180) * 135}
                cy={Math.sin((deg * Math.PI) / 180) * 135}
                r="11"
              />
            ))}
          </g>
        )}

        {starter === 'cloudee' && (
          <g className="vorpy-starter-cloudee opacity-85" fill="var(--vorpy-body)">
            <circle cx="-95" cy="55" r="42" />
            <circle cx="95" cy="55" r="42" />
            <circle cx="-55" cy="-85" r="38" />
            <circle cx="55" cy="-85" r="38" />
          </g>
        )}

        {starter === 'freddy' && (
          <g className="vorpy-starter-freddy" fill="var(--vorpy-body)">
            <ellipse cx="-82" cy="-98" rx="28" ry="34" transform="rotate(-20 -82 -98)" />
            <ellipse cx="82" cy="-98" rx="28" ry="34" transform="rotate(20 82 -98)" />
          </g>
        )}

        {starter === 'citrus' && (
          <g className="vorpy-starter-citrus" fill="var(--vorpy-body)">
            <path d="M 0 -138 C -22 -100 -30 -70 0 -50 C 30 -70 22 -100 0 -138 Z" opacity="0.9" />
          </g>
        )}

        {starter === 'grok' && (
          <g className="vorpy-starter-grok" stroke="#00f2ff" strokeWidth="3" fill="none" opacity="0.85">
            <ellipse cx="0" cy="0" rx="138" ry="48" transform="rotate(-25 0 0)" />
          </g>
        )}

        {starter === 'cubee' && (
          <g className="vorpy-starter-cubee" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" fill="none">
            <rect x="-95" y="-95" width="190" height="190" rx="28" />
          </g>
        )}

        {/* Cute Glowing Antenna (from Saksham Gupta's reel and user screenshots) */}
        <g className="vorpy-antenna">
          <path
            d="M 0 -114 Q 4 -130 8 -142"
            stroke="var(--vorpy-body)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Outer glowing halo */}
          <circle cx="8" cy="-142" r="14" fill="var(--vorpy-body)" opacity="0.4" className="animate-pulse" />
          {/* Core glowing bulb */}
          <circle cx="8" cy="-142" r="6" fill="#ffffff" />
        </g>

        {/* Cute Little Arms (pointing / waving as in screenshots) */}
        <g className="vorpy-arms" fill="var(--vorpy-body)">
          {/* Left Arm: points horizontally to the left toward buttons! */}
          {isExcited ? (
            <path d="M -85 -10 Q -115 -40 -125 -65 Q -128 -72 -120 -70 Q -105 -50 -75 -2 Z" />
          ) : (
            <path d="M -88 12 Q -125 15 -142 8 Q -148 7 -144 18 Q -130 25 -82 28 Z" />
          )}

          {/* Right Arm: waving or resting */}
          {isExcited ? (
            <path d="M 85 -10 Q 115 -40 125 -65 Q 128 -72 120 -70 Q 105 -50 75 -2 Z" />
          ) : (
            <path d="M 88 16 Q 112 30 124 45 Q 130 52 122 55 Q 108 48 82 28 Z" />
          )}
        </g>

        {/* The Ball Body (required by tests: .vorpy-body circle) */}
        <g className="vorpy-body">
          <circle r={BODY_RADIUS} />
          <g clipPath={`url(#${clipId})`}>
            {/* Ambient depth shadow */}
            <rect x="-140" y="-150" width="280" height="300" fill={`url(#${shadeId})`} />
            {/* Specular gloss dome */}
            <ellipse cx="-38" cy="-52" rx="90" ry="76" fill={`url(#${glossId})`} />
            {/* Subtle bottom rim reflection */}
            <ellipse cx="0" cy="110" rx="100" ry="32" fill={`url(#${rimId})`} />
          </g>
        </g>

        {/* Rosy blush cheeks for shy, happy, laughing, kirby */}
        {(isShy || isHappy || isLaughing || starter === 'kirby') && (
          <g className="vorpy-blush transition-opacity duration-300">
            <ellipse cx="-64" cy="22" rx="15" ry="8" fill="#ff769e" opacity="0.48" />
            <ellipse cx="64" cy="22" rx="15" ry="8" fill="#ff769e" opacity="0.48" />
          </g>
        )}

        {/* Angry blush flush */}
        {isAngry && (
          <g className="vorpy-angry-flush">
            <circle r={BODY_RADIUS} fill="#ff3b30" opacity="0.18" clipPath={`url(#${clipId})`} />
          </g>
        )}

        {/* Standard Open Eyes (required by tests: .vorpy-eyes--open ellipse length 2) */}
        <g
          className="vorpy-eyes vorpy-eyes--open"
          style={{
            opacity: isHappy || isLaughing || isSleeping ? 0 : 1,
            transform: isSurprised
              ? 'scale(1.22)'
              : isThinking
                ? 'translate(6px, -7px)'
                : isConfused
                  ? 'rotate(-8deg)'
                  : isDrowsy
                    ? 'scaleY(0.4) translateY(12px)'
                    : undefined,
          }}
        >
          <ellipse {...EYE_LEFT} />
          <ellipse {...EYE_RIGHT} />

          {/* Pupil Specular Glints for extra luxury life */}
          <circle cx={EYE_LEFT.cx - 3} cy={EYE_LEFT.cy - 7} r="4.5" fill="#ffffff" opacity="0.95" />
          <circle cx={EYE_RIGHT.cx - 3} cy={EYE_RIGHT.cy - 7} r="4.5" fill="#ffffff" opacity="0.95" />
          <circle cx={EYE_LEFT.cx + 4} cy={EYE_LEFT.cy + 5} r="2.2" fill="#ffffff" opacity="0.8" />
          <circle cx={EYE_RIGHT.cx + 4} cy={EYE_RIGHT.cy + 5} r="2.2" fill="#ffffff" opacity="0.8" />
        </g>

        {/* Expressive Mouth (matching screenshots: small circle or smile or smirk) */}
        <g className="vorpy-mouth">
          {isSurprised || isThinking ? (
            <ellipse cx="0" cy="24" rx="6" ry="8" fill="var(--vorpy-eye)" />
          ) : isHappy || isLaughing || isExcited ? (
            <path d="M -10 18 Q 0 30 10 18" stroke="var(--vorpy-eye)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          ) : isConfused ? (
            <path d="M -8 24 Q 0 20 8 26" stroke="var(--vorpy-eye)" strokeWidth="4" strokeLinecap="round" fill="none" />
          ) : (
            <ellipse cx="0" cy="22" rx="4.5" ry="5.5" fill="var(--vorpy-eye)" />
          )}
        </g>

        {/* Happy / Celebrate Closed-Smile Eyes (required by tests: .vorpy-eyes--happy) */}
        <g
          className="vorpy-eyes vorpy-eyes--happy"
          strokeWidth="9"
          strokeLinecap="round"
          style={{
            opacity: isHappy ? 1 : 0,
          }}
        >
          <path d={HAPPY_LEFT} />
          <path d={HAPPY_RIGHT} />
        </g>

        {/* Laughing / Playful Eyes */}
        {isLaughing && (
          <g
            className="vorpy-eyes-laugh"
            fill="none"
            stroke="var(--vorpy-eye)"
            strokeWidth="9"
            strokeLinecap="round"
          >
            <path d={LAUGH_LEFT} />
            <path d={LAUGH_RIGHT} />
          </g>
        )}

        {/* Sleeping Eyes */}
        {isSleeping && (
          <g
            className="vorpy-eyes-sleep"
            fill="none"
            stroke="var(--vorpy-eye)"
            strokeWidth="8"
            strokeLinecap="round"
          >
            <path d={SLEEP_LEFT} />
            <path d={SLEEP_RIGHT} />
          </g>
        )}

        {/* Mood-Specific Ambient Accessories */}
        {/* Listening Soundwaves */}
        {animation === 'listening' && (
          <g
            className="vorpy-listening-waves animate-pulse"
            fill="none"
            stroke="var(--vorpy-body)"
            strokeWidth="4"
            strokeLinecap="round"
          >
            <path d="M 125 -30 A 40 40 0 0 1 125 30" opacity="0.7" />
            <path d="M 138 -45 A 60 60 0 0 1 138 45" opacity="0.4" />
          </g>
        )}

        {/* Searching Magnifying Inspect Spark */}
        {animation === 'searching' && (
          <g className="vorpy-searching-sparkle" fill="none" stroke="var(--vorpy-body)" strokeWidth="4">
            <circle cx="85" cy="-75" r="16" />
            <line x1="97" y1="-63" x2="114" y2="-46" strokeWidth="5" strokeLinecap="round" />
          </g>
        )}

        {/* Question Dot for Curious / Confused */}
        {(animation === 'curious' || animation === 'confused') && (
          <g className="vorpy-curious-mark" fill="var(--vorpy-body)">
            <text
              x="72"
              y="-72"
              fontSize="34"
              fontWeight="bold"
              fontFamily="sans-serif"
              opacity="0.85"
            >
              ?
            </text>
          </g>
        )}

        {/* Sleeping Zzz's */}
        {isSleeping && (
          <g className="vorpy-zzz" fill="var(--vorpy-body)" opacity="0.8">
            <text x="64" y="-88" fontSize="22" fontWeight="bold" fontFamily="sans-serif">
              z
            </text>
            <text x="88" y="-108" fontSize="28" fontWeight="bold" fontFamily="sans-serif">
              Z
            </text>
          </g>
        )}

        {/* Sparkles for Excited & Celebrate */}
        <g
          className="vorpy-sparkles"
          style={{
            opacity: isExcited ? 1 : 0,
          }}
        >
          {SPARKLES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
    </div>
  );
}
