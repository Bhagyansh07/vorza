import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeSource } from "../types";
import { useGraphView } from "../hooks/useGraphView";
import { buildGraph, snapshotHealthBreakdown } from "../lib/graphModel";
import { healthLabel, healthTone } from "../lib/encoding";
import { formatRelative } from "../lib/format";
import { ForceDirectedGraph, type ForceGraphHandle } from "./ForceDirectedGraph";
import { FileSidePanel } from "./FileSidePanel";
import { GraphLegend } from "./GraphLegend";
import { CommentLayer } from "./CommentLayer";
import { PresenceLayer } from "./PresenceLayer";
import { ReviewBanner } from "./ReviewBanner";
import {
  GraphEmptyState,
  GraphErrorState,
  GraphLoadingState,
} from "./StateViews";

interface Props {
  repoId: string;
  repoName?: string;
  realtime: RealtimeSource;
  usernames?: Record<string, string>;
}

interface Draft {
  x: number;
  y: number;
  filePath: string | null;
  anchorId: string;
}

const DEFAULT_USERNAMES: Record<string, string> = {
  priya: "Priya R.",
  marcus: "Marcus L.",
  ada: "Ada K.",
  you: "You",
};

const TONE_TEXT: Record<string, string> = {
  good: "text-signal-good",
  warn: "text-signal-warn",
  bad: "text-signal-bad",
};

export function GraphView({
  repoId,
  repoName = "acme/atlas-core",
  realtime,
  usernames = DEFAULT_USERNAMES,
}: Props) {
  const model = useGraphView(repoId, realtime);
  const graphRef = useRef<ForceGraphHandle>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviewOpen, setReviewOpen] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const draftAnchor = useRef(0);

  const graph = useMemo(
    () => (model.snapshot ? buildGraph(model.snapshot) : { nodes: [], links: [] }),
    [model.snapshot],
  );

  const breakdown = useMemo(
    () => (model.snapshot ? snapshotHealthBreakdown(model.snapshot) : null),
    [model.snapshot],
  );

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.path === selectedPath) ?? null,
    [graph.nodes, selectedPath],
  );

  useEffect(() => {
    setSelectedPath(null);
    setDraft(null);
    setReviewOpen(true);
  }, [repoId]);

  const openComposerAt = useCallback(
    (screenX: number, screenY: number, filePath: string | null) => {
      const canvas = canvasRef.current;
      const size = graphRef.current?.canvasSize();
      const w = size?.width ?? canvas?.clientWidth ?? 1;
      const h = size?.height ?? canvas?.clientHeight ?? 1;
      draftAnchor.current += 1;
      setDraft({
        x: Math.min(0.96, Math.max(0.04, screenX / w)),
        y: Math.min(0.96, Math.max(0.04, screenY / h)),
        filePath,
        anchorId: `d-${draftAnchor.current}`,
      });
    },
    [],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as Element).closest("[data-node-id]")) return;
      const down = downRef.current;
      if (down) {
        const dist = Math.hypot(
          e.clientX - down.x,
          e.clientY - down.y,
        );
        if (dist > 6) return;
      }
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nearest = graphRef.current?.nodeNearestScreenPoint(
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
      openComposerAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        nearest ?? null,
      );
    },
    [openComposerAt],
  );

  const submitComment = useCallback(
    (body: string) => {
      if (!model.snapshot || !draft) return;
      model.postComment({
        repo_id: repoId,
        snapshot_id: model.snapshot.id,
        file_path: draft.filePath ?? "",
        body,
        x: draft.x,
        y: draft.y,
      });
      setDraft(null);
    },
    [model, repoId, draft],
  );

  const liveCount = Object.keys(model.cursors).length;
  const canRenderCanvas =
    model.status === "success" && model.snapshot && model.snapshot.files.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-5 border-b border-line/70 bg-surface/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{repoName}</p>
          {model.snapshot && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
              <LiveDot active={liveCount > 0} />
              analyzed {formatRelative(model.snapshot.created_at)}
              {breakdown && (
                <span className="font-mono text-ink-faint">
                  · {breakdown.files} files
                </span>
              )}
            </p>
          )}
        </div>

        <StatBadge
          label="Health"
          value={model.snapshot ? `${Math.round(model.snapshot.overall_health_score)}` : "–"}
          tone={model.snapshot ? healthTone(model.snapshot.overall_health_score) : "bad"}
          sub={model.snapshot ? healthLabel(model.snapshot.overall_health_score) : "analyzing"}
        />
        <StatBadge label="Comments" value={`${model.comments.length}`} tone="neutral" sub="pins" />
        <StatBadge label="Online" value={`${liveCount}`} tone="neutral" sub="peers" />

        <div className="ml-auto flex items-center gap-2">
          {canRenderCanvas && (
            <button
              onClick={() => graphRef.current?.fit()}
              className="rounded-stem border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-raised"
            >
              Fit map
            </button>
          )}
          <button
            onClick={model.refresh}
            className="rounded-stem border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-raised"
          >
            Re-analyze
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          ref={canvasRef}
          className="relative min-h-0 flex-1"
          onClick={handleCanvasClick}
          onPointerDown={(e) => {
            downRef.current = { x: e.clientX, y: e.clientY };
          }}
        >
          {model.status === "loading" && <GraphLoadingState />}
          {model.status === "error" && (
            <GraphErrorState message={model.error} onRetry={model.refresh} />
          )}
          {model.status === "success" && !model.snapshot?.files.length && (
            <GraphEmptyState onRetry={model.refresh} />
          )}
          {canRenderCanvas && (
            <>
              <ForceDirectedGraph
                ref={graphRef}
                files={model.snapshot!.files}
                links={graph.links}
                pulse={model.pulse}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <PresenceLayer cursors={model.cursors} usernames={usernames} />
                <CommentLayer
                  comments={model.comments}
                  usernames={usernames}
                  draft={draft}
                  onDraftDismiss={() => setDraft(null)}
                  onSubmit={submitComment}
                  onViewFile={(path) => {
                    setSelectedPath(path);
                    graphRef.current?.fit();
                  }}
                />
              </div>
              <div className="pointer-events-none absolute bottom-4 left-4 z-10">
                <div className="pointer-events-auto">
                  <GraphLegend />
                </div>
              </div>
              {model.review && reviewOpen && (
                <div className="pointer-events-none absolute right-4 top-4 z-20">
                  <ReviewBanner
                    review={model.review}
                    onJump={setSelectedPath}
                    onDismiss={() => setReviewOpen(false)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {selectedNode && (
          <FileSidePanel
            node={selectedNode}
            nodes={graph.nodes}
            comments={model.comments}
            usernames={usernames}
            onSelect={(path) => setSelectedPath(path)}
            onComment={(path) => {
              const p = graphRef.current?.nodeScreenPoint(path);
              const canvas = canvasRef.current;
              const { width, height } = graphRef.current?.canvasSize() ?? {
                width: canvas?.clientWidth ?? 1,
                height: canvas?.clientHeight ?? 1,
              };
              if (p && width > 0 && height > 0) {
                openComposerAt(p.x, p.y, path);
              } else {
                openComposerAt(width / 2, height / 2, path);
              }
            }}
            onClose={() => setSelectedPath(null)}
          />
        )}
      </div>
    </div>
  );
}

function StatBadge({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const valueClass =
    tone === "neutral" ? "text-ink" : (TONE_TEXT[tone] ?? "text-ink");
  return (
    <div className="hidden flex-col items-end sm:flex">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      <p className={`font-mono text-sm leading-tight tabular ${valueClass}`}>
        {value}
        <span className="ml-1.5 text-[10px] normal-case text-ink-faint">{sub}</span>
      </p>
    </div>
  );
}

function LiveDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        active ? "bg-signal-good" : "bg-line"
      }`}
    />
  );
}