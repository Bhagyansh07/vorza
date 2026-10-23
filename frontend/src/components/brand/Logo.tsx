import { cn } from '@/lib/utils';

interface MarkProps {
  className?: string;
}

/**
 * Modern topological Vorza emblem: A dynamic geometric V vertex mark with
 * interconnected graph nodes, luminous cyber-lime gradient, and depth styling.
 */
export function LogoMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('h-7 w-7', className)}
    >
      <defs>
        <linearGradient id="vorza-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A8F25A" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="vorza-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Modern Squircle Badge */}
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8.5"
        fill="url(#vorza-logo-bg)"
        stroke="url(#vorza-logo-grad)"
        strokeWidth="1.2"
        strokeOpacity="0.45"
      />

      {/* Cyber Grid Crosshairs in Background */}
      <path
        d="M 16 5 L 16 27 M 5 16 L 27 16"
        stroke="#ffffff"
        strokeWidth="0.8"
        strokeDasharray="1.5 2.5"
        strokeOpacity="0.08"
      />

      {/* Interconnecting Topological Edges */}
      <path
        d="M 8.5 10 L 16 23.5 L 23.5 10"
        stroke="url(#vorza-logo-grad)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M 8.5 10 L 16 14.5 L 23.5 10"
        stroke="url(#vorza-logo-grad)"
        strokeWidth="1.5"
        strokeOpacity="0.55"
        strokeDasharray="2 2"
      />

      <line
        x1="16"
        y1="14.5"
        x2="16"
        y2="23.5"
        stroke="url(#vorza-logo-grad)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Luminous Vertex Nodes */}
      {/* Top Left Node */}
      <circle cx="8.5" cy="10" r="2.8" fill="#A8F25A" />
      <circle cx="8.5" cy="10" r="1.1" fill="#0B1506" />

      {/* Top Right Node */}
      <circle cx="23.5" cy="10" r="2.8" fill="#10B981" />
      <circle cx="23.5" cy="10" r="1.1" fill="#0B1506" />

      {/* Center Heart Node */}
      <circle cx="16" cy="14.5" r="2" fill="#A8F25A" opacity="0.9" />

      {/* Apex Bottom Node */}
      <circle cx="16" cy="23.5" r="3.2" fill="#A8F25A" />
      <circle cx="16" cy="23.5" r="1.3" fill="#0B1506" />
    </svg>
  );
}

interface LogoProps extends MarkProps {
  /** Size class for the wordmark text, e.g. `text-base`. */
  wordClassName?: string;
  /** Accessible label. Defaults to "Vorza". */
  label?: string;
}

/**
 * Horizontal lockup: mark plus wordmark.
 */
export function Logo({ className, wordClassName, label = 'Vorza' }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 group select-none', className)}>
      <LogoMark className="h-7 w-7 shrink-0 transition-transform duration-300 group-hover:scale-105" />
      <span
        className={cn(
          'text-[17px] font-bold tracking-tight text-foreground flex items-center',
          wordClassName,
        )}
      >
        <span>{label}</span>
        <span className="text-primary font-black ml-0.5 animate-pulse">.</span>
      </span>
    </span>
  );
}
