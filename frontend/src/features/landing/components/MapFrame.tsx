import type { ReactNode } from "react";

/**
 * The surveyor's frame every landing map sits in: an elevated luxury glassmorphic
 * border, corner registration ticks and mono margin notes for sheet reference,
 * coordinates and scale. Purely decorative marks carry `aria-hidden`.
 */

interface Props {
  children: ReactNode;
  /** Sheet reference, e.g. "SHEET 01 / SURVEY" */
  sheet?: string;
  /** Margin coordinates, e.g. "30.2672°N  -  97.7431°W" */
  coords?: string;
  /** Scale note, e.g. "SCALE 1:9,400" */
  scale?: string;
  className?: string;
}

const tick = "absolute h-2.5 w-2.5 border-line/80";

export function MapFrame({ children, sheet, coords, scale, className = "" }: Props) {
  return (
    <figure className={`group ${className}`}>
      <div className="relative overflow-hidden rounded-3xl border border-line/70 bg-surface/60 shadow-2xl backdrop-blur-2xl transition-all duration-300 group-hover:border-primary/40">
        <div className="pointer-events-none absolute inset-2 rounded-2xl border border-line/20 z-10" />
        <span className={`${tick} left-0 top-0 border-l border-t rounded-tl-sm z-10`} />
        <span className={`${tick} right-0 top-0 border-r border-t rounded-tr-sm z-10`} />
        <span className={`${tick} bottom-0 left-0 border-b border-l rounded-bl-sm z-10`} />
        <span className={`${tick} bottom-0 right-0 border-b border-r rounded-br-sm z-10`} />

        {/* Minimalist Studio Window Chrome Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-line/60 bg-surface/75 px-4 py-2 text-xs backdrop-blur-xl">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink/15" />
            <span className="h-2 w-2 rounded-full bg-ink/15" />
            <span className="h-2 w-2 rounded-full bg-ink/15" />
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] font-medium text-ink-dim truncate">
            {sheet && <span className="truncate">{sheet}</span>}
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-ink-faint shrink-0">
            {scale && <span className="hidden sm:inline-block">{scale}</span>}
            <span className="flex h-1.5 w-1.5 rounded-full bg-signal-good" />
          </div>
        </div>

        <div className="relative w-full">{children}</div>
      </div>

      <figcaption className="mt-2.5 flex items-center justify-between gap-4 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        {sheet ? <span className="truncate">{sheet}</span> : <span />}
        {coords ? <span className="text-right tabular shrink-0">{coords}</span> : <span />}
        {scale ? <span className="text-right shrink-0">{scale}</span> : null}
      </figcaption>
    </figure>
  );
}