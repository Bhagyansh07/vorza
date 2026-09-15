import { useEffect, useRef, useState } from "react";
import type { Comment } from "../types";
import { basename } from "../lib/format";
import { Avatar } from "./FileSidePanel";

interface Draft {
  x: number;
  y: number;
  filePath: string | null;
  anchorId: string | null;
}

interface Props {
  comments: Comment[];
  usernames: Record<string, string>;
  draft: Draft | null;
  onDraftDismiss: () => void;
  onSubmit: (body: string) => void;
  onViewFile: (path: string) => void;
}

export function CommentLayer({
  comments,
  usernames,
  draft,
  onDraftDismiss,
  onSubmit,
  onViewFile,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [anchored, setAnchored] = useState<Draft | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!draft) return;
    setBody("");
    setAnchored(draft);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [draft?.anchorId]);

  const submit = () => {
    if (!body.trim() || !anchored) return;
    onSubmit(body.trim());
    setBody("");
    setAnchored(null);
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-live="polite"
    >
      {comments.map((c) => {
        const name = usernames[c.author_id] ?? c.author_id;
        const isOpen = open === c.id;
        return (
          <div
            key={c.id}
            className="pointer-events-auto absolute"
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : c.id)}
              className="group -translate-x-1/2 -translate-y-full cursor-pointer"
              aria-label={`Comment by ${name}: ${c.body}`}
              data-comment-pin
            >
              <span className="block h-3 w-3 rounded-t-sm rounded-bl-sm border border-primary/60 bg-primary shadow-[0_1px_4px_rgb(0_0_0/0.45)] transition-transform group-hover:-translate-y-0.5" />
              <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-line/80 bg-surface px-1 py-0.5 font-medium text-primary opacity-0 shadow-panel transition-opacity group-hover:opacity-100">
                {name}
              </span>
            </button>
            {isOpen && (
              <div className="absolute left-0 top-0 z-20 w-64 -translate-x-1/2 rounded-stem border border-line bg-raised p-3 shadow-panel" style={{ marginTop: "0.75rem" }}>
                <div className="flex items-center gap-2">
                  <Avatar name={name} size={22} />
                  <p className="text-xs font-medium text-ink">{name}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-dim">{c.body}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-ink-faint">
                    {basename(c.file_path)}
                  </span>
                  {c.file_path && (
                    <button
                      onClick={() => onViewFile(c.file_path)}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      View file
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {anchored && (
        <div
          className="pointer-events-auto absolute z-30 w-60 rounded-stem border border-line bg-surface p-3 shadow-panel"
          style={{
            left: `${anchored.x * 100}%`,
            top: `${anchored.y * 100}%`,
            transform: anchored.x > 0.55 ? "translate(-100%, 12px)" : "translate(-8px, 12px)",
          }}
        >
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {anchored.filePath ? basename(anchored.filePath) : "canvas note"}
          </p>
          <textarea
            ref={inputRef}
            value={body}
            rows={3}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAnchored(null);
                onDraftDismiss();
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="Leave a note for your team…"
            className="w-full resize-none rounded-stem border border-line bg-surface px-2.5 py-2 text-xs leading-relaxed text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setAnchored(null);
                onDraftDismiss();
              }}
              className="rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!body.trim()}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-background transition-transform active:translate-y-[1px] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}