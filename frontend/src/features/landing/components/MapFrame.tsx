import type { ReactNode } from "react";

/**
 * The surveyor's frame every landing map sits in: a double hairline border
 * (the map border of an atlas sheet), corner registration ticks and mono
 * margin notes for sheet reference, coordinates and scale. Purely decorative,
 * so the marks carry `aria-hidden` and the frame is one labelled figure.
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

const tick = "absolute h-2 w-2 border-line";

export function MapFrame({ children, sheet, coords, scale, className = "" }: Props) {
  return (
    <figure className={`relative ${className}`}>
      {/* The border, double hairline and corner ticks are decoration only. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-stem border border-line bg-surface">
        <div className="pointer-events-none absolute inset-1 rounded-[10px] border border-line/60" />
        <span className={`${tick} left-0 top-0 border-l border-t`} />
        <span className={`${tick} right-0 top-0 border-r border-t`} />
        <span className={`${tick} bottom-0 left-0 border-b border-l`} />
        <span className={`${tick} bottom-0 right-0 border-b border-r`} />
      </div>

      <div className="relative h-full w-full">{children}</div>
      <figcaption className="mt-2 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {sheet ? <span>{sheet}</span> : <span />}
        {coords ? <span className="text-right tabular">{coords}</span> : <span />}
        {scale ? <span className="text-right">{scale}</span> : null}
      </figcaption>
    </figure>
  );
}