import { XIcon } from "lucide-react";
import type { ReviewResult } from "../types";

interface Props {
  review: ReviewResult;
  onJump: (path: string) => void;
  onDismiss: () => void;
}

const SEVERITY_TONE: Record<string, string> = {
  high: "text-signal-bad border-signal-bad/40",
  medium: "text-signal-warn border-signal-warn/40",
  low: "text-signal-good border-signal-good/40",
};

function riskTone(score: number): string {
  if (score >= 60) return "text-signal-bad";
  if (score >= 30) return "text-signal-warn";
  return "text-signal-good";
}

function shortPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function ReviewBanner({ review, onJump, onDismiss }: Props) {
  return (
    <div className="pointer-events-auto w-[22rem] rounded-stem border border-line/70 bg-surface/95 shadow-panel backdrop-blur-sm">
      <header className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          AI review
        </span>
        <span className="font-mono text-[11px] text-ink-dim">
          PR #{review.pr_number}
        </span>
        <span className={`ml-auto font-mono text-xs tabular ${riskTone(review.risk_score)}`}>
          risk {Math.round(review.risk_score)}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss review"
          className="rounded-stem p-0.5 text-ink-faint transition-colors hover:text-ink"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="px-4 py-3">
        <p className="text-xs leading-relaxed text-ink-dim">{review.summary}</p>

        {review.flags.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {review.flags.map((flag) => (
              <li
                key={`${flag.file}-${flag.note}`}
                className="rounded-stem border border-line/60 bg-raised/40 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${
                      SEVERITY_TONE[flag.severity] ?? "text-ink-dim border-line"
                    }`}
                  >
                    {flag.severity}
                  </span>
                  <button
                    onClick={() => onJump(flag.file)}
                    className="truncate font-mono text-[11px] text-ink transition-colors hover:text-primary"
                    title={flag.file}
                  >
                    {shortPath(flag.file)}
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">
                  {flag.note}
                </p>
              </li>
            ))}
          </ul>
        )}

        {review.updated_files.length > 0 && (
          <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {review.updated_files.length} file
            {review.updated_files.length === 1 ? "" : "s"} recolored
          </p>
        )}
      </div>
    </div>
  );
}
