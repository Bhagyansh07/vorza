interface CommonProps {
  onRetry?: () => void;
}

export function GraphLoadingState() {
  return (
    <div
      className="flex h-full min-h-[320px] flex-col items-center justify-center gap-6"
      role="status"
      aria-label="Loading graph"
    >
      <svg width="120" height="90" viewBox="0 0 120 90" aria-hidden="true" className="opacity-80">
        <circle cx="28" cy="30" r="9" fill="hsl(var(--atlas-line))" className="animate-soft-blink" />
        <circle cx="78" cy="22" r="13" fill="hsl(var(--atlas-line))" className="animate-soft-blink" style={{ animationDelay: "0.2s" }} />
        <circle cx="70" cy="62" r="8" fill="hsl(var(--atlas-line))" className="animate-soft-blink" style={{ animationDelay: "0.4s" }} />
        <circle cx="100" cy="52" r="6" fill="hsl(var(--atlas-line))" className="animate-soft-blink" style={{ animationDelay: "0.6s" }} />
        <circle cx="46" cy="70" r="5" fill="hsl(var(--atlas-line))" className="animate-soft-blink" style={{ animationDelay: "0.8s" }} />
        <g stroke="hsl(var(--atlas-line))" strokeWidth="1.5" fill="none">
          <path d="M28 30 L70 62 M28 30 L78 22 M28 30 L46 70 M78 22 L100 52 M70 62 L100 52" />
        </g>
      </svg>
      <div className="text-center">
        <p className="font-mono text-sm text-ink-dim">mapping files…</p>
        <p className="mt-1 text-xs text-ink-faint">Running complexity + health pass</p>
      </div>
    </div>
  );
}

export function GraphErrorState({ message = "Could not reach the analysis service.", onRetry }: CommonProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-stem border border-line bg-surface">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a9 9 0 1 0 9 9"
            stroke="hsl(var(--atlas-bad))"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 8v5m0 3h.01"
            stroke="hsl(var(--atlas-bad))"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-ink">Map unavailable</p>
        <p className="mt-1 max-w-[42ch] text-xs leading-relaxed text-ink-dim">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-stem bg-primary px-4 py-1.5 text-sm font-medium text-background transition-transform active:translate-y-[1px] hover:brightness-110"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function GraphEmptyState({ onRetry }: CommonProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-stem border border-line bg-surface">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <g stroke="hsl(var(--atlas-accent))" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6" cy="17" r="2" />
            <circle cx="12" cy="6" r="2" />
            <circle cx="18" cy="13" r="2" />
            <path d="M8 16.5 11 7.5m1.5 1.5 3.5 4.5M8.5 15.6l6.5-1.8" />
          </g>
        </svg>
      </div>
      <div className="max-w-[46ch]">
        <p className="text-sm font-medium text-ink">Nothing to map yet</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
          Connect a GitHub repo and run a first analysis. CodeAtlas will turn its
          files into a live map sized by complexity and colored by health.
        </p>
      </div>
      <div className="flex gap-2.5">
        <button className="rounded-stem bg-primary px-4 py-1.5 text-sm font-medium text-background transition-transform active:translate-y-[1px] hover:brightness-110">
          Connect a repo
        </button>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-stem border border-line bg-surface px-4 py-1.5 text-sm text-ink transition-colors hover:bg-raised"
          >
            Re-scan
          </button>
        )}
      </div>
    </div>
  );
}