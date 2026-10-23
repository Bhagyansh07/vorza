import type { ReactNode } from "react";

/**
 * The surveyor's frame every landing map sits in: an elevated luxury glassmorphic
 * chassis, corner registration reticles, studio macOS jewel window controls,
 * and mono margin notes for sheet reference, coordinates, and scale.
 */

interface Props {
  children: ReactNode;
  /** Sheet reference, e.g. "SHEET 01 / SURVEY" */
  sheet?: string;
  /** Margin coordinates, e.g. "30.2672°N  ·  97.7431°W" */
  coords?: string;
  /** Scale note, e.g. "SCALE 1:9,400" */
  scale?: string;
  className?: string;
}

const tick = "absolute h-3 w-3 border-primary/40";

export function MapFrame({ children, sheet, coords, scale, className = "" }: Props) {
  return (
    <figure className={`group relative ${className}`}>
      {/* Outer Ambient Glow Aura */}
      <div className="pointer-events-none absolute -inset-1 rounded-[28px] bg-gradient-to-b from-primary/15 via-emerald-500/5 to-transparent opacity-75 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative overflow-hidden rounded-[26px] border border-line/80 bg-surface/75 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-all duration-300 group-hover:border-primary/40">
        {/* Specular Top Rim Reflection */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent z-20" />
        <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-line/25 z-10" />

        {/* Studio Reticle Corner Marks */}
        <span className={`${tick} left-1 top-1 border-l-2 border-t-2 rounded-tl-sm z-10`} />
        <span className={`${tick} right-1 top-1 border-r-2 border-t-2 rounded-tr-sm z-10`} />
        <span className={`${tick} bottom-1 left-1 border-b-2 border-l-2 rounded-bl-sm z-10`} />
        <span className={`${tick} bottom-1 right-1 border-b-2 border-r-2 rounded-br-sm z-10`} />

        {/* Minimalist Studio Window Chrome Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-line/70 bg-surface/85 px-4 sm:px-5 py-2.5 text-xs backdrop-blur-xl">
          {/* macOS Studio Jewels */}
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70 border border-rose-500/40 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70 border border-amber-500/40 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 border border-emerald-500/40 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] font-medium text-ink-dim truncate">
            {sheet && (
              <span className="truncate flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {sheet}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 font-mono text-[10px] text-ink-faint shrink-0">
            {scale && <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-raised/80 border border-line/60 font-medium">{scale}</span>}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-good opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-signal-good"></span>
            </span>
          </div>
        </div>

        <div className="relative w-full">{children}</div>
      </div>

      <figcaption className="mt-3 flex items-center justify-between gap-4 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        {sheet ? <span className="truncate">{sheet}</span> : <span />}
        {coords ? <span className="text-right tabular shrink-0 font-medium">{coords}</span> : <span />}
        {scale ? <span className="text-right shrink-0">{scale}</span> : null}
      </figcaption>
    </figure>
  );
}