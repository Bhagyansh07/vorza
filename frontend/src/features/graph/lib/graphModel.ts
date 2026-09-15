import type { AnalysisSnapshot, FileNode, GraphLink, GraphNode } from "../types";

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function buildGraph(snapshot: AnalysisSnapshot): Graph {
  const nodes: GraphNode[] = snapshot.files.map((f) => ({
    id: f.path,
    path: f.path,
    loc: f.loc,
    complexity_score: f.complexity_score,
    churn_score: f.churn_score,
    health_score: f.health_score,
    imports: f.imports,
  }));
  const byPath = new Map(nodes.map((n) => [n.id, n]));
  const links: GraphLink[] = [];
  for (const f of snapshot.files) {
    for (const dep of f.imports) {
      if (byPath.has(dep) && dep !== f.path) {
        links.push({ source: f.path, target: dep });
      }
    }
  }
  return { nodes, links };
}

export function snapshotHealthBreakdown(snapshot: AnalysisSnapshot): {
  files: number;
  critical: number;
  atRisk: number;
  healthy: number;
} {
  let critical = 0;
  let atRisk = 0;
  let healthy = 0;
  for (const f of snapshot.files) {
    if (f.health_score >= 70) healthy++;
    else if (f.health_score >= 45) atRisk++;
    else critical++;
  }
  return { files: snapshot.files.length, critical, atRisk, healthy };
}

export interface GraphPatch {
  files: FileNode[];
  updatedPaths: string[];
}

export function applySnapshotPatch(
  current: FileNode[],
  next: AnalysisSnapshot,
): GraphPatch {
  const byPath = new Map(current.map((f) => [f.path, f]));
  const updatedPaths: string[] = [];
  const merged: FileNode[] = next.files.map((f) => {
    const prev = byPath.get(f.path);
    const changed =
      !prev ||
      prev.health_score !== f.health_score ||
      prev.complexity_score !== f.complexity_score ||
      prev.loc !== f.loc;
    if (changed) updatedPaths.push(f.path);
    return f;
  });
  return { files: merged, updatedPaths };
}