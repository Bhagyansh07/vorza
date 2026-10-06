import * as d3 from "d3-force";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { FileNode, GraphLink } from "@/features/graph/types";
import {
  healthFill,
  healthLabel,
  nodeRadius,
} from "@/features/graph/lib/encoding";

/**
 * Compact force-directed map for the landing page. Uses the same simulation
 * parameters and the same `encoding.ts` colour rules as the product's map, but
 * stays small enough to ship inside the landing bundle. Rendered as "demo"
 * everywhere it appears (see MapFrame captions).
 *
 * The d3 lesson from ForceDirectedGraph applies here too: these SVG elements
 * are React-owned and carry no d3 datum, so tick updates read
 * `data-node-id` / `data-link-id` from the DOM instead of a bound `d`.
 */

interface Props {
  files: FileNode[];
  links: GraphLink[];
  height?: number;
  /** Deterministic starting layout (see demoSeedPositions), used by the
   * scroll-story so its zoom keyframes land on the same regions every load. */
  positions?: Record<string, { x: number; y: number }>;
  /** Highlight everything that imports the hovered node (reverse edges). */
  blastRadius?: boolean;
  selectedPath?: string | null;
  onSelect?: (path: string) => void;
  /** Scroll-story control: centre (cx, cy) and zoom k applied to the world. */
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
  // When the story drives the zoom, the auto-fit must not fight it. The
  // assignment lives in the effect below so it never runs during render.
  const externalRef = useRef<Props["externalZoom"] | null>();
  const [hovered, setHovered] = useState<string | null>(null);
  const gridId = useId().replace(/:/g, "");

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

  // Reverse-edge index for the blast-radius demo: path -> files that import it.
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
            return 26 + s.r + t.r;
          })
          .strength(0.45),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(chargeStrength).distanceMax(800))
      .force("collide", d3.forceCollide<SimNode>().radius((n) => n.r + 1.5).strength(0.9).iterations(2))
      .force("x", d3.forceX<SimNode>(0).strength(0.04))
      .force("y", d3.forceY<SimNode>(0).strength(0.04))
      .velocityDecay(0.36)
      // Never fully freezes: a slow drift keeps the map feeling alive.
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
      // Fit once the layout has mostly settled (never while the story drives
      // the transform itself).
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

  // External zoom (scroll story) wins over the fitted transform.
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

  const hoveredCount = hovered ? (dependents.get(hovered)?.length ?? 0) : 0;

  return (
    <svg
      ref={svgRef}
      role={blastRadius ? "group" : "img"}
      aria-label={
        blastRadius
          ? "Demo map of a codebase. Hover a file to see what imports it."
          : `Demo map of a codebase: ${files.length} files as nodes sized by complexity and coloured by health, linked by import edges.`
      }
      className={`h-full w-full touch-none select-none ${className}`}
      style={{ height }}
    >
      <defs>
        <pattern id={gridId} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="hsl(var(--line) / 0.35)" strokeWidth="1" />
        </pattern>
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
              stroke={active ? "hsl(var(--ink-dim))" : "hsl(var(--line) / 0.7)"}
              strokeWidth={active ? 1.2 : 0.75}
              opacity={active ? 0.9 : 0.5}
            />
          );
        })}

        {files.map((f) => {
          const r = nodeRadius(f.complexity_score, f.loc);
          const isHovered = f.path === hovered;
          const isSelected = f.path === selectedPath;
          const isDependent = hovered != null && (dependents.get(hovered) ?? []).includes(f.path);
          const showLabel = isHovered || isSelected;

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
              className={blastRadius ? "cursor-pointer outline-none" : "cursor-default"}
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
            >
              <circle r={Math.max(r + 3, 8)} fill="transparent" pointerEvents="all" />
              <circle
                r={r}
                fill={healthFill(f.health_score)}
                opacity={isHovered || isSelected || isDependent ? 1 : 0.9}
                stroke={
                  isSelected
                    ? "hsl(var(--primary))"
                    : isHovered
                      ? "hsl(var(--ink-faint))"
                      : hovered != null && isDependent
                        ? "hsl(var(--ink-dim))"
                        : "none"
                }
                strokeWidth={isSelected ? 2 : isHovered ? 1.5 : hovered != null && isDependent ? 1.2 : 0}
                pointerEvents="none"
              />
              {showLabel ? (
                <text
                  data-label
                  textAnchor="middle"
                  dy={-r - 6}
                  fontSize={9}
                  fill="hsl(var(--ink))"
                  className="pointer-events-none font-mono"
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
  );
}