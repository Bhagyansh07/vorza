import { useMemo, useState } from "react";
import type { FileNode } from "../types";
import { healthLabel, healthTone } from "../lib/encoding";

/**
 * Table view of every file in the snapshot: the keyboard- and
 * screen-reader-accessible alternative to the force-directed canvas (W5, R8 in
 * `docs/02-roadmap.md`). Sorted by health ascending by default so the worst
 * files surface first; any column header re-sorts. Selecting a row drives the
 * same FileSidePanel as a node click in the map view.
 */

type SortKey = "path" | "loc" | "complexity" | "churn" | "health";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

interface Props {
  files: FileNode[];
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
}

const COLUMNS: Array<{
  key: SortKey;
  label: string;
  title: string;
}> = [
  { key: "path", label: "File", title: "Sort by file path" },
  { key: "loc", label: "LOC", title: "Sort by lines of code" },
  { key: "complexity", label: "Complexity", title: "Sort by complexity score" },
  { key: "churn", label: "Churn", title: "Sort by churn score" },
  { key: "health", label: "Health", title: "Sort by health score" },
];

const DOT_TONE: Record<string, string> = {
  good: "bg-signal-good",
  warn: "bg-signal-warn",
  bad: "bg-signal-bad",
};

const TEXT_TONE: Record<string, string> = {
  good: "text-signal-good",
  warn: "text-signal-warn",
  bad: "text-signal-bad",
};

/** First click on a column sorts the "interesting" direction for that column. */
function initialDir(key: SortKey): SortDir {
  return key === "path" || key === "health" ? "asc" : "desc";
}

/** SortKey -> FileNode field. The column labels differ from the model fields
 * ("Complexity" -> complexity_score) so the sort keys are the short UI names.
 * Typed to the numeric fields only so the comparator stays arithmetic-safe. */
const FIELD: Record<
  Exclude<SortKey, "path">,
  "loc" | "complexity_score" | "churn_score" | "health_score"
> = {
  loc: "loc",
  complexity: "complexity_score",
  churn: "churn_score",
  health: "health_score",
};

function comparator(key: SortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return (a: FileNode, b: FileNode): number => {
    if (key === "path") return a.path.localeCompare(b.path) * sign;
    const field = FIELD[key];
    return (a[field] - b[field]) * sign;
  };
}

function formatNum(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}

export function FileTable({ files, selectedPath, onSelect }: Props) {
  const [sort, setSort] = useState<SortState>({ key: "health", dir: "asc" });

  const sorted = useMemo(
    () => [...files].sort(comparator(sort.key, sort.dir)),
    [files, sort],
  );

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: initialDir(key) },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-line/70 px-4 py-2 font-mono text-[11px] text-ink-faint">
        {files.length} file{files.length === 1 ? "" : "s"} · sorted by{" "}
        {COLUMNS.find((c) => c.key === sort.key)?.label.toLowerCase()}{" "}
        {sort.dir === "asc" ? "low to high" : "high to low"}
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            Every file in the snapshot with its line count, complexity, churn
            and health scores. Rows are sorted by health, worst first, by
            default.
          </caption>
          <thead className="sticky top-0 bg-surface">
            <tr>
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className="border-b border-line px-3 py-2 font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`flex items-center gap-1 uppercase tracking-[0.1em] text-[10px] transition-colors hover:text-primary ${
                        active ? "text-primary" : "text-ink-dim"
                      }`}
                      aria-label={`${col.title}, ${
                        active
                          ? `currently ${sort.dir === "asc" ? "ascending" : "descending"}`
                          : "not sorted"
                      }`}
                    >
                      {col.label}
                      <span aria-hidden="true" className="font-mono">
                        {active ? (sort.dir === "asc" ? "↑" : "↓") : "·"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => {
              const tone = healthTone(f.health_score);
              const isSelected = f.path === selectedPath;
              return (
                <tr
                  key={f.path}
                  className={`border-b border-line/50 transition-colors ${
                    isSelected ? "bg-primary-soft/50" : "hover:bg-raised/70"
                  }`}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelect(isSelected ? null : f.path)}
                      className={`block max-w-full truncate font-mono text-[11px] transition-colors hover:text-primary ${
                        isSelected ? "text-primary" : "text-ink"
                      }`}
                      title={f.path}
                    >
                      {f.path}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono tabular text-ink-dim">
                    {formatNum(f.loc)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular text-ink-dim">
                    {formatNum(f.complexity_score)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular text-ink-dim">
                    {formatNum(f.churn_score)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-8 overflow-hidden rounded-full bg-line`}
                      >
                        <span
                          className={`block h-full rounded-full ${DOT_TONE[tone]}`}
                          style={{ width: `${Math.round(f.health_score)}%` }}
                        />
                      </span>
                      <span
                        className={`font-mono text-[11px] tabular ${TEXT_TONE[tone]}`}
                      >
                        {formatNum(f.health_score)}
                      </span>
                      <span className="sr-only">{healthLabel(f.health_score)}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}