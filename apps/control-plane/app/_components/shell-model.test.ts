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
    source: "api",
    objective: "Investigate the failing deployment",
    repository: { fullName: "arcadia/mystra" },
    metadata: {},
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T01:00:00.000Z",
    sessionCount: 1,
    activeSessionCount: 0,
    ...overrides,
  };
}

describe("shell task models", () => {
  it("searches objective, Issue, repository, branch, and id fields", () => {
    const item = task({
      issue: {
        reference: {
          provider: "github",
          externalId: "42",
          identifier: "MYS-42",
          url: "https://example.com/issues/42",
        },
        title: "Sidebar collapse is missing",
        state: { name: "open" },
      },
      latestSession: {
        id: "00000000-0000-4000-8000-000000000002",
        taskId: "00000000-0000-4000-8000-000000000001",
        title: "Implement MYS-42",
        state: "running",
        agent: "codex",
        branch: "codex/mys-42",
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T01:00:00.000Z",
      },
    });

    for (const query of ["deployment", "MYS-42", "sidebar", "arcadia/mystra", "codex/mys-42", item.id]) {
      expect(filterTasks([item], query)).toEqual([item]);
    }
    expect(filterTasks([item], "no match")).toEqual([]);
  });

  it("keeps only Tasks waiting for review in Inbox", () => {
    const review = task({
      latestSession: {
        id: "00000000-0000-4000-8000-000000000003",
        taskId: "00000000-0000-4000-8000-000000000001",
        title: "Review",
        state: "waiting_for_review",
        agent: "codex",
        branch: "codex/review",
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T01:00:00.000Z",
      },
    });

    expect(inboxTasks([task(), review])).toEqual([review]);
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
