import { describe, expect, it } from "vitest";

import type { TaskListItem } from "../_lib/types";
import {
  filterTasks,
  groupTasksByProject,
  inboxTasks,
  selectedSearchTask,
} from "./shell-model";

function task(overrides: Partial<TaskListItem> = {}): TaskListItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000010",
    metadata: { title: "Sidebar collapse is missing" },
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T01:00:00.000Z",
    ...overrides,
  };
}

describe("shell task models", () => {
  it("searches title, dispatch key, project, and id fields", () => {
    const item = task({ issueDispatchKey: "github:MYS-42" });

    for (const query of ["MYS-42", "sidebar", item.projectId, item.id]) {
      expect(filterTasks([item], query)).toEqual([item]);
    }
    expect(filterTasks([item], "no match")).toEqual([]);
  });

  it("keeps Inbox empty while Session review persistence is unavailable", () => {
    expect(inboxTasks([task()])).toEqual([]);
  });

  it("groups Tasks by Project and orders the newest Task first", () => {
    const older = task({ updatedAt: "2026-08-05T01:00:00.000Z" });
    const newer = task({
      id: "00000000-0000-4000-8000-000000000004",
      updatedAt: "2026-08-05T02:00:00.000Z",
    });

    expect(groupTasksByProject([older, newer])).toEqual([
      { projectId: older.projectId, tasks: [newer, older] },
    ]);
  });

  it("previews only the explicitly selected search result", () => {
    const item = task();

    expect(selectedSearchTask([item], undefined)).toBeUndefined();
    expect(selectedSearchTask([item], "missing")).toBeUndefined();
    expect(selectedSearchTask([item], item.id)).toBe(item);
  });
});
