import * as d3 from "d3-force";
import { select } from "d3-selection";
import { zoomIdentity, zoom as d3Zoom, type ZoomTransform } from "d3-zoom";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FileNode, GraphLink } from "../types";
import { healthFill, healthLabel, nodeRadius } from "../lib/encoding";

interface Props {
  files: FileNode[];
  links: GraphLink[];
  pulse?: Record<string, number>;
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
}

interface SimNode extends FileNode {
  id: string;
  index?: number;
  r: number;
  x: number;
  y: number;
}

interface SimLink {
  id: string;
  source: SimNode | string;
  target: SimNode | string;
}

const BOUNDING = 120000;

export interface ForceGraphHandle {
  fit: () => void;
  nodeScreenPoint: (path: string) => { x: number; y: number } | null;
  nodeNearestScreenPoint: (x: number, y: number) => string | null;
  canvasSize: () => { width: number; height: number };
}

function stampKey(a: string, b: string): string {
  return `${a}->${b}`;
}

export const ForceDirectedGraph = forwardRef<ForceGraphHandle, Props>(
  function ForceDirectedGraph(
    { files, links, pulse = {}, selectedPath, onSelect }: Props,
    ref,
  ) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomKRef = useRef(1);
  const zoomRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const sizeRef = useRef({ width: 0, height: 0 });
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const selectedRef = useRef<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  selectedRef.current = selectedPath;
  hoveredRef.current = hovered;
  focusedRef.current = focused;

  const latestPulse = useMemo(() => {
    const map = new Map<string, number>();
    for (const [path, stamp] of Object.entries(pulse)) {
      const cur = map.get(path);
      if (cur === undefined || stamp > cur) map.set(path, stamp);
    }
    return map;
  }, [pulse]);

  const nodeById = useMemo(() => {
    const map = new Map<string, FileNode>();
    for (const f of files) map.set(f.path, f);
    return map;
  }, [files]);

  const labeled = useMemo(() => {
    const ranked = [...files]
      .sort((a, b) => b.complexity_score - a.complexity_score)
      .slice(0, 26)
      .map((f) => f.path);
    const paths = new Set(ranked);
    if (selectedPath) paths.add(selectedPath);
    if (hovered) paths.add(hovered);
    if (focused) paths.add(focused);
    return paths;
  }, [files, selectedPath, hovered, focused]);

  const refreshLabels = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const k = zoomKRef.current;
    const selected = selectedRef.current;
    const hoveredNow = hoveredRef.current;
    const focusedNow = focusedRef.current;
    const fontSize = Math.min(12, 10 / k);
    select(world)
      .selectAll<SVGGElement, SimNode>("g[data-node]")
      .each(function () {
        // Same rule as the tick maps: these are React-owned elements with no
        // d3 datum, so read the id from the attribute, not from a bound `d`.
        const path = this.dataset.nodeId ?? "";
        const keep = path === selected || path === hoveredNow || path === focusedNow;
        const label = select(this).select<SVGTextElement>("text[data-label]");
        label.attr("display", keep || k >= 0.7 ? "" : "none");
        label.attr("font-size", `${fontSize}`);
      });
  }, []);

  const applyTransform = useCallback(
    (t: ZoomTransform) => {
      if (worldRef.current) {
        worldRef.current.setAttribute(
          "transform",
          `translate(${t.x},${t.y}) scale(${t.k})`,
        );
      }
      zoomKRef.current = t.k;
      zoomRef.current = { x: t.x, y: t.y, k: t.k };
      refreshLabels();
    },
    [refreshLabels],
  );

  const fit = useCallback(() => {
    const sim = simRef.current;
    const svg = svgRef.current;
    if (!sim || !svg) return;
    const { width, height } = sizeRef.current;
    if (width < 10 || height < 10) return;
    const nodes = sim.nodes();
    if (nodes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.r);
      minY = Math.min(minY, n.y - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const pad = 70;
    const k = Math.min((width - pad * 2) / w, (height - pad * 2) / h, 1.5);
    const tx = width / 2 - ((minX + maxX) / 2) * k;
    const ty = height / 2 - ((minY + maxY) / 2) * k;
    applyTransform(zoomIdentity.translate(tx, ty).scale(k));
  }, [applyTransform]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    sizeRef.current = (() => {
      const rect = svg.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })();
    const behavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 7])
      .on("zoom", (event) => applyTransform(event.transform));
    select(svg).call(behavior).on("dblclick.zoom", null);
    return () => {
      simRef.current?.stop();
      simRef.current = null;
    };
  }, [applyTransform]);

  useEffect(() => {
    const svg = svgRef.current;
    const world = worldRef.current;
    if (!svg || !world) return;

    const simNodes: SimNode[] = files.map((f, i) => {
      const prev = positionsRef.current.get(f.path);
      return {
        ...f,
        id: f.path,
        index: i,
        r: nodeRadius(f.complexity_score, f.loc),
        x: Number.isFinite(prev?.x) ? (prev?.x as number) : (Math.random() - 0.5) * 700,
        y: Number.isFinite(prev?.y) ? (prev?.y as number) : (Math.random() - 0.5) * 700,
      };
    });

    positionsRef.current.clear();
    for (const n of simNodes) {
      positionsRef.current.set(n.id, { x: n.x, y: n.y });
    }

    const validLinks: SimLink[] = links
      .filter((l) => nodeById.has(l.source) && nodeById.has(l.target) && l.source !== l.target)
      .map((l) => ({ id: stampKey(l.source, l.target), source: l.source, target: l.target }));

    const chargeStrength = -38 - Math.sqrt(simNodes.length) * 15;
    const sim = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(validLinks)
          .id((d) => d.id)
          .distance((d) => {
            const s = d.source as SimNode;
            const t = d.target as SimNode;
            return 26 + s.r + t.r;
          })
          .strength(0.45),
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength).distanceMax(800))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((d) => d.r + 1.5).strength(0.9).iterations(2),
      )
      .force("x", d3.forceX<SimNode>(0).strength(0.04))
      .force("y", d3.forceY<SimNode>(0).strength(0.04))
      .velocityDecay(0.36);
    simRef.current = sim;

    // These elements are React-owned, so they carry no d3-bound `__data__`:
    // a `selection.each` callback would receive `undefined` as the datum and
    // crash (`n.id` on `undefined`). Read the ids the SVG already carries
    // (`data-node-id` / `data-link-id`) and key the maps on those instead.
    const nodeEls = new Map<string, SVGGElement>();
    for (const el of Array.from(
      world.querySelectorAll<SVGGElement>("g[data-node-id]"),
    )) {
      nodeEls.set(el.dataset.nodeId ?? "", el);
    }
    const linkEls = new Map<string, SVGLineElement>();
    for (const el of Array.from(
      world.querySelectorAll<SVGLineElement>("line[data-link-id]"),
    )) {
      linkEls.set(el.dataset.linkId ?? "", el);
    }

    sim.on("tick", () => {
      for (const link of validLinks) {
        const el = linkEls.get(link.id);
        if (!el) continue;
        const s = link.source as SimNode;
        const t = link.target as SimNode;
        el.setAttribute("x1", `${s.x}`);
        el.setAttribute("y1", `${s.y}`);
        el.setAttribute("x2", `${t.x}`);
        el.setAttribute("y2", `${t.y}`);
      }
      const k = zoomKRef.current;
      const linkOpacity = k < 0.42 ? "0.22" : "0.5";
      linkEls.forEach((el) => el.setAttribute("opacity", linkOpacity));
      for (const n of simNodes) {
        const el = nodeEls.get(n.id);
        if (!el) continue;
        n.x = Math.max(-BOUNDING, Math.min(BOUNDING, n.x));
        n.y = Math.max(-BOUNDING, Math.min(BOUNDING, n.y));
        el.setAttribute("transform", `translate(${n.x},${n.y})`);
      }
    });

    const settleTimer = setTimeout(() => {
      fit();
      sim.alphaTarget(0.02);
      setTimeout(() => sim.alphaTarget(0), 500);
    }, 1300);

    return () => {
      clearTimeout(settleTimer);
      sim.stop();
      simRef.current = null;
    };
  }, [fit, files, links, nodeById]);

  useImperativeHandle(
    ref,
    () => ({
      fit,
      nodeScreenPoint: (path: string) => {
        const sim = simRef.current;
        if (!sim) return null;
        const node = sim
          .nodes()
          .find((n) => n.id === path);
        if (!node) return null;
        const { x, y, k } = zoomRef.current;
        return { x: node.x * k + x, y: node.y * k + y };
      },
      nodeNearestScreenPoint: (screenX: number, screenY: number) => {
        const sim = simRef.current;
        if (!sim) return null;
        const { x, y, k } = zoomRef.current;
        const wx = (screenX - x) / k;
        const wy = (screenY - y) / k;
        let best: SimNode | null = null;
        let bestDist = Infinity;
        for (const n of sim.nodes()) {
          const d = Math.hypot(n.x - wx, n.y - wy);
          if (d < bestDist) {
            bestDist = d;
            best = n;
          }
        }
        const threshold = best ? Math.max(best.r + 24, 28) : 0;
        return best && bestDist <= threshold ? best.id : null;
      },
      canvasSize: () => sizeRef.current,
    }),
    [fit],
  );

  const handleNodeClick = (path: string) => {
    onSelectRef.current(path === selectedPath ? null : path);
  };

  const handleHover = (path: string) => {
    setHovered((prev) => (prev === path ? prev : path));
  };

  const handleNodeKeyDown = (e: React.KeyboardEvent<SVGGElement>, path: string) => {
    // role="button" on a native-less <g> gets no built-in activation, so
    // Enter and Space both toggle the selection, matching a real button.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleNodeClick(path);
    }
  };

  return (
    <svg
      ref={svgRef}
      role="group"
      aria-label="Force-directed map of the codebase. Each file is a focusable node: Tab to a node and press Enter to inspect it. Use the Map/List toggle for a table of every file with its scores."
      className="h-full w-full touch-none select-none"
    >
      <defs>
        <pattern id="atlas-dots" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.25" cy="1.25" r="1" fill="hsl(var(--line) / 0.35)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#atlas-dots)" pointerEvents="none" />
      <g ref={worldRef}>
        <g data-links-container>
          {links.map((l) => (
            <line
              key={stampKey(l.source, l.target)}
              data-link
              data-link-id={stampKey(l.source, l.target)}
              stroke="hsl(var(--line) / 0.55)"
              strokeWidth="1"
            />
          ))}
        </g>
        <g data-nodes-container>
          {files.map((f) => {
            const r = nodeRadius(f.complexity_score, f.loc);
            const isSelected = f.path === selectedPath;
            const isHovered = f.path === hovered;
            const isFocused = f.path === focused;
            const stamp = latestPulse.get(f.path);
            return (
              <g
                key={f.path}
                data-node
                data-node-id={f.path}
                role="button"
                tabIndex={0}
                aria-label={`${f.path}, ${healthLabel(f.health_score)} health, complexity ${f.complexity_score}`}
                aria-pressed={isSelected}
                className="cursor-pointer outline-none"
                onClick={() => handleNodeClick(f.path)}
                onKeyDown={(e) => handleNodeKeyDown(e, f.path)}
                onMouseEnter={() => handleHover(f.path)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setFocused(f.path)}
                onBlur={() => setFocused(null)}
              >
                {stamp !== undefined && (
                  <circle
                    key={`ring-${stamp}`}
                    className="atlas-pulse-ring"
                    r={Math.max(r + 2, 9)}
                    fill={healthFill(f.health_score)}
                    opacity={0.45}
                    pointerEvents="none"
                  />
                )}
                <circle
                  r={Math.max(r + 4, 11)}
                  fill="transparent"
                  pointerEvents="all"
                />
                <circle
                  r={r}
                  fill={healthFill(f.health_score)}
                  opacity={isHovered || isSelected || isFocused ? 1 : 0.88}
                  stroke={
                    isSelected
                      ? "hsl(var(--primary))"
                      : isFocused
                        ? "hsl(var(--ink-faint))"
                        : "none"
                  }
                  strokeWidth={isSelected ? 2 : isFocused ? 1.5 : 0}
                  pointerEvents="none"
                />
                {labeled.has(f.path) && (
                  <text
                    data-label
                    y={-r - 5}
                    textAnchor="middle"
                    fill="hsl(var(--ink-dim))"
                    fontSize="10"
                    pointerEvents="none"
                  >
                    {f.path.slice(f.path.lastIndexOf("/") + 1)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
  },
);