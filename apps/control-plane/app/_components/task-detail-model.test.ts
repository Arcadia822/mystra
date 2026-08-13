import { describe, expect, it } from "vitest";

import {
  createTaskDetailEditor,
  taskDetailEditorDirty,
  taskDetailEditorSaved,
  validateTaskDetailEditor,
} from "./task-detail-model";

const task = {
  id: "00000000-0000-4000-8000-000000000001",
  teamId: "00000000-0000-4000-8000-000000000002",
  title: "Initial",
  description: null,
  projectId: null,
  issue: null,
  productionStatus: "pending" as const,
  statusRevision: 1,
  statusNote: null,
  statusUpdatedAt: "2026-08-08T00:00:00.000Z",
  statusActor: { kind: "system" as const, actorId: null, agentId: null, harnessId: null, sessionId: null },
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
};

describe("Task detail editor", () => {
  it("tracks dirty Task-owned fields without relation fields", () => {
    const initial = createTaskDetailEditor(task);
    expect(taskDetailEditorDirty(initial)).toBe(false);
    expect(taskDetailEditorDirty({ ...initial, title: "Changed" })).toBe(true);
    expect(initial).not.toHaveProperty("projectId");
    expect(initial).not.toHaveProperty("issue");
  });

  it("validates limits and resets the baseline after success", () => {
    const initial = createTaskDetailEditor(task);
    expect(validateTaskDetailEditor({ ...initial, title: " " })).toBe("title-required");
    expect(validateTaskDetailEditor({ ...initial, description: "x".repeat(100_001) })).toBe("description-too-long");
    expect(taskDetailEditorDirty(taskDetailEditorSaved({ ...task, title: "Saved" }))).toBe(false);
  });

});
