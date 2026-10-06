/**
 * Sample AI review card for the landing page. Mirrors the real ReviewBanner's
 * visual language exactly (severity chips, `file:line-line` citation chips,
 * dropped-findings honesty line) but is a static demo with clearly sample
 * content, labelled "Sample review".
 */

const SEVERITY_TONE: Record<string, string> = {
  high: "text-signal-bad border-signal-bad/40",
  medium: "text-signal-warn border-signal-warn/40",
  low: "text-signal-good border-signal-good/40",
};

const FLAGS = [
  {
    severity: "high",
    cite: "services/cache.py:41-56",
    note: "Cache key excludes the resolver version; a deploy can serve stale import sets for up to an hour.",
  },
  {
    severity: "medium",
    cite: "services/indexer.py:118-122",
    note: "Indexer writes outside the snapshot transaction; a crash mid-write leaves a half-built index.",
  },
  {
    severity: "low",
    cite: "tests/test_indexer.py:14-18",
    note: "New tests cover the happy path only, with no cache-miss or concurrent-writer case.",
  },
] as const;

export function ReviewDemo() {
  return (
    <div className="pointer-events-none w-full max-w-sm rounded-stem border border-line bg-surface shadow-panel">
      <header className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Sample review
        </span>
        <span className="font-mono text-[11px] text-ink-dim">PR #128</span>
        <span className="ml-auto font-mono text-xs tabular text-signal-warn">
          risk 58
        </span>
      </header>

      <div className="px-4 py-3">
        <p className="text-xs leading-relaxed text-ink-dim">
          A new index for scanned import edges is built inside the analysis
          service instead of the orchestrator, so the two data paths can
          drift. Every path still resolves, but the cache key ignores the
          refactored resolver.
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {FLAGS.map((flag) => (
            <li
              key={`${flag.cite}-${flag.note}`}
              className="rounded-stem border border-line/60 bg-raised/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${
                    SEVERITY_TONE[flag.severity]
                  }`}
                >
                  {flag.severity}
                </span>
                <span className="truncate font-mono text-[11px] text-ink">
                  {flag.cite}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">
                {flag.note}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-2 font-mono text-[10px] text-ink-faint">
          2 findings dropped: not in the diff
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          6 files recolored
        </p>
      </div>
    </div>
  );
}