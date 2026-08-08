import { describe, expect, it } from "vitest";

import {
  clearNewTaskDraft,
  createEmptyNewTaskDraft,
  loadNewTaskDraft,
  newTaskDraftStorageKey,
  saveNewTaskDraft,
  type DraftStorage,
} from "./new-task-model";

function memoryStorage(): DraftStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe("New Task draft", () => {
  it("restores only the same user and Team scope with a stable retry key", () => {
    const storage = memoryStorage();
    const draft = { ...createEmptyNewTaskDraft(() => "retry-key"), title: "Draft", projectId: "project-1" };
    saveNewTaskDraft(storage, "user-1", "team-1", draft);
    expect(loadNewTaskDraft(storage, "user-1", "team-1", new Set(["project-1"]))).toEqual(draft);
    expect(loadNewTaskDraft(storage, "user-1", "team-2", new Set(), () => "team-2-key").idempotencyKey).toBe("team-2-key");
  });

  it("clears a Project that is unavailable in the active Team", () => {
    const storage = memoryStorage();
    saveNewTaskDraft(storage, "user-1", "team-1", {
      ...createEmptyNewTaskDraft(() => "retry-key"),
      projectId: "removed-project",
    });
    const restored = loadNewTaskDraft(storage, "user-1", "team-1", new Set(["active-project"]));
    expect(restored.projectId).toBe("");
    expect(restored.idempotencyKey).toBe("retry-key");
  });

  it("removes the scoped draft after success or explicit clear", () => {
    const storage = memoryStorage();
    saveNewTaskDraft(storage, "user-1", "team-1", createEmptyNewTaskDraft(() => "retry-key"));
    clearNewTaskDraft(storage, "user-1", "team-1");
    expect(storage.values.has(newTaskDraftStorageKey("user-1", "team-1"))).toBe(false);
  });
});
