import type {
  AnalysisSnapshot,
  RealtimeScope,
  RealtimeSource,
  ReviewResult,
} from "../types";
import { generateMockSnapshot, generateMockComments } from "./seed";

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

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

const CURSOR_USERS = [
  { user_id: "priya", label: "Priya R." },
  { user_id: "marcus", label: "Marcus L." },
];

function makeWanderer(seed: number) {
  const rnd = mulberry32(seed);
  let x = 0.2 + rnd() * 0.6;
  let y = 0.2 + rnd() * 0.6;
  let targetX = x;
  let targetY = y;
  let t = 0;
  const tick = () => {
    t -= 1;
    if (t <= 0) {
      targetX = 0.08 + rnd() * 0.84;
      targetY = 0.08 + rnd() * 0.84;
      t = 60 + Math.floor(rnd() * 80);
    }
    x += (targetX - x) * 0.04;
    y += (targetY - y) * 0.04;
    return { x, y };
  };
  return { user_id: 0, tick };
}

/**
 * MockRealtimeSource stands in for Agent 5's WebSocket gateway.
 * It emits the exact CONTRACTS.md event payloads on a timer so the UI can
 * be built and demoed before the real gateway exists.
 */
export class MockRealtimeSource implements RealtimeSource {
  connect(repoId: string, scope: RealtimeScope): () => void {
    const base = generateMockSnapshot(repoId, 20260914);
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const snapshotPulse = (targetPaths: string[]) => {
      const patched: AnalysisSnapshot = {
        ...base,
        files: base.files.map((f) => {
          if (!targetPaths.includes(f.path)) return f;
          const health =
            f.path === "src/core/engine.ts"
              ? Math.max(18, f.health_score - 9)
              : Math.min(99, f.health_score + 4);
          return {
            ...f,
            health_score: Math.round(health * 10) / 10,
            complexity_score:
              f.path === "src/core/engine.ts"
                ? Math.min(99, f.complexity_score + 6)
                : f.complexity_score,
          };
        }),
        created_at: new Date().toISOString(),
      };
      scope.onSnapshotUpdated(patched);
    };

    timers.push(
      setTimeout(() => {
        snapshotPulse(["src/core/engine.ts", "src/features/graph/ForceGraph.ts"]);
      }, 4000),
    );

    timers.push(
      setTimeout(() => {
        snapshotPulse(["src/lib/http.ts"]);
      }, 11000),
    );

    timers.push(
      setTimeout(() => {
        const review: ReviewResult = {
          pr_number: 128,
          risk_score: 41,
          summary:
            "The engine refactor tightens the hot path but adds a long-lived lock that serializes snapshot writes.",
          flags: [
            {
              file: "src/core/engine.ts",
              severity: "high",
              note: "A mutex now guards every snapshot write; consider a lock-free ring buffer.",
            },
            {
              file: "src/lib/http.ts",
              severity: "medium",
              note: "Retry loop re-enters after backoff exhaustion; cap total attempts at 5.",
            },
          ],
          updated_files: [
            "src/core/engine.ts",
            "src/lib/http.ts",
            "src/features/graph/ForceGraph.ts",
          ],
        };
        scope.onReview(review);
      }, 8000),
    );

    timers.push(
      setTimeout(() => {
        scope.onReview({
          pr_number: 129,
          risk_score: 18,
          summary: "Small cleanup, no functional risk.",
          flags: [],
          updated_files: ["src/utils/path.ts"],
        });
      }, 21000),
    );

    timers.push(
      setTimeout(() => {
        const [comment] = generateMockComments(repoId, base.id, 99887766);
        if (comment) scope.onComment({ ...comment, id: "cmt-live-incoming" });
      }, 15000),
    );

    const wanderers = CURSOR_USERS.map((u, i) => {
      const w = makeWanderer(1000 + i);
      w.user_id = i;
      return { user: u, gen: w };
    });

    let cursorT = 0;
    const cursorLoop = () => {
      cursorT += 1;
      for (const w of wanderers) {
        const { x, y } = w.gen.tick();
        const jitter = cursorT % 3 === w.gen.user_id ? 0.004 : 0;
        scope.onCursor({
          user_id: w.user.user_id,
          x: clamp(x + jitter, 0.02, 0.98),
          y: clamp(y + jitter, 0.02, 0.98),
        });
      }
    };
    cursorLoop();
    const cursor = setInterval(cursorLoop, 180);

    return () => {
      timers.forEach((t) => clearTimeout(t));
      clearInterval(cursor);
    };
  }
}

export const mockRealtimeSource = new MockRealtimeSource();