import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./runtime-management.tsx", import.meta.url), "utf8");

describe("Runtime management composition", () => {
  it("uses the shared stacked table with its own refresh control", () => {
    for (const primitive of ["StackedList", "StackedListField", "StackedListRow", "UiIconButton"]) {
      expect(source).toContain(primitive);
    }
    expect(source).toContain('aria-label="Refresh runtimes"');
    expect(source).toContain('className="detailStack runtimeDetailStack"');
    expect(source).toContain('className="taskWorkbench runtimeTableWorkbench"');
    expect(source).not.toContain('className="pageToolbar"');
    expect(source).not.toContain('className="pageDescription"');
    expect(source).not.toContain('className="runnerColumns"');
  });
});
