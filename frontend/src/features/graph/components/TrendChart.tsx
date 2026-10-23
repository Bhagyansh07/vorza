import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SnapshotHistoryPoint } from '../types';
import { fetchSnapshotHistory } from '../api';
import { healthColor, healthFillLightness, healthLabel } from '../lib/encoding';
import { formatDay } from '../lib/format';
import { HEALTH_GOOD_MIN, HEALTH_WARN_MIN } from '@/lib/health-thresholds';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  repoId: string;
  height?: number;
}

type LoadState = 'loading' | 'success' | 'error';
type TimeRange = 'all' | '30d' | '7d';

export function TrendChart({ repoId, height = 320 }: Props) {
  const fillLightness = healthFillLightness();
  const [rawPoints, setRawPoints] = useState<SnapshotHistoryPoint[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string>();
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const load = () => {
    setState('loading');
    void fetchSnapshotHistory(repoId)
      .then((data) => {
        setRawPoints(data);
        setState('success');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load history');
        setState('error');
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  const points = useMemo(() => {
    if (timeRange === 'all') return rawPoints;
    const now = Date.now();
    const days = timeRange === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const filtered = rawPoints.filter((p) => new Date(p.created_at).getTime() >= cutoff);
    return filtered.length > 0 ? filtered : rawPoints;
  }, [rawPoints, timeRange]);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const scores = points.map((p) => p.overall_health_score);
    const first = points[0]!.overall_health_score;
    const last = points[points.length - 1]!.overall_health_score;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const delta = Math.round((last - first) * 10) / 10;
    return { first, last, min, max, delta };
  }, [points]);

  if (state === 'loading') {
    return (
      <div
        className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-line/60 bg-surface/60 p-6 backdrop-blur-xl shadow-panel"
        role="status"
        aria-label="Loading trend"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 animate-pulse">
          <Activity className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2 font-mono text-sm text-ink-dim">
          <span className="animate-soft-blink">Analyzing snapshot trend</span>
          <span className="animate-soft-blink" style={{ animationDelay: '0.2s' }}>…</span>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-3.5 rounded-2xl border border-line/60 bg-surface/60 p-6 text-center backdrop-blur-xl shadow-panel">
        <p className="text-sm font-semibold text-ink">Trend unavailable</p>
        <p className="max-w-[40ch] text-xs text-ink-dim leading-relaxed">{error}</p>
        <button
          onClick={load}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-95"
        >
          Try again
        </button>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-line/60 bg-surface/60 p-6 backdrop-blur-xl shadow-panel">
        <p className="text-sm text-ink-dim">
          No snapshot history yet. Run a first analysis to start the trend.
        </p>
      </div>
    );
  }

  const lastValue = stats?.last ?? 0;
  const delta = stats?.delta ?? 0;

  return (
    <div className="rounded-2xl border border-line/70 bg-surface/75 p-6 shadow-panel backdrop-blur-xl transition-all">
      {/* Header controls & stats strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-ink">Health over time</h3>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
              style={{
                backgroundColor: `hsl(var(${
                  lastValue >= HEALTH_GOOD_MIN
                    ? '--signal-good'
                    : lastValue >= HEALTH_WARN_MIN
                      ? '--signal-warn'
                      : '--signal-bad'
                }) / 0.15)`,
                color: `hsl(var(${
                  lastValue >= HEALTH_GOOD_MIN
                    ? '--signal-good'
                    : lastValue >= HEALTH_WARN_MIN
                      ? '--signal-warn'
                      : '--signal-bad'
                }))`,
              }}
            >
              {healthLabel(lastValue)} · {lastValue.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-dim">
            Overall health score across repository analysis snapshots
          </p>
        </div>

        {/* Time range filters & Trend badge */}
        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Time range"
            className="flex items-center rounded-lg border border-line/70 bg-surface/90 p-0.5 text-xs font-medium"
          >
            {(['all', '30d', '7d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                aria-pressed={timeRange === r}
                className={`rounded-md px-2.5 py-1 text-xs uppercase tracking-wider transition-all ${
                  timeRange === r
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-ink-dim hover:text-ink'
                }`}
              >
                {r === 'all' ? 'All Time' : r.toUpperCase()}
              </button>
            ))}
          </div>

          {stats && (
            <div
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold tabular ${
                delta >= 0
                  ? 'border-signal-good/30 bg-signal-good/10 text-signal-good'
                  : 'border-signal-bad/30 bg-signal-bad/10 text-signal-bad'
              }`}
            >
              {delta >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>{delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Responsive Recharts Container */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 12, right: 12, bottom: 4, left: -16 }}
          >
            <defs>
              <linearGradient id="atlas-health" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={healthColor(0, fillLightness)} />
                <stop offset="50%" stopColor={healthColor(50, fillLightness)} />
                <stop offset="100%" stopColor={healthColor(100, fillLightness)} />
              </linearGradient>
              <linearGradient id="atlas-area" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={healthColor(lastValue, fillLightness)}
                  stopOpacity={0.32}
                />
                <stop
                  offset="65%"
                  stopColor={healthColor(lastValue, fillLightness)}
                  stopOpacity={0.08}
                />
                <stop offset="100%" stopColor="transparent" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="hsl(var(--line) / 0.45)"
              strokeDasharray="4 4"
              vertical={false}
            />

            {/* Threshold Benchmark Lines */}
            <ReferenceLine
              y={HEALTH_GOOD_MIN}
              stroke="hsl(var(--signal-good) / 0.4)"
              strokeDasharray="3 3"
              label={{
                value: 'Healthy (70)',
                fill: 'hsl(var(--signal-good))',
                fontSize: 10,
                position: 'insideTopLeft',
              }}
            />
            <ReferenceLine
              y={HEALTH_WARN_MIN}
              stroke="hsl(var(--signal-warn) / 0.4)"
              strokeDasharray="3 3"
              label={{
                value: 'Warning (45)',
                fill: 'hsl(var(--signal-warn))',
                fontSize: 10,
                position: 'insideTopLeft',
              }}
            />

            <XAxis
              dataKey="created_at"
              tickFormatter={formatDay}
              stroke="hsl(var(--ink-faint))"
              tick={{ fontSize: 11, fill: 'hsl(var(--ink-faint))' }}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke="hsl(var(--ink-faint))"
              tick={{ fontSize: 11, fill: 'hsl(var(--ink-faint))' }}
              axisLine={false}
              tickLine={false}
              width={38}
            />

            <Tooltip
              cursor={{ stroke: 'hsl(var(--primary) / 0.5)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
              content={customTooltip as (props: Record<string, unknown>) => React.ReactNode}
            />

            <Area
              type="monotone"
              dataKey="overall_health_score"
              stroke="url(#atlas-health)"
              strokeWidth={2.5}
              fill="url(#atlas-area)"
              dot={{ r: 3, fill: 'hsl(var(--surface))', stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--surface))', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Metrics Strip */}
      {stats && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-4 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-ink-faint uppercase text-[10px] tracking-wider block">Peak Score</span>
              <span className="font-mono font-semibold text-ink tabular">{stats.max.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-ink-faint uppercase text-[10px] tracking-wider block">Floor Score</span>
              <span className="font-mono font-semibold text-ink tabular">{stats.min.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-ink-faint uppercase text-[10px] tracking-wider block">Total Snapshots</span>
              <span className="font-mono font-semibold text-ink tabular">{points.length}</span>
            </div>
          </div>
          <p className="text-[11px] text-ink-dim">
            Health scores reflect cyclomatic complexity, git churn, and dependency coupling.
          </p>
        </div>
      )}
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
  const label = healthLabel(value);

  return (
    <div className="rounded-xl border border-line/80 bg-surface/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {formatDay(entry.payload.created_at)}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full shadow-xs"
          style={{ background: healthColor(value) }}
        />
        <p className="font-mono text-sm font-semibold tabular text-ink">
          {value.toFixed(1)}
          <span className="ml-1 text-xs font-normal text-ink-dim">/ 100</span>
        </p>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            value >= HEALTH_GOOD_MIN
              ? 'bg-signal-good/15 text-signal-good'
              : value >= HEALTH_WARN_MIN
                ? 'bg-signal-warn/15 text-signal-warn'
                : 'bg-signal-bad/15 text-signal-bad'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}