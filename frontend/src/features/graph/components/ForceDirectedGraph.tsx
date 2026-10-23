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

    const fit = useCallback(() => {
      const svg = svgRef.current;
      const world = worldRef.current;
      if (!svg || !world) return;
      const { width, height } = svg.getBoundingClientRect();
      if (width < 10 || height < 10) return;

      const pos = Array.from(positionsRef.current.values());
      if (pos.length === 0) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of pos) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }

      const pad = 64;
      const graphW = maxX - minX || 1;
      const graphH = maxY - minY || 1;
      const k = Math.min((width - pad * 2) / graphW, (height - pad * 2) / graphH, 1.3);
      const tx = width / 2 - ((minX + maxX) / 2) * k;
      const ty = height / 2 - ((minY + maxY) / 2) * k;

      const z = d3Zoom<SVGSVGElement, unknown>();
      select(svg).call(z.transform, zoomIdentity.translate(tx, ty).scale(k));
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        fit,
        nodeScreenPoint: (path: string) => {
          const p = positionsRef.current.get(path);
          if (!p) return null;
          const { x, y, k } = zoomRef.current;
          return { x: p.x * k + x, y: p.y * k + y };
        },
        nodeNearestScreenPoint: (screenX: number, screenY: number) => {
          const { x, y, k } = zoomRef.current;
          const wx = (screenX - x) / k;
          const wy = (screenY - y) / k;
          let nearest: string | null = null;
          let bestDist = Infinity;
          for (const [path, p] of positionsRef.current.entries()) {
            const d = Math.hypot(p.x - wx, p.y - wy);
            if (d < bestDist) {
              bestDist = d;
              nearest = path;
            }
          }
          return bestDist < 120 ? nearest : null;
        },
        canvasSize: () => sizeRef.current,
      }),
      [fit],
    );

    useEffect(() => {
      const svg = svgRef.current;
      const world = worldRef.current;
      if (!svg || !world) return;

      const simNodes: SimNode[] = files.map((f) => ({
        ...f,
        id: f.path,
        r: nodeRadius(f.complexity_score, f.loc),
        x: (Math.random() - 0.5) * 500,
        y: (Math.random() - 0.5) * 500,
      }));

      const present = new Set(simNodes.map((n) => n.id));
      const validLinks: SimLink[] = links
        .filter((l) => present.has(l.source) && present.has(l.target) && l.source !== l.target)
        .map((l) => ({ id: stampKey(l.source, l.target), source: l.source, target: l.target }));

      const charge = -42 - Math.sqrt(simNodes.length) * 16;
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
              return 32 + s.r + t.r;
            })
            .strength(0.4),
        )
        .force("charge", d3.forceManyBody<SimNode>().strength(charge).distanceMax(900))
        .force("collide", d3.forceCollide<SimNode>().radius((n) => n.r + 2).strength(0.95))
        .force("x", d3.forceX<SimNode>(0).strength(0.04))
        .force("y", d3.forceY<SimNode>(0).strength(0.04))
        .velocityDecay(0.35)
        .alphaMin(0.005)
        .alphaDecay(0.05);

      simRef.current = sim;

      const nodeEls = new Map<string, SVGGElement>();
      for (const el of Array.from(world.querySelectorAll<SVGGElement>("g[data-node-id]"))) {
        nodeEls.set(el.dataset.nodeId ?? "", el);
      }
      const linkEls = new Map<string, SVGLineElement>();
      for (const el of Array.from(world.querySelectorAll<SVGLineElement>("line[data-link-id]"))) {
        linkEls.set(el.dataset.linkId ?? "", el);
      }

      let fittedOnce = false;

      sim.on("tick", () => {
        for (const n of simNodes) {
          n.x = Math.max(-BOUNDING, Math.min(BOUNDING, n.x));
          n.y = Math.max(-BOUNDING, Math.min(BOUNDING, n.y));
          positionsRef.current.set(n.id, { x: n.x, y: n.y });

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

        if (!fittedOnce && sim.alpha() < 0.2) {
          fittedOnce = true;
          fit();
        }
      });

      const z = d3Zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.15, 4])
        .on("zoom", (event: { transform: ZoomTransform }) => {
          const { x, y, k } = event.transform;
          zoomKRef.current = k;
          zoomRef.current = { x, y, k };
          world.setAttribute("transform", `translate(${x},${y}) scale(${k})`);
        });

      select(svg).call(z);

      return () => {
        sim.stop();
        simRef.current = null;
      };
    }, [files, links, fit]);

    useEffect(() => {
      const updateSize = () => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        sizeRef.current = { width: rect.width, height: rect.height };
      };
      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }, []);

    const handleNodeClick = (path: string) => {
      onSelectRef.current(selectedRef.current === path ? null : path);
    };

    const handleNodeKeyDown = (e: React.KeyboardEvent, path: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectRef.current(selectedRef.current === path ? null : path);
      }
    };

    const handleHover = (path: string) => {
      setHovered(path);
    };

    return (
      <svg
        ref={svgRef}
        role="group"
        aria-label="Force-directed map of the codebase. Each file is a focusable node: Tab to a node and press Enter to inspect it. Use the Map/List toggle for a table of every file with its scores."
        className="h-full w-full touch-none select-none bg-background/50"
      >
        <defs>
          <pattern id="atlas-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1" fill="hsl(var(--line) / 0.4)" />
          </pattern>
          <radialGradient id="node-gloss" cx="30%" cy="28%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#atlas-dots)" pointerEvents="none" />

        <g ref={worldRef}>
          <g data-links-container>
            {links.map((l) => (
              <line
                key={stampKey(l.source, l.target)}
                data-link
                data-link-id={stampKey(l.source, l.target)}
                stroke="hsl(var(--line) / 0.6)"
                strokeWidth="1.2"
                opacity="0.75"
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
                  className="cursor-pointer outline-none transition-transform"
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
                      opacity={0.5}
                      pointerEvents="none"
                    />
                  )}

                  {/* Active / hover glowing halo */}
                  {(isSelected || isHovered || isFocused) && (
                    <circle
                      r={r + 6}
                      fill="none"
                      stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--ink-dim))"}
                      strokeWidth={1.5}
                      strokeDasharray={isSelected ? "3 3" : undefined}
                      opacity={0.8}
                      pointerEvents="none"
                    />
                  )}

                  {/* Invisible hit target for smooth mouse/touch interaction */}
                  <circle
                    r={Math.max(r + 5, 12)}
                    fill="transparent"
                    pointerEvents="all"
                  />

                  {/* Core Node Circle */}
                  <circle
                    r={r}
                    fill={healthFill(f.health_score)}
                    opacity={isHovered || isSelected || isFocused ? 1 : 0.92}
                    stroke={
                      isSelected
                        ? "hsl(var(--primary))"
                        : isFocused
                          ? "hsl(var(--ink-faint))"
                          : "hsl(var(--surface) / 0.6)"
                    }
                    strokeWidth={isSelected ? 2.5 : isFocused ? 1.5 : 0.8}
                    pointerEvents="none"
                  />

                  {/* 3D Specular Highlight Dome */}
                  <circle
                    r={r}
                    fill="url(#node-gloss)"
                    pointerEvents="none"
                  />

                  {labeled.has(f.path) && (
                    <text
                      data-label
                      y={-r - 6}
                      textAnchor="middle"
                      fill="hsl(var(--ink))"
                      fontSize="10"
                      fontWeight={isSelected ? 600 : 500}
                      className="font-mono select-none"
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