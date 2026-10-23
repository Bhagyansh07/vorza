import { cn } from '@/lib/utils';

interface MarkProps {
  className?: string;
}

/**
 * Ultra-luxury Vorza Prism Vertex logo:
 * 3D isometric faceted V-crystal with topological neural graph vertices,
 * neon lime/emerald/cyan laser refractions, dark obsidian metallic chassis,
 * and specular glass highlights.
 */
export function LogoMark({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('h-7 w-7 filter drop-shadow-[0_2px_10px_rgba(168,242,90,0.25)]', className)}
    >
      <defs>
        {/* Obsidian Glass Foundation */}
        <linearGradient id="vz-frame-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#0f172a" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#020617" stopOpacity="1" />
        </linearGradient>

        {/* Specular Rim */}
        <linearGradient id="vz-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A8F25A" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.7" />
        </linearGradient>

        {/* Left Facet: Lime Glow */}
        <linearGradient id="vz-facet-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4FF70" />
          <stop offset="50%" stopColor="#A8F25A" />
          <stop offset="100%" stopColor="#4ADE80" />
        </linearGradient>

        {/* Right Facet: Cyber Emerald-Cyan */}
        <linearGradient id="vz-facet-right" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="60%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        {/* Central Core Glow */}
        <radialGradient id="vz-core-flare" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#A8F25A" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#A8F25A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Obsidian Squircle Vessel */}
      <rect
        x="1.5"
        y="1.5"
        width="33"
        height="33"
        rx="9.5"
        fill="url(#vz-frame-bg)"
        stroke="url(#vz-rim-grad)"
        strokeWidth="1.25"
      />

      {/* Subtle Inner Isometric Grid Mesh */}
      <path
        d="M 18 3 L 18 33 M 3 18 L 33 18"
        stroke="#ffffff"
        strokeWidth="0.75"
        strokeDasharray="2 3"
        strokeOpacity="0.07"
      />

      {/* Ambient Depth Flare Behind V */}
      <circle cx="18" cy="18" r="9" fill="url(#vz-core-flare)" />

      {/* Left Wing Facet (Folded 3D Ribbon) */}
      <path
        d="M 7.5 9.5 L 18 28.5 L 18 16.5 L 11 9.5 Z"
        fill="url(#vz-facet-left)"
        fillOpacity="0.95"
      />

      {/* Right Wing Facet (Folded 3D Ribbon) */}
      <path
        d="M 28.5 9.5 L 18 28.5 L 18 16.5 L 25 9.5 Z"
        fill="url(#vz-facet-right)"
        fillOpacity="0.9"
      />

      {/* Top Diamond Bridge / Refraction Core */}
      <polygon
        points="18,12 21.5,16.5 18,21 14.5,16.5"
        fill="#ffffff"
        fillOpacity="0.28"
        stroke="#A8F25A"
        strokeWidth="0.75"
        strokeOpacity="0.8"
      />

      {/* Topological Neural Edge Overlay */}
      <line
        x1="7.5"
        y1="9.5"
        x2="28.5"
        y2="9.5"
        stroke="#ffffff"
        strokeWidth="1"
        strokeOpacity="0.25"
        strokeDasharray="2 2"
      />

      {/* Micro Vertex Spheres */}
      {/* Wingtip Left */}
      <circle cx="7.5" cy="9.5" r="2.75" fill="#D4FF70" />
      <circle cx="7.5" cy="9.5" r="1.1" fill="#0B1506" />

      {/* Wingtip Right */}
      <circle cx="28.5" cy="9.5" r="2.75" fill="#38BDF8" />
      <circle cx="28.5" cy="9.5" r="1.1" fill="#041E26" />

      {/* Core Node */}
      <circle cx="18" cy="16.5" r="2" fill="#ffffff" />
      <circle cx="18" cy="16.5" r="0.9" fill="#0B1506" />

      {/* Apex Bottom Anchor */}
      <circle cx="18" cy="28.5" r="3.2" fill="#A8F25A" />
      <circle cx="18" cy="28.5" r="1.3" fill="#0B1506" />
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
 * Horizontal lockup: mark plus luxury cyber wordmark.
 */
export function Logo({ className, wordClassName, label = 'Vorza' }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 group select-none', className)}>
      <LogoMark className="h-7 w-7 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_4px_16px_rgba(168,242,90,0.45)]" />
      <span
        className={cn(
          'text-[17px] font-extrabold tracking-tight text-foreground flex items-center font-heading',
          wordClassName,
        )}
      >
        <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
          {label}
        </span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary ml-1 shadow-[0_0_8px_var(--primary)] group-hover:scale-125 transition-transform" />
      </span>
    </span>
  );
}
