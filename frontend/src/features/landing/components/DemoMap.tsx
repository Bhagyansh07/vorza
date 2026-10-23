import * as d3 from "d3-force";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Sparkles, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

import type { FileNode, GraphLink } from "@/features/graph/types";
import {
  healthFill,
  healthLabel,
  nodeRadius,
} from "@/features/graph/lib/encoding";

interface Props {
  files: FileNode[];
  links: GraphLink[];
  height?: number;
  positions?: Record<string, { x: number; y: number }>;
  blastRadius?: boolean;
  selectedPath?: string | null;
  onSelect?: (path: string) => void;
  externalZoom?: { cx: number; cy: number; k: number };
  className?: string;
}

export function DemoMap({
  files,
  links,
  height = 420,
  positions,
  blastRadius = false,
  selectedPath = null,
  onSelect,
  externalZoom,
  className = "",
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const fittedRef = useRef(false);
  const fitRef = useRef<{ x: number; y: number; k: number } | null>(null);
  const externalRef = useRef<Props["externalZoom"] | null>();
  const [hovered, setHovered] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<'all' | 'bad' | 'warn' | 'good'>('all');
  const gridId = useId().replace(/:/g, "");
  const glossId = useId().replace(/:/g, "");

  interface SimNode extends FileNode {
    id: string;
    r: number;
    x: number;
    y: number;
  }
  interface SimLink {
    id: string;
    source: SimNode | string;
    target: SimNode | string;
  }

  const dependents = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const f of files) {
      for (const target of f.imports) {
        const list = map.get(target) ?? [];
        list.push(f.path);
        map.set(target, list);
      }
    }
    return map;
  }, [files]);

  const stamp = (a: string, b: string) => `${a}->${b}`;

  useEffect(() => {
    const svg = svgRef.current;
    const world = worldRef.current;
    if (!svg || !world) return;

    fittedRef.current = false;
    fitRef.current = null;

    const simNodes: SimNode[] = files.map((f) => {
      const seeded = positions?.[f.path];
      return {
        ...f,
        id: f.path,
        r: nodeRadius(f.complexity_score, f.loc),
        x: seeded?.x ?? (Math.random() - 0.5) * 500,
        y: seeded?.y ?? (Math.random() - 0.5) * 500,
      };
    });
    const present = new Set(simNodes.map((n) => n.id));
    const validLinks: SimLink[] = links
      .filter((l) => present.has(l.source) && present.has(l.target) && l.source !== l.target)
      .map((l) => ({ id: stamp(l.source, l.target), source: l.source, target: l.target }));

    const chargeStrength = -38 - Math.sqrt(simNodes.length) * 15;
    const sim = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(validLinks)
          .id((n) => n.id)
          .distance((d) => {
            const s = d.source as SimNode;
            const t = d.target as SimNode;
            return 28 + s.r + t.r;
          })
          .strength(0.45),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(chargeStrength).distanceMax(800))
      .force("collide", d3.forceCollide<SimNode>().radius((n) => n.r + 2).strength(0.92))
      .force("x", d3.forceX<SimNode>(0).strength(0.04))
      .force("y", d3.forceY<SimNode>(0).strength(0.04))
      .velocityDecay(0.36)
      .alphaMin(0.02)
      .alphaDecay(0.06);
    simRef.current = sim;

    const nodeEls = new Map<string, SVGGElement>();
    for (const el of Array.from(world.querySelectorAll<SVGGElement>("g[data-node-id]"))) {
      nodeEls.set(el.dataset.nodeId ?? "", el);
    }
    const linkEls = new Map<string, SVGLineElement>();
    for (const el of Array.from(world.querySelectorAll<SVGLineElement>("line[data-link-id]"))) {
      linkEls.set(el.dataset.linkId ?? "", el);
    }

    sim.on("tick", () => {
      for (const n of simNodes) {
        const el = nodeEls.get(n.id);
        if (el) el.setAttribute("transform", `translate(${n.x},${n.y})`);
      }
      for (const l of validLinks) {
        const el = linkEls.get(l.id);
        if (!el) continue;
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        el.setAttribute("x1", `${s.x}`);
        el.setAttribute("y1", `${s.y}`);
        el.setAttribute("x2", `${t.x}`);
        el.setAttribute("y2", `${t.y}`);
      }
      if (!fittedRef.current && sim.alpha() < 0.2 && !externalRef.current) {
        fittedRef.current = true;
        const { width, height: h } = svg.getBoundingClientRect();
        if (width < 10 || h < 10) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of simNodes) {
          minX = Math.min(minX, n.x - n.r);
          minY = Math.min(minY, n.y - n.r);
          maxX = Math.max(maxX, n.x + n.r);
          maxY = Math.max(maxY, n.y + n.r);
        }
        const w = maxX - minX || 1;
        const hh = maxY - minY || 1;
        const pad = 56;
        const k = Math.min((width - pad * 2) / w, (h - pad * 2) / hh, 1.4);
        const tx = width / 2 - ((minX + maxX) / 2) * k;
        const ty = h / 2 - ((minY + maxY) / 2) * k;
        fitRef.current = { x: tx, y: ty, k };
        world.setAttribute("transform", `translate(${tx},${ty}) scale(${k})`);
      }
    });

    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [files, links, positions]);

  useEffect(() => {
    externalRef.current = externalZoom;
    const world = worldRef.current;
    const svg = svgRef.current;
    if (!world || !svg) return;
    if (externalZoom) {
      const { width, height: h } = svg.getBoundingClientRect();
      if (width < 10 || h < 10) return;
      world.setAttribute(
        "transform",
        `translate(${width / 2},${h / 2}) scale(${externalZoom.k}) translate(${-externalZoom.cx},${-externalZoom.cy})`,
      );
    } else if (fitRef.current) {
      const f = fitRef.current;
      world.setAttribute("transform", `translate(${f.x},${f.y}) scale(${f.k})`);
    }
  }, [externalZoom]);

  const handleZoom = (factor: number) => {
    const world = worldRef.current;
    if (!world || !fitRef.current) return;
    fitRef.current.k *= factor;
    world.setAttribute(
      "transform",
      `translate(${fitRef.current.x},${fitRef.current.y}) scale(${fitRef.current.k})`,
    );
  };

  const handleResetZoom = () => {
    const world = worldRef.current;
    if (!world || !fitRef.current) return;
    fitRef.current.k = 1;
    world.setAttribute(
      "transform",
      `translate(${fitRef.current.x},${fitRef.current.y}) scale(1)`,
    );
  };

  const hoveredCount = hovered ? (dependents.get(hovered)?.length ?? 0) : 0;
  const hoveredNode = hovered ? files.find((f) => f.path === hovered) : null;

  return (
    <div className={`relative group/map w-full overflow-hidden rounded-2xl bg-background ${className}`}>
      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Health Filter Pills */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line/60 bg-surface/85 px-2.5 py-1 shadow-md backdrop-blur-md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mr-1 hidden sm:inline">
            Filter:
          </span>
          <button
            type="button"
            onClick={() => setHealthFilter('all')}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
              healthFilter === 'all'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-ink-dim hover:text-ink hover:bg-raised'
            }`}
          >
            All ({files.length})
          </button>
          <button
            type="button"
            onClick={() => setHealthFilter('bad')}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
              healthFilter === 'bad'
                ? 'bg-signal-bad text-white font-semibold shadow-xs'
                : 'text-signal-bad hover:bg-signal-bad/10'
            }`}
          >
            <ShieldAlert className="h-2.5 w-2.5" />
            <span>Risk (&lt;45)</span>
          </button>
          <button
            type="button"
            onClick={() => setHealthFilter('warn')}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
              healthFilter === 'warn'
                ? 'bg-signal-warn text-white font-semibold shadow-xs'
                : 'text-signal-warn hover:bg-signal-warn/10'
            }`}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            <span>Warn (45-69)</span>
          </button>
          <button
            type="button"
            onClick={() => setHealthFilter('good')}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${
              healthFilter === 'good'
                ? 'bg-signal-good text-white font-semibold shadow-xs'
                : 'text-signal-good hover:bg-signal-good/10'
            }`}
          >
            <ShieldCheck className="h-2.5 w-2.5" />
            <span>Healthy (≥70)</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line/60 bg-surface/85 p-1 shadow-md backdrop-blur-md">
          <button
            type="button"
            onClick={() => handleZoom(1.2)}
            title="Zoom In"
            aria-label="Zoom In"
            className="rounded-full p-1 text-ink-dim hover:bg-raised hover:text-ink transition-colors"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(0.8)}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="rounded-full p-1 text-ink-dim hover:bg-raised hover:text-ink transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset View"
            aria-label="Reset View"
            className="rounded-full p-1 text-ink-dim hover:bg-raised hover:text-ink transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        role={blastRadius ? "group" : "img"}
        aria-label={
          blastRadius
            ? "Demo map of a codebase. Hover a file to see what imports it."
            : `Demo map of a codebase: ${files.length} files as nodes sized by complexity and coloured by health, linked by import edges.`
        }
        className="h-full w-full touch-none select-none"
        style={{ height }}
      >
        <defs>
          <pattern id={gridId} width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="0.9" fill="hsl(var(--line) / 0.4)" />
          </pattern>
          <radialGradient id={glossId} cx="30%" cy="28%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
          </radialGradient>
          <filter id="laserGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="hsl(var(--background))" />
        <rect width="100%" height="100%" fill={`url(#${gridId})`} aria-hidden="true" />

        <g ref={worldRef}>
          {links.map((l) => {
            const key = stamp(l.source, l.target);
            const active = blastRadius && hovered != null && (hovered === l.source || hovered === l.target);
            return (
              <line
                key={key}
                data-link-id={key}
                x1={0}
                y1={0}
                x2={0}
                y2={0}
                stroke={active ? "hsl(var(--primary))" : "hsl(var(--line) / 0.65)"}
                strokeWidth={active ? 2 : 0.85}
                filter={active ? "url(#laserGlow)" : undefined}
                opacity={active ? 1 : 0.6}
              />
            );
          })}

          {files.map((f) => {
            const r = nodeRadius(f.complexity_score, f.loc);
            const isHovered = f.path === hovered;
            const isSelected = f.path === selectedPath;
            const isDependent = hovered != null && (dependents.get(hovered) ?? []).includes(f.path);
            const showLabel = isHovered || isSelected;

            const matchesFilter =
              healthFilter === 'all' ||
              (healthFilter === 'good' && f.health_score >= 70) ||
              (healthFilter === 'warn' && f.health_score >= 45 && f.health_score < 70) ||
              (healthFilter === 'bad' && f.health_score < 45);

            const nodeOpacity = !matchesFilter
              ? 0.15
              : isHovered || isSelected || isDependent
                ? 1
                : 0.92;

            return (
              <g
                key={f.path}
                data-node-id={f.path}
                data-node
                role={blastRadius ? "button" : undefined}
                tabIndex={blastRadius ? 0 : undefined}
                aria-label={
                  blastRadius
                    ? `${f.path}, ${healthLabel(f.health_score)} health, ${dependents.get(f.path)?.length ?? 0} dependents`
                    : undefined
                }
                className={blastRadius ? "cursor-pointer outline-none transition-transform" : "cursor-default"}
                onClick={blastRadius && onSelect ? () => onSelect(f.path) : undefined}
                onKeyDown={
                  blastRadius
                    ? (e) => {
                        if ((e.key === "Enter" || e.key === " ") && onSelect) {
                          e.preventDefault();
                          onSelect(f.path);
                        }
                      }
                    : undefined
                }
                onMouseEnter={() => setHovered(f.path)}
                onMouseLeave={() => setHovered(null)}
                onFocus={blastRadius ? () => setHovered(f.path) : undefined}
                onBlur={blastRadius ? () => setHovered(null) : undefined}
                style={{ opacity: nodeOpacity, transition: 'opacity 0.25s ease' }}
              >
                <circle r={Math.max(r + 4, 10)} fill="transparent" pointerEvents="all" />

                {(isHovered || isSelected || isDependent) && (
                  <circle
                    r={r + 4}
                    fill="none"
                    stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--ink-dim))"}
                    strokeWidth={1.4}
                    strokeDasharray={isSelected ? "2 2" : undefined}
                    pointerEvents="none"
                  />
                )}

                <circle
                  r={r}
                  fill={healthFill(f.health_score)}
                  stroke={
                    isSelected
                      ? "hsl(var(--primary))"
                      : isHovered
                        ? "hsl(var(--ink-faint))"
                        : hovered != null && isDependent
                          ? "hsl(var(--primary) / 0.7)"
                          : "hsl(var(--surface) / 0.5)"
                  }
                  strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : hovered != null && isDependent ? 1.2 : 0.6}
                  style={{
                    filter: isHovered || isSelected ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.45))' : undefined,
                    transition: 'all 0.2s ease',
                  }}
                  pointerEvents="none"
                />

                <circle
                  r={r}
                  fill={`url(#${glossId})`}
                  pointerEvents="none"
                />

                {showLabel ? (
                  <text
                    data-label
                    textAnchor="middle"
                    dy={-r - 6}
                    fontSize={10}
                    fontWeight={600}
                    fill="hsl(var(--ink))"
                    className="pointer-events-none font-mono select-none"
                  >
                    {f.path.split("/").at(-1)}
                  </text>
                ) : null}

                {blastRadius && isHovered ? (
                  <text
                    textAnchor="middle"
                    dy={r + 14}
                    fontSize={9}
                    fill="hsl(var(--ink-dim))"
                    className="pointer-events-none font-mono"
                  >
                    {hoveredCount} {hoveredCount === 1 ? "dependent" : "dependents"}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Bottom Floating File Inspector Card */}
      <div className="absolute bottom-3.5 left-3 right-3 z-10 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-line/80 bg-surface/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl transition-all">
          {hoveredNode ? (
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono font-medium text-ink">
                  {hoveredNode.path}
                </p>
                <p className="text-[11px] text-ink-dim">
                  {hoveredNode.loc} lines · {dependents.get(hoveredNode.path)?.length ?? 0} files depend on this
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    hoveredNode.health_score >= 70
                      ? 'bg-signal-good/15 text-signal-good border border-signal-good/30'
                      : hoveredNode.health_score >= 45
                        ? 'bg-signal-warn/15 text-signal-warn border border-signal-warn/30'
                        : 'bg-signal-bad/15 text-signal-bad border border-signal-bad/30'
                  }`}
                >
                  {hoveredNode.health_score >= 70 ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : hoveredNode.health_score >= 45 ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <ShieldAlert className="h-3 w-3" />
                  )}
                  {healthLabel(hoveredNode.health_score)} ({hoveredNode.health_score}/100)
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[11px] text-ink-dim">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Hover or click any node to inspect health score &amp; downstream dependencies</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}