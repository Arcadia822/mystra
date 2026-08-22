import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./project-create-modal.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../../../packages/ui/src/styles.css", import.meta.url), "utf8");

describe("ProjectCreateModal composition", () => {
  it("uses shared dialog sections with a fixed footer action", () => {
    for (const primitive of ["UiSurfaceHeader", "UiSurfaceTitle", "UiSurfaceBody", "UiSurfaceFooter", "UiDialogCloseButton"]) {
      expect(source).toContain(primitive);
    }
    expect(source.indexOf("<UiSurfaceHeader")).toBeLessThan(source.indexOf("<UiSurfaceBody"));
    expect(source.indexOf("<UiSurfaceBody")).toBeLessThan(source.indexOf("<UiSurfaceFooter"));
    expect(source).toContain('{zh ? "创建 Project" : "Create Project"}');
    expect(source).toContain('<UiSurfaceTitle id="project-create-title">');
    expect(source).not.toContain('className="uiSurfaceTitle"');
    expect(source).not.toContain("project-create-subtitle");
    expect(source).not.toContain("projectCreateModalHeading");
    expect(source).not.toContain("projectCreateModalHeader");
    expect(source).not.toContain('>{zh ? "取消" : "Cancel"}<');
    expect(styles).toMatch(/\.projectCreateModal\s*{[^}]*height:\s*min\(640px,[^}]*max-height:\s*none;/s);
    expect(styles).toMatch(/\.projectCreateModalSurface\s*{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/s);
    expect(styles).toMatch(/\.projectCreateModalBody\s*{[^}]*overflow:\s*auto;/s);
    expect(styles).not.toMatch(/\.projectCreateModalSurface\s*>\s*\.uiSurfaceHeader\s+h2/);
  });

  it("uses shared dropdowns and the shared stacked repository table", () => {
    expect(source.match(/<UiDropdown/g)).toHaveLength(2);
    expect(source.match(/size="inline"/g)).toHaveLength(3);
    expect(source).toContain('{submitting ? (zh ? "创建中…" : "Creating…") : (zh ? "创建" : "Create")}');
    for (const primitive of ["StackedList", "StackedListField", "StackedListRow"]) {
      expect(source).toContain(primitive);
    }
    expect(source).not.toContain("UiSelect");
    expect(source).not.toContain("projectRepositoryList");
  });
});
