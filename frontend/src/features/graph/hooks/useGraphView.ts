import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnalysisSnapshot,
  Comment,
  FileNode,
  PresenceCursor,
  RealtimeSource,
  ReviewResult,
} from "../types";
import {
  fetchComments,
  fetchLatestSnapshot,
  createComment,
} from "../api";
import { applySnapshotPatch } from "../lib/graphModel";

export type LoadStatus = "loading" | "success" | "error";

export interface GraphViewModel {
  status: LoadStatus;
  error?: string;
  snapshot: AnalysisSnapshot | null;
  files: FileNode[];
  comments: Comment[];
  cursors: Record<string, PresenceCursor>;
  pulse: Record<string, number>;
  review: ReviewResult | null;
  selectedPath: string | null;
  selectFile: (path: string | null) => void;
  postComment: (input: Omit<Comment, "id" | "created_at" | "author_id">) => void;
  refresh: () => void;
}

export function useGraphView(
  repoId: string,
  realtime: RealtimeSource,
  opts: { enabled?: boolean } = {},
): GraphViewModel {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string>();
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursors, setCursors] = useState<Record<string, PresenceCursor>>({});
  const [pulse, setPulse] = useState<Record<string, number>>({});
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const nonceRef = useRef(0);

  const load = useCallback(async () => {
    if (opts.enabled === false) return;
    setStatus("loading");
    setError(undefined);
    try {
      const [snap, cmts] = await Promise.all([
        fetchLatestSnapshot(repoId),
        fetchComments(repoId),
      ]);
      setSnapshot(snap);
      setComments(cmts);
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load repo");
      setStatus("error");
    }
  }, [repoId, opts.enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (opts.enabled === false) return;
    const disconnect = realtime.connect(repoId, {
      onSnapshotUpdated: (next) => {
        setSnapshot((prev) => {
          if (!prev) return next;
          const patch = applySnapshotPatch(prev.files, next);
          nonceRef.current += 1;
          const stamp = nonceRef.current;
          setPulse((old) => {
            const nextPulse = { ...old };
            for (const p of patch.updatedPaths) nextPulse[p] = stamp;
            return nextPulse;
          });
          return next;
        });
      },
      onCursor: (cursor) => {
        setCursors((prev) => ({ ...prev, [cursor.user_id]: cursor }));
      },
      onComment: (comment) => {
        setComments((prev) => [...prev, comment]);
      },
      onReview: (reviewNext) => {
        setReview(reviewNext);
        nonceRef.current += 1;
        const stamp = nonceRef.current;
        setPulse((old) => {
          const nextPulse = { ...old };
          for (const p of reviewNext.updated_files) nextPulse[p] = stamp;
          return nextPulse;
        });
      },
    });
    return disconnect;
  }, [repoId, realtime, opts.enabled]);

  const postComment = useCallback(
    (input: Omit<Comment, "id" | "created_at" | "author_id">) => {
      void createComment(input).then((comment) => {
        setComments((prev) => [...prev, comment]);
      });
    },
    [],
  );

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return {
    status,
    error,
    snapshot,
    files: snapshot?.files ?? [],
    comments,
    cursors,
    pulse,
    review,
    selectedPath,
    selectFile: setSelectedPath,
    postComment,
    refresh,
  };
}