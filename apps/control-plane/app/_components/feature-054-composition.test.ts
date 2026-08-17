import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("054 production composition", () => {
  it("uses the shared workbench primitives and Task-owned metadata", () => {
    const source = read("./task-workbench.tsx");
    for (const primitive of ["StackedList", "StackedListRow", "TaskStatusIcon", "UiLabel", "UiPopover", "UiSegmented"]) expect(source).toContain(primitive);
    expect(source).toContain("Object.entries(task.metadata)");
    expect(source).toContain("task.projectReference.repositoryExternalId");
    expect(source).toContain("task.issue.identifier");
    expect(source).not.toContain("TaskExecutionAttempt");
    expect(source).not.toContain("productionStatus");
  });

  it("keeps Task detail Main Sessions-only and internal attempts out of UI", () => {
    const page = read("../tasks/[id]/page.tsx");
    const panel = read("./task-detail-panel.tsx");
    expect(page).toContain("<TaskSessionsPanel task={task} />");
    expect(page).not.toContain("TaskProductionPanel");
    expect(page).not.toContain("TaskWorkspacePanel");
    expect(page).not.toContain("TaskExecutionAttempt");
    expect(panel).toContain("current.metadata");
    expect(panel).toContain("current.issue.identifier");
  });

  it("keeps Create Session to Prompt, Provider, Close, and Create presentation fields", () => {
    const source = read("./create-session-dialog.tsx");
    expect(source).toContain('aria-label="Prompt"');
    expect(source).toContain('aria-label="Provider"');
    expect(source).toContain("Create Session");
    expect(source).toContain("manualContext: { text: prompt.trim() }");
    expect(source).not.toContain("agentId:");
    expect(source).not.toContain("runtimeId:");
  });
});
