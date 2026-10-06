import type { FileNode, GraphLink } from "@/features/graph/types";

/**
 * Demo dataset for the landing page maps ("Survey", "Blast radius", hero).
 *
 * The map is Vorza's own repository layout: backend/ + frontend/ + docs/, with
 * import edges that mirror how the real code is wired (orchestrator is the hub,
 * types/encoding are leaves everybody imports). Scores are illustrative, which
 * is why every map using this data carries a visible "Demo map" label -- it is
 * a sample file tree rendered by the real encoding rules, never presented as a
 * real user's repository.
 */

const f = (
  path: string,
  loc: number,
  complexity_score: number,
  churn_score: number,
  health_score: number,
  imports: string[] = [],
): FileNode => ({ path, loc, complexity_score, churn_score, health_score, imports });

export function demoFiles(): FileNode[] {
  return [
    // --- frontend ---------------------------------------------------------
    f("frontend/src/app/App.tsx", 120, 14, 22, 74, [
      "frontend/src/features/graph/GraphView.tsx",
      "frontend/src/features/repos/RepoDetail.tsx",
      "frontend/src/features/auth/Login.tsx",
      "frontend/src/lib/api.ts",
    ]),
    f("frontend/src/app/router.tsx", 64, 5, 6, 88, ["frontend/src/app/App.tsx"]),
    f("frontend/src/features/graph/GraphView.tsx", 388, 31, 44, 63, [
      "frontend/src/features/graph/ForceDirectedGraph.tsx",
      "frontend/src/lib/types.ts",
      "frontend/src/lib/encoding.ts",
      "frontend/src/lib/api.ts",
    ]),
    f("frontend/src/features/graph/ForceDirectedGraph.tsx", 440, 48, 58, 57, [
      "frontend/src/lib/encoding.ts",
      "frontend/src/lib/types.ts",
    ]),
    f("frontend/src/features/repos/RepoDetail.tsx", 210, 18, 24, 71, [
      "frontend/src/lib/api.ts",
      "frontend/src/lib/types.ts",
    ]),
    f("frontend/src/features/auth/Login.tsx", 96, 8, 10, 82, ["frontend/src/lib/api.ts"]),
    f("frontend/src/lib/api.ts", 170, 13, 19, 79, ["frontend/src/lib/types.ts"]),
    f("frontend/src/lib/types.ts", 88, 3, 5, 92),
    f("frontend/src/lib/encoding.ts", 140, 11, 15, 84, ["frontend/src/lib/types.ts"]),

    // --- backend ----------------------------------------------------------
    f("backend/app/api/main.py", 96, 9, 12, 81, [
      "backend/app/api/routes/repos.py",
      "backend/app/api/routes/snapshots.py",
      "backend/app/api/routes/reviews.py",
      "backend/app/api/routes/auth.py",
      "backend/app/core/config.py",
    ]),
    f("backend/app/api/routes/repos.py", 128, 12, 11, 77, [
      "backend/app/services/orchestrator.py",
      "backend/app/core/config.py",
    ]),
    f("backend/app/api/routes/snapshots.py", 92, 8, 9, 83, [
      "backend/app/services/graph.py",
    ]),
    f("backend/app/api/routes/reviews.py", 84, 7, 8, 85, [
      "backend/app/services/ai_review.py",
    ]),
    f("backend/app/api/routes/auth.py", 130, 14, 16, 76, [
      "backend/app/services/orchestrator.py",
    ]),
    f("backend/app/services/orchestrator.py", 356, 39, 51, 41, [
      "backend/app/services/analyzer.py",
      "backend/app/services/scorer.py",
      "backend/app/services/graph.py",
      "backend/app/services/ai_review.py",
      "backend/app/core/config.py",
      "backend/app/ws/manager.py",
    ]),
    f("backend/app/services/analyzer.py", 148, 15, 20, 68, [
      "backend/app/services/scorer.py",
      "backend/app/core/config.py",
    ]),
    f("backend/app/services/scorer.py", 176, 17, 23, 66, ["backend/app/core/config.py"]),
    f("backend/app/services/graph.py", 96, 9, 8, 86, ["backend/app/services/scorer.py"]),
    f("backend/app/services/ai_review.py", 210, 22, 29, 59, [
      "backend/app/core/config.py",
      "backend/app/models/review.py",
    ]),
    f("backend/app/models/repo.py", 58, 4, 5, 90, ["backend/app/core/config.py"]),
    f("backend/app/models/review.py", 88, 6, 7, 87),
    f("backend/app/core/config.py", 74, 5, 6, 91),
    f("backend/app/core/schema.py", 60, 4, 4, 93, ["backend/app/models/repo.py"]),
    f("backend/app/ws/manager.py", 120, 10, 14, 72, ["backend/app/core/config.py"]),
    f("backend/app/ws/handlers.py", 66, 6, 7, 89, ["backend/app/ws/manager.py"]),

    // --- docs -------------------------------------------------------------
    f("docs/architecture.md", 220, 2, 3, 95),
    f("docs/ops.md", 140, 1, 2, 96),
  ];
}

/** Import edges derived from the files' own `imports` arrays. */
export function demoLinks(): GraphLink[] {
  const byPath = new Set(demoFiles().map((f) => f.path));
  const links: GraphLink[] = [];
  for (const file of demoFiles()) {
    for (const target of file.imports) {
      if (byPath.has(target)) links.push({ source: file.path, target });
    }
  }
  return links;
}

export interface DemoMetrics {
  files: number;
  lines: number;
  edges: number;
}

/** Numbers shown in the hero metric bar -- all derived from the dataset above,
 * so the count-ups animate toward values that are actually true. */
export function demoMetrics(): DemoMetrics {
  const files = demoFiles();
  return {
    files: files.length,
    lines: files.reduce((sum, f) => sum + f.loc, 0),
    edges: demoLinks().length,
  };
}

/**
 * Deterministic seed layout so the maps (and especially the scroll-zoom story,
 * whose keyframe centres name real regions) place the same clusters in the
 * same places on every load: backend on the left, frontend on the right,
 * docs below. The simulation still relaxes from here; it just never starts
 * from a random scatter.
 */
export function demoSeedPositions(): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  // Small deterministic jitter so nodes do not stack exactly on their centres.
  const jitter = (i: number) => (i % 5) * 26 - 52;
  let backend = 0;
  let frontend = 0;
  let docs = 0;
  for (const file of demoFiles()) {
    if (file.path.startsWith("backend")) {
      positions[file.path] = { x: -175 + jitter(backend), y: -60 + (backend % 4) * 58 };
      backend += 1;
    } else if (file.path.startsWith("frontend")) {
      positions[file.path] = { x: 180 + jitter(frontend), y: -70 + (frontend % 3) * 74 };
      frontend += 1;
    } else {
      positions[file.path] = { x: 90 + jitter(docs), y: 235 + (docs % 2) * 44 };
      docs += 1;
    }
  }
  return positions;
}