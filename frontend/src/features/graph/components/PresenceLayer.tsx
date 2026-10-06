import type { PresenceCursor } from "../types";

interface Props {
  cursors: Record<string, PresenceCursor>;
  usernames: Record<string, string>;
}

export function PresenceLayer({ cursors, usernames }: Props) {
  const entries = Object.values(cursors);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {entries.map((c) => {
        const name = usernames[c.user_id] ?? c.user_id;
        return (
          <div
            key={c.user_id}
            className="absolute"
            style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
          >
            <svg
              width="16"
              height="22"
              viewBox="0 0 16 22"
              className="drop-shadow-sm"
            >
              <path
                d="M2 1h9a3 3 0 0 1 3 3v12l-4.5 4V16H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Z"
                fill="hsl(var(--primary))"
              />
              <circle cx="6.5" cy="5.5" r="1.4" fill="hsl(var(--background))" />
            </svg>
            <span className="absolute left-4 top-0 whitespace-nowrap rounded-md border border-primary/50 bg-surface px-1.5 py-0.5 text-[11px] font-medium text-primary">
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}