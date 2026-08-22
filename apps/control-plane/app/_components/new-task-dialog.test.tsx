import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./new-task-dialog.tsx", import.meta.url), "utf8");

describe("NewTaskDialog composition", () => {
  it("uses the approved shared modal controls and persisted Project external ID", () => {
    for (const primitive of ["UiDialogSurface", "UiSurfaceTitle", "UiSurfaceBody", "UiSurfaceFooter", "UiInput", "UiDialogCloseButton", "UiDropdown", "UiTextarea", "UiButton"]) expect(source).toContain(primitive);
    expect(source).not.toContain('layout="rows"');
    expect(source).toContain('<UiSurfaceBody className="taskComposerBody">');
    expect(source).toContain('zh ? "创建 Task" : "Create Task"');
    expect(source).toContain("label: project.repositoryExternalId");
    expect(source).not.toContain("label: project.name");
    expect(source).toContain("metadata: {}");
    expect(source).toMatch(/<UiDropdown[\s\S]*?size="inline"[\s\S]*?variant="ghost"/);
    expect(source).toContain('size="inline" tone="solid"');
  });

  it("closes through Escape, backdrop, and one close control while fencing double submit", () => {
    expect(source).toContain("onCancel=");
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain("event.target === event.currentTarget");
    expect(source).toContain("<UiDialogCloseButton");
    expect(source).toContain("if (!title.trim() || submitting) return");
  });
});
