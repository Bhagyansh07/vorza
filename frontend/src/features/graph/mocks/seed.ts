import type {
  AnalysisSnapshot,
  Comment,
  FileNode,
  Repo,
  SnapshotHistoryPoint,
  User,
} from "../types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ModuleDef {
  dir: string;
  basenames: string[];
  size: number;
}

const MODULES: ModuleDef[] = [
  {
    dir: "src/api",
    basenames: ["auth", "repos", "snapshots", "comments", "reviews", "webhooks", "router"],
    size: 7,
  },
  {
    dir: "src/core",
    basenames: ["engine", "config", "security", "database", "schema", "cache", "metrics", "events"],
    size: 8,
  },
  {
    dir: "src/features/auth",
    basenames: ["store", "client", "provider", "oauth", "hooks", "types"],
    size: 6,
  },
  {
    dir: "src/features/repos",
    basenames: ["store", "list", "detail", "connect", "hooks", "types"],
    size: 6,
  },
  {
    dir: "src/features/graph",
    basenames: ["ForceGraph", "GraphView", "TrendChart", "CommentPin", "cursors", "legend", "encoding", "useGraphData", "useComments", "usePresence", "types"],
    size: 11,
  },
  {
    dir: "src/features/analysis",
    basenames: ["pipeline", "parser", "resolver", "reporter", "store", "hooks", "types"],
    size: 7,
  },
  {
    dir: "src/features/comments",
    basenames: ["pin", "list", "composer", "store", "hooks", "types"],
    size: 6,
  },
  {
    dir: "src/features/presence",
    basenames: ["hub", "cursor", "session", "hooks", "types"],
    size: 5,
  },
  {
    dir: "src/lib",
    basenames: ["http", "logger", "errors", "formatting", "time", "retry", "queue", "deferred"],
    size: 8,
  },
  {
    dir: "src/utils",
    basenames: ["math", "array", "string", "object", "path", "async", "dom"],
    size: 7,
  },
  {
    dir: "src/types",
    basenames: ["api", "models", "events", "actions", "common"],
    size: 5,
  },
  {
    dir: "src/workers",
    basenames: ["analysis", "review", "presence", "sync", "index"],
    size: 5,
  },
  {
    dir: "src/state",
    basenames: ["graphStore", "commentStore", "presenceStore", "settingsStore", "index"],
    size: 5,
  },
  {
    dir: "src/components",
    basenames: ["Button", "Panel", "Badge", "Stat", "Spinner", "Empty", "Tooltip"],
    size: 7,
  },
  {
    dir: "src/hooks",
    basenames: ["useDebounce", "useInterval", "useLocalStorage", "useMediaQuery", "useKeyboard", "index"],
    size: 6,
  },
  {
    dir: "tests",
    basenames: ["fixtures", "seed", "graphLayout", "encoding", "trend", "presence", "comments", "parser"],
    size: 8,
  },
  {
    dir: "scripts",
    basenames: ["analyze", "import", "export", "lint", "typecheck", "seed"],
    size: 6,
  },
  {
    dir: "config",
    basenames: ["index", "development", "production", "test", "env", "vite", "eslint"],
    size: 7,
  },
];

const PROBLEM_FILES = [
  "src/core/engine.ts",
  "src/features/graph/ForceGraph.ts",
  "src/api/router.ts",
  "src/workers/analysis.ts",
  "tests/parser.ts",
  "src/features/graph/encoding.ts",
  "src/lib/http.ts",
  "src/workers/review.ts",
];

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export function generateMockSnapshot(repoId: string, seed: number): AnalysisSnapshot {
  const rnd = mulberry32(seed);
  const files: FileNode[] = [];

  for (const mod of MODULES) {
    for (let i = 0; i < mod.size; i++) {
      const basename = i < mod.basenames.length ? mod.basenames[i]! : `misc${i}`;
      const path = `${mod.dir}/${basename}.ts`;
      const loc = Math.round(Math.pow(rnd(), 2.1) * 480) + 18;
      const complexity = clamp(
        Math.round(loc * 0.055 * (0.55 + rnd() * 1.7)) + (rnd() < 0.25 ? 6 : 0),
        1,
        92,
      );
      const churn = Math.round(Math.pow(rnd(), 1.5) * 230) + 3;

      let health =
        97 -
        Math.max(0, (complexity - 14) * 0.85) -
        Math.max(0, (churn - 45) * 0.055) +
        (rnd() - 0.5) * 12;
      if (PROBLEM_FILES.includes(path)) {
        health = 24 + rnd() * 22;
      }
      health = clamp(health, 18, 98);

      const importTargets = MODULES.flatMap((m) =>
        m.basenames.slice(0, m.size).map((b) => `${m.dir}/${b}`),
      );
      const earlier = importTargets.filter(
        (t) => t !== path && files.some((f) => f.path === `${t}.ts`),
      );
      const count = 1 + Math.floor(rnd() * 6);
      const shuffled = [...earlier].sort(() => rnd() - 0.5);
      const imports = shuffled.slice(0, Math.min(count, shuffled.length));

      files.push({
        path,
        loc,
        complexity_score: complexity,
        churn_score: churn,
        health_score: Math.round(health * 10) / 10,
        imports,
      });
    }
  }

  const overallHealth = 67 + rnd() * 8;
  return {
    id: `snap-${seed}`,
    repo_id: repoId,
    created_at: new Date().toISOString(),
    files,
    overall_health_score: Math.round(overallHealth * 10) / 10,
  };
}

export function generateMockHistory(repoId: string, seed: number): SnapshotHistoryPoint[] {
  const rnd = mulberry32(seed + 1);
  const points: SnapshotHistoryPoint[] = [];
  const weeks = 24;
  let value = 71;
  for (let w = weeks - 1; w >= 0; w--) {
    const drift = w < 12 ? -0.9 : 1.05;
    value = clamp(value + drift + (rnd() - 0.5) * 5, 52, 86);
    const date = new Date("2026-01-15T09:00:00Z");
    date.setDate(date.getDate() - w * 7);
    points.push({
      created_at: date.toISOString(),
      overall_health_score: Math.round(value * 10) / 10,
    });
  }
  return points;
}

export function generateMockComments(
  repoId: string,
  snapshotId: string,
  seed: number,
): Comment[] {
  const rnd = mulberry32(seed + 2);
  const drafts: Array<{
    file: string;
    body: string;
    author: string;
    x: number;
    y: number;
  }> = [
    {
      file: "src/core/engine.ts",
      body: "This module is the current bottleneck. Complexity keeps climbing with every feature.",
      author: "priya",
      x: 0.18,
      y: 0.3,
    },
    {
      file: "src/workers/analysis.ts",
      body: "The parse pipeline blocks on network I/O. Can we stream it per-tree instead?",
      author: "marcus",
      x: 0.55,
      y: 0.22,
    },
    {
      file: "src/features/graph/ForceGraph.ts",
      body: "Sizing feels right, but let's tune the charge once the live updates land.",
      author: "ada",
      x: 0.72,
      y: 0.55,
    },
    {
      file: "src/lib/http.ts",
      body: "Retry storm observed here after the last webhook replay. Cap the backoff.",
      author: "priya",
      x: 0.42,
      y: 0.78,
    },
    {
      file: "src/api/router.ts",
      body: "Route table is getting circular. Propose splitting auth and data routes.",
      author: "marcus",
      x: 0.3,
      y: 0.62,
    },
  ];
  const users: Record<string, string> = {
    priya: "Priya R.",
    marcus: "Marcus L.",
    ada: "Ada K.",
  };
  const now = Date.now();
  return drafts.map((d, i): Comment => {
    const comment: Comment = {
      id: `cmt-${i}-${seed}`,
      repo_id: repoId,
      snapshot_id: snapshotId,
      file_path: d.file,
      author_id: d.author,
      body: d.body,
      x: clamp(d.x + (rnd() - 0.5) * 0.04, 0.05, 0.95),
      y: clamp(d.y + (rnd() - 0.5) * 0.04, 0.05, 0.95),
      created_at: new Date(now - (i + 1) * 3600_000).toISOString(),
    };
    return comment;
  });
}

export interface MockFixture {
  user: User;
  repos: Repo[];
  snapshot: AnalysisSnapshot;
  history: SnapshotHistoryPoint[];
  comments: Comment[];
  usernames: Record<string, string>;
}

const REPO_ID = "repo-1";
const SNAPSHOT_ID = "snap-kit";

export const fixture: MockFixture = {
  user: {
    id: "u-me",
    email: "you@demo.dev",
    github_username: "you",
    created_at: new Date().toISOString(),
  },
  repos: [
    {
      id: REPO_ID,
      owner_id: "u-me",
      github_full_name: "acme/atlas-core",
      connected_at: new Date().toISOString(),
      default_branch: "main",
    },
    {
      id: "repo-empty",
      owner_id: "u-me",
      github_full_name: "acme/scratch-project",
      connected_at: new Date().toISOString(),
      default_branch: "main",
    },
  ],
  snapshot: generateMockSnapshot(REPO_ID, 20260914),
  history: generateMockHistory(REPO_ID, 20260914),
  comments: generateMockComments(REPO_ID, SNAPSHOT_ID, 20260914),
  usernames: {
    priya: "Priya R.",
    marcus: "Marcus L.",
    ada: "Ada K.",
    you: "You",
  },
};

export function emptySnapshot(repoId: string): AnalysisSnapshot {
  return {
    id: `snap-empty`,
    repo_id: repoId,
    created_at: new Date().toISOString(),
    files: [],
    overall_health_score: 0,
  };
}