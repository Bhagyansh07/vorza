import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SnapshotHistoryPoint } from "../types";
import { fetchSnapshotHistory } from "../api";
import { healthColor, healthFillLightness } from "../lib/encoding";
import { formatDay } from "../lib/format";

interface Props {
  repoId: string;
  height?: number;
}

type LoadState = "loading" | "success" | "error";

export function TrendChart({ repoId, height = 320 }: Props) {
  const fillLightness = healthFillLightness();
  const [points, setPoints] = useState<SnapshotHistoryPoint[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string>();

  const load = () => {
    setState("loading");
    void fetchSnapshotHistory(repoId)
      .then((data) => {
        setPoints(data);
        setState("success");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load history");
        setState("error");
      });
  };

  useEffect(() => {
    load();
  }, [repoId]);

  const delta = useMemo(() => {
    if (points.length < 2) return null;
    const first = points[0]!.overall_health_score;
    const last = points[points.length - 1]!.overall_health_score;
    return Math.round((last - first) * 10) / 10;
  }, [points]);

  if (state === "loading") {
    return (
      <div className="flex h-[320px] items-center justify-center" role="status" aria-label="Loading trend">
        <div className="flex items-center gap-2 font-mono text-sm text-ink-dim">
          <span className="animate-soft-blink">loading history</span>
          <span className="animate-soft-blink" style={{ animationDelay: "0.2s" }}>…</span>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-ink">Trend unavailable</p>
        <p className="max-w-[40ch] text-xs text-ink-dim">{error}</p>
        <button
          onClick={load}
          className="rounded-stem bg-primary px-4 py-1.5 text-sm font-medium text-background transition-transform active:translate-y-[1px] hover:brightness-110"
        >
          Try again
        </button>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center">
        <p className="text-sm text-ink-dim">
          No snapshot history yet. Run a first analysis to start the trend.
        </p>
      </div>
    );
  }

  const lastValue = points[points.length - 1]!.overall_health_score;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Health over time</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            overall health score per analysis
          </p>
        </div>
        {delta !== null && (
          <span
            className={`font-mono text-sm tabular ${
              delta >= 0 ? "text-signal-good" : "text-signal-bad"
            }`}
          >
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}
            <span className="ml-1 text-[11px] text-ink-faint">since start</span>
          </span>
        )}
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 6, right: 8, bottom: 0, left: -18 }}
          >
            <defs>
              <linearGradient id="atlas-health" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={healthColor(0, fillLightness)} />
                <stop offset="50%" stopColor={healthColor(50, fillLightness)} />
                <stop offset="100%" stopColor={healthColor(100, fillLightness)} />
              </linearGradient>
              <linearGradient id="atlas-area" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={healthColor(0, fillLightness)} stopOpacity={0.02} />
                <stop offset="100%" stopColor={healthColor(lastValue, fillLightness)} stopOpacity={0.18} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="hsl(var(--line) / 0.5)"
              strokeDasharray="3 4"
              vertical={false}
            />
            <XAxis
              dataKey="created_at"
              tickFormatter={formatDay}
              stroke="hsl(var(--ink-faint))"
              tick={{ fontSize: 11, fill: "hsl(var(--ink-faint))" }}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke="hsl(var(--ink-faint))"
              tick={{ fontSize: 11, fill: "hsl(var(--ink-faint))" }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--line))", strokeDasharray: "3 3" }}
              content={customTooltip as (props: Record<string, unknown>) => React.ReactNode}
            />
            <Area
              type="monotone"
              dataKey="overall_health_score"
              stroke="url(#atlas-health)"
              strokeWidth={2}
              fill="url(#atlas-area)"
              dot={{ r: 2, fill: "hsl(var(--ink-dim))", stroke: "none" }}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function customTooltip(props: {
  active?: boolean;
  payload?: readonly { value?: number; payload?: SnapshotHistoryPoint }[];
}) {
  const { active, payload } = props;
  const entry = payload?.[0];
  if (!active || !entry?.payload) return null;
  const value = entry.payload.overall_health_score;
  return (
    <div className="rounded-stem border border-line bg-raised px-3 py-2 shadow-panel">
      <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">
        {formatDay(entry.payload.created_at)}
      </p>
      <p className="mt-0.5 font-mono text-sm tabular text-ink">
        <span
          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
          style={{ background: healthColor(value) }}
        />
        {value.toFixed(1)}
        <span className="ml-1 text-[11px] text-ink-faint">health</span>
      </p>
    </div>
  );
}