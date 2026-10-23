import { useState } from "react";
import { GitPullRequest, CheckCircle2, AlertOctagon, Terminal } from "lucide-react";

/**
 * Sample AI review card for the landing page. Mirrors the real ReviewBanner's
 * visual language exactly with high-fidelity GitHub PR diff integration.
 */

const SEVERITY_TONE: Record<string, string> = {
  high: "text-signal-bad border-signal-bad/40 bg-signal-bad/10",
  medium: "text-signal-warn border-signal-warn/40 bg-signal-warn/10",
  low: "text-signal-good border-signal-good/40 bg-signal-good/10",
};

const FLAGS = [
  {
    severity: "high",
    cite: "services/cache.py:41-56",
    file: "services/cache.py",
    lines: "Lines 39-58",
    note: "Cache key excludes the resolver version; a deploy can serve stale import sets for up to an hour.",
    diff: [
      { num: 39, type: 'ctx', text: 'def compute_cache_key(repo: str) -> str:' },
      { num: 40, type: 'ctx', text: '    salt = get_deployment_salt()' },
      { num: 41, type: 'del', text: 'return f"ast:{repo}:{salt}"' },
      { num: 42, type: 'add', text: 'return f"ast:{repo}:{salt}:{resolver_v}"' },
      { num: 43, type: 'ctx', text: '' },
      { num: 44, type: 'ctx', text: 'async def invalidate_stale_nodes(keys: list):' },
    ],
  },
  {
    severity: "medium",
    cite: "services/indexer.py:118-122",
    file: "services/indexer.py",
    lines: "Lines 115-125",
    note: "Indexer writes outside the snapshot transaction; a crash mid-write leaves a half-built index.",
    diff: [
      { num: 116, type: 'ctx', text: 'async def commit_scan_results(batch: ScanBatch):' },
      { num: 117, type: 'ctx', text: '    nodes = await parse_ast(batch.files)' },
      { num: 118, type: 'del', text: '    await raw_connection.execute_many(nodes)' },
      { num: 119, type: 'add', text: '    async with db.begin_nested():' },
      { num: 120, type: 'add', text: '        await session.execute_many(nodes)' },
      { num: 121, type: 'ctx', text: '    return batch.checkpoint_id' },
    ],
  },
  {
    severity: "low",
    cite: "tests/test_indexer.py:14-18",
    file: "tests/test_indexer.py",
    lines: "Lines 12-22",
    note: "New tests cover the happy path only, with no cache-miss or concurrent-writer case.",
    diff: [
      { num: 13, type: 'ctx', text: 'def test_happy_path_indexer(mock_db):' },
      { num: 14, type: 'del', text: '    assert scan_repo("demo") is not None' },
      { num: 15, type: 'add', text: '    result = scan_repo("demo")' },
      { num: 16, type: 'add', text: '    assert result.status == "indexed"' },
      { num: 17, type: 'ctx', text: '    assert len(result.edges) == 42' },
    ],
  },
] as const;

export function ReviewDemo() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeFlag = FLAGS[selectedIdx];

  return (
    <div className="w-full flex flex-col gap-4">
      {/* GitHub PR Diff Header Strip */}
      <div className="flex items-center justify-between rounded-xl border border-line/70 bg-surface/70 px-4 py-2.5 backdrop-blur-xl text-xs font-mono">
        <div className="flex items-center gap-2.5">
          <GitPullRequest className="h-4 w-4 text-primary" />
          <span className="font-semibold text-ink">PR #128</span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-dim hidden sm:inline">refactor: async AST cache indexing</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-signal-good/15 border border-signal-good/30 px-2 py-0.5 text-[10px] font-semibold text-signal-good">
            <CheckCircle2 className="h-3 w-3" />
            <span>CI Passed</span>
          </span>
          <span className="text-ink-faint text-[11px]">+48 -19</span>
        </div>
      </div>

      {/* Code Diff Preview with Embedded Vorza AI Review */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Interactive Code Diff Snippet */}
        <div className="lg:col-span-6 rounded-2xl border border-line/80 bg-surface/90 p-4 font-mono text-[11px] shadow-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line/60 pb-2 mb-3 text-ink-faint text-[10px]">
              <span className="flex items-center gap-1.5 text-ink font-semibold">
                <Terminal className="h-3 w-3 text-primary" />
                {activeFlag.file}
              </span>
              <span className="text-ink-dim">{activeFlag.lines}</span>
            </div>
            <div className="space-y-1 text-ink-dim leading-relaxed overflow-x-auto py-0.5">
              {activeFlag.diff.map((line) => (
                <div
                  key={`${line.num}-${line.type}`}
                  className={`flex -mx-4 px-4 py-0.5 whitespace-nowrap min-w-max ${
                    line.type === 'del'
                      ? 'bg-signal-bad/15 text-signal-bad border-l-2 border-signal-bad'
                      : line.type === 'add'
                      ? 'bg-signal-good/15 text-signal-good border-l-2 border-signal-good'
                      : 'text-ink-dim'
                  }`}
                >
                  <span className="select-none text-ink-faint mr-3 tabular w-6 text-right">
                    {line.num}
                  </span>
                  <span className="font-mono">{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-[10px] text-ink-faint">
            <span className="flex items-center gap-1 text-signal-warn">
              <AlertOctagon className="h-3 w-3" />
              Cited flag: {activeFlag.cite}
            </span>
            <span className="font-mono">AST v2.4 parser</span>
          </div>
        </div>

        {/* Right: Vorza AI Review Card (Original Core Spec) */}
        <div className="lg:col-span-6 rounded-2xl border border-line/80 bg-surface/90 shadow-2xl backdrop-blur-2xl transition-all">
          <header className="flex items-center gap-2 border-b border-line/60 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Sample review
            </span>
            <span className="font-mono text-[11px] font-medium text-ink-dim">PR #128</span>
            <span className="ml-auto rounded-full bg-signal-warn/15 border border-signal-warn/30 px-2.5 py-0.5 font-mono text-xs font-bold tabular text-signal-warn shadow-[0_0_12px_hsl(var(--signal-warn)/0.2)]">
              risk 58
            </span>
          </header>

          <div className="px-4 py-3.5">
            <p className="text-xs leading-relaxed text-ink-dim">
              A new index for scanned import edges is built inside the analysis
              service instead of the orchestrator, so the two data paths can
              drift. Every path still resolves, but the cache key ignores the
              refactored resolver.
            </p>

            <ul className="mt-3.5 flex flex-col gap-2.5">
              {FLAGS.map((flag, i) => (
                <li
                  key={`${flag.cite}-${flag.note}`}
                  onClick={() => setSelectedIdx(i)}
                  className={`cursor-pointer rounded-xl border p-2.5 backdrop-blur-xs shadow-xs transition-all ${
                    selectedIdx === i
                      ? 'border-primary/60 bg-primary/10 shadow-md ring-1 ring-primary/30'
                      : 'border-line/60 bg-surface/50 hover:border-line'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        SEVERITY_TONE[flag.severity]
                      }`}
                    >
                      {flag.severity}
                    </span>
                    <span className="truncate font-mono text-[11px] font-medium text-ink">
                      {flag.cite}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-dim">
                    {flag.note}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-3.5 flex items-center justify-between border-t border-line/50 pt-2.5">
              <p className="font-mono text-[10px] text-ink-faint">
                2 findings dropped: not in the diff
              </p>
              <p className="text-[10px] uppercase font-mono tracking-[0.12em] text-ink-faint">
                6 files recolored
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}