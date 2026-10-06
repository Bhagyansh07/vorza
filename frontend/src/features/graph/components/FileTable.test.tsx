import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FileTable } from "./FileTable";
import type { FileNode } from "../types";

const files: FileNode[] = [
  {
    path: "src/app.tsx",
    loc: 420,
    complexity_score: 28,
    churn_score: 42,
    health_score: 72,
    imports: ["src/lib/api.ts"],
  },
  {
    path: "src/lib/api.ts",
    loc: 310,
    complexity_score: 44,
    churn_score: 61,
    health_score: 48,
    imports: [],
  },
  {
    path: "src/lib/utils.ts",
    loc: 95,
    complexity_score: 8,
    churn_score: 12,
    health_score: 94,
    imports: [],
  },
];

function fileButtons() {
  return screen
    .getAllByRole("button")
    .filter((b) => b.textContent?.includes(".") && b.classList.contains("font-mono"))
    .map((b) => b.textContent?.trim() ?? "");
}

function firstRowIs(path: string) {
  const rows = screen
    .getAllByRole("button")
    .filter((b) => b.classList.contains("font-mono"))
    .map((b) => b.textContent?.trim() ?? "");
  return rows[0] === path;
}

describe("FileTable", () => {
  it("defaults to health ascending so the worst files surface first", () => {
    render(<FileTable files={files} selectedPath={null} onSelect={() => {}} />);

    // health: api 48 -> app 72 -> utils 94
    expect(fileButtons()).toEqual([
      "src/lib/api.ts",
      "src/app.tsx",
      "src/lib/utils.ts",
    ]);
  });

  it("sorts by a column header and toggles direction on re-click", async () => {
    const user = userEvent.setup();
    render(<FileTable files={files} selectedPath={null} onSelect={() => {}} />);

    await user.click(screen.getByRole("button", { name: /sort by complexity/i }));

    // complexity desc: api 44 -> app 28 -> utils 8
    expect(firstRowIs("src/lib/api.ts")).toBe(true);
    expect(fileButtons().at(-1)).toBe("src/lib/utils.ts");

    await user.click(screen.getByRole("button", { name: /sort by complexity/i }));

    // complexity asc: utils 8 -> app 28 -> api 44
    expect(firstRowIs("src/lib/utils.ts")).toBe(true);
  });

  it("selects a file through the row button and toggles it off", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FileTable files={files} selectedPath="src/lib/api.ts" onSelect={onSelect} />);

    // Clicking the already-selected row clears the selection.
    await user.click(screen.getByRole("button", { name: "src/lib/api.ts" }));
    expect(onSelect).toHaveBeenCalledWith(null);

    await user.click(screen.getByRole("button", { name: "src/lib/utils.ts" }));
    expect(onSelect).toHaveBeenCalledWith("src/lib/utils.ts");
  });

  it("marks the active sort column with aria-sort and labels every header", () => {
    render(<FileTable files={files} selectedPath={null} onSelect={() => {}} />);

    const headers = screen.getAllByRole("columnheader");
    const health = headers.find((h) => h.textContent?.includes("Health"));
    expect(health).toBeDefined();
    expect(health).toHaveAttribute("aria-sort", "ascending");

    // Every other column is explicitly "not sorted".
    headers
      .filter((h) => !h.textContent?.includes("Health"))
      .forEach((h) => expect(h).toHaveAttribute("aria-sort", "none"));

    // Screen-reader caption announces the purpose of the table.
    expect(screen.getByRole("table")).toHaveAccessibleName(/every file in the snapshot/i);
  });

  it("announces the health tone behind the numeric score", () => {
    render(<FileTable files={files} selectedPath={null} onSelect={() => {}} />);
    // app.tsx (72) and utils.ts (94) are healthy; api.ts (48) is at risk
    expect(screen.getAllByText(/healthy/i)).toHaveLength(2);
    expect(screen.getByText(/at risk/i)).toBeInTheDocument();
  });
});