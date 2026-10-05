export { GraphView } from "./components/GraphView";
// Deliberately NOT re-exported.
//
// `TrendChart` is the only thing in this feature that imports `recharts`,
// the largest dependency in the app: 356.24 kB raw / 103.75 kB gzip,
// against an app bundle of 292.35 kB / 94.19 kB. Only the repository
// history route needs it, and that route lazy-imports the module directly.
//
// Exporting it from here made the whole barrel depend on recharts, so any
// component importing `GraphView` from '@/features/graph' -- which is
// `RepoDetail`, on the main app route -- pulled the chart library into the
// initial bundle and defeated the lazy import entirely.
//
// Import it from `./components/TrendChart` and keep it behind `lazy()`.
// A test asserts this stays true; see `index.test.ts`.
export type { ForceGraphHandle } from "./components/ForceDirectedGraph";
export { MockRealtimeSource, mockRealtimeSource } from "./mocks/events";
export { fixture, generateMockSnapshot } from "./mocks/seed";
export type {
  AnalysisSnapshot,
  Comment,
  FileNode,
  PresenceCursor,
  RealtimeScope,
  RealtimeSource,
  ReviewResult,
  SnapshotHistoryPoint,
  User,
} from "./types";