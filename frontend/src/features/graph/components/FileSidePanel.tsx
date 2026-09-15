import { useMemo } from "react";
import type { Comment, GraphNode } from "../types";
import { healthFill, healthLabel, healthTone } from "../lib/encoding";
import { basename, formatRelative } from "../lib/format";

interface Props {
  node: GraphNode;
  nodes: GraphNode[];
  comments: Comment[];
  usernames: Record<string, string>;
  onSelect: (path: string) => void;
  onComment: (path: string) => void;
  onClose: () => void;
}

const TONE_TILE: Record<string, string> = {
  good: "text-signal-good border-signal-good/40",
  warn: "text-signal-warn border-signal-warn/40",
  bad: "text-signal-bad border-signal-bad/40",
};

export function FileSidePanel({
  node,
  nodes,
  comments,
  usernames,
  onSelect,
  onComment,
  onClose,
}: Props) {
  const dependents = useMemo(
    () => nodes.filter((n) => n.imports.includes(node.path)),
    [nodes, node.path],
  );
  const fileComments = useMemo(
    () => comments.filter((c) => c.file_path === node.path),
    [comments, node.path],
  );

  const tone = healthTone(node.health_score);
  const toneClass = TONE_TILE[tone];

  return (
    <aside
      className="flex h-full w-[340px] shrink-0 flex-col border-l border-line/70 bg-surface"
      aria-label={`Inspector for ${node.path}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-line/70 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{basename(node.path)}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-ink-faint">
            {node.path}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded-md p-1 text-ink-faint transition-colors hover:bg-raised hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="m2 2 10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <span
            className="h-5 w-5 rounded-full"
            style={{ background: healthFill(node.health_score) }}
          />
          <div>
            <p className="font-mono text-2xl leading-none text-ink">
              {Math.round(node.health_score)}
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">health / 100</p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${toneClass}`}
        >
          {healthLabel(node.health_score)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 pb-4">
        <Stat label="Complexity" value={node.complexity_score} />
        <Stat label="Churn" value={node.churn_score} />
        <Stat label="LOC" value={node.loc} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <RelationList
          title="Imports"
          items={node.imports}
          nodes={nodes}
          onSelect={onSelect}
        />
        <RelationList
          title="Referenced by"
          items={dependents.map((d) => d.path)}
          nodes={nodes}
          onSelect={onSelect}
        />

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Comments
            </p>
            <span className="font-mono text-[11px] text-ink-faint">
              {fileComments.length}
            </span>
          </div>
          {fileComments.length === 0 ? (
            <p className="text-xs text-ink-faint">No pins on this file yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {fileComments.map((c) => (
                <li key={c.id} className="rounded-stem border border-line/70 bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={usernames[c.author_id] ?? c.author_id} />
                    <p className="text-xs font-medium text-ink">
                      {usernames[c.author_id] ?? c.author_id}
                    </p>
                    <span className="ml-auto text-[10px] text-ink-faint">
                      {formatRelative(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-line/70 p-3">
        <button
          onClick={() => onComment(node.path)}
          className="w-full rounded-stem bg-primary px-4 py-2 text-sm font-medium text-background transition-transform active:translate-y-[1px] hover:brightness-110"
        >
          Drop a comment pin
        </button>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-stem border border-line/70 bg-surface px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      <p className="mt-1 font-mono text-base tabular text-ink">{value}</p>
    </div>
  );
}

function RelationList({
  title,
  items,
  nodes,
  onSelect,
}: {
  title: string;
  items: string[];
  nodes: GraphNode[];
  onSelect: (path: string) => void;
}) {
  const known = items.filter((p) => nodes.some((n) => n.path === p));
  if (known.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
        {title}
        <span className="ml-1.5 font-mono text-ink-faint">{known.length}</span>
      </p>
      <ul className="flex flex-col gap-0.5">
        {known.slice(0, 8).map((p) => (
          <li key={p}>
            <button
              onClick={() => onSelect(p)}
              className="w-full truncate rounded px-1.5 py-1 text-left font-mono text-[11px] text-ink-dim transition-colors hover:bg-raised hover:text-ink"
            >
              {p}
            </button>
          </li>
        ))}
        {known.length > 8 && (
          <li className="px-1.5 pt-0.5 text-[11px] text-ink-faint">
            + {known.length - 8} more
          </li>
        )}
      </ul>
    </div>
  );
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-medium text-primary"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}