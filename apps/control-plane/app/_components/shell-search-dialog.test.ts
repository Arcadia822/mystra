import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./shell-search-dialog.tsx", import.meta.url), "utf8");

describe("ShellSearchDialog composition", () => {
  it("uses shared dialog and Section slots without a private close control", () => {
    for (const primitive of ["UiDialogSurface", "UiDialogCloseButton", "UiSurface", "UiSurfaceHeader", "UiSurfaceTitle", "UiSurfaceBody"]) {
      expect(source).toContain(primitive);
    }
    expect(source).toContain('<UiSurfaceBody className="searchDialogWorkspace">');
    expect(source).not.toContain("UiIconButton");
    expect(source).not.toContain("compactIconButton");
  });

  it("composes actions, results, and preview through shared Section anatomy", () => {
    expect(source).toContain('className="searchActions" variant="ghost"');
    expect(source).toContain('className="searchResultsSection" variant="ghost"');
    expect(source).toContain('<UiSurfaceTitle as="h3">{taskTitle(selectedTask)}</UiSurfaceTitle>');
    expect(source).not.toContain("searchPreviewEyebrow");
  });
});
