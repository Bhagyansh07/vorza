import type { CSSProperties } from "react";
import {
  HEALTH_GOOD_MIN,
  HEALTH_WARN_MIN,
  legendStops,
  radiusSamplePoints,
} from "../lib/encoding";

export function GraphLegend() {
  const stops = legendStops();
  const gradient = `linear-gradient(90deg, ${stops.map((s) => s.color).join(", ")})`;

  return (
    <div
      className="flex items-center gap-6 rounded-stem border border-line/70 bg-surface/90 px-4 py-2.5 shadow-panel backdrop-blur-sm"
      role="group"
      aria-label="Legend"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Health
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] tabular text-ink-dim">0</span>
          <div
            className="h-2 w-28 rounded-full"
            style={{ background: gradient }}
            role="img"
            aria-label={`Color scale from red indicating unhealthy to green indicating healthy. At ${HEALTH_WARN_MIN} and above is At risk; at ${HEALTH_GOOD_MIN} and above is Healthy.`}
          />
          <span className="text-[11px] tabular text-ink-dim">100</span>
        </div>
        <p className="max-w-[19rem] text-[11px] leading-snug text-ink-faint">
          Colour is health: critical below {HEALTH_WARN_MIN}, at risk from{' '}
          {HEALTH_WARN_MIN}, healthy from {HEALTH_GOOD_MIN}. Node size is
          complexity.
        </p>
      </div>

      <div className="h-8 w-px bg-line/70" />

      <div className="flex items-center gap-2.5" style={sizeLegendStyles}>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Complexity
        </span>
        <div className="flex items-end gap-3">
          {radiusSamplePoints().map((pt) => (
            <span
              key={pt.complexity}
              className="flex items-center gap-1.5"
              title={`complexity ~${pt.complexity}`}
            >
              <Circle r={pt.radius} />
              <span className="text-[11px] tabular text-ink-dim">
                {pt.complexity}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const sizeLegendStyles: CSSProperties = { whiteSpace: "nowrap" };

function Circle({ r }: { r: number }) {
  const size = r * 2;
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: "hsl(var(--atlas-accent) / 0.85)",
      }}
    />
  );
}