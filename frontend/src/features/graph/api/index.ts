import type {
  AnalysisSnapshot,
  Comment,
  Repo,
  SnapshotHistoryPoint,
  User,
} from "../types";
import {
  fixture,
  emptySnapshot,
  generateMockHistory,
} from "../mocks/seed";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const API_BASE = "";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchMe(): Promise<User> {
  if (USE_MOCK) return fixture.user;
  return getJSON<User>("/me");
}

export async function fetchRepos(): Promise<Repo[]> {
  if (USE_MOCK) return fixture.repos;
  return getJSON<Repo[]>("/repos");
}

export async function fetchLatestSnapshot(repoId: string): Promise<AnalysisSnapshot> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 450));
    if (repoId === "repo-empty") return emptySnapshot(repoId);
    return fixture.snapshot;
  }
  return getJSON<AnalysisSnapshot>(`/repos/${repoId}/snapshots/latest`);
}

export async function fetchSnapshotHistory(
  repoId: string,
): Promise<SnapshotHistoryPoint[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 350));
    return generateMockHistory(repoId, 20260914);
  }
  return getJSON<SnapshotHistoryPoint[]>(`/repos/${repoId}/snapshots/history`);
}

export async function fetchComments(repoId: string): Promise<Comment[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return fixture.comments;
  }
  return getJSON<Comment[]>(`/repos/${repoId}/comments`);
}

export async function createComment(
  input: Omit<Comment, "id" | "created_at" | "author_id">,
): Promise<Comment> {
  const comment: Comment = {
    ...input,
    id: `cmt-local-${Date.now()}`,
    author_id: "you",
    created_at: new Date().toISOString(),
  };
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    return comment;
  }
  const res = await fetch(`${API_BASE}/repos/${input.repo_id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comment),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as Comment;
}